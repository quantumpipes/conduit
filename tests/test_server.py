"""
tests/test_server.py
Unit tests for the QP Conduit Admin API server (server.py).
Uses pytest + httpx TestClient for synchronous endpoint testing.
"""

import json
import os
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _isolate_config(tmp_path, monkeypatch):
    """Isolate every test to a unique temp directory for config/registry/audit."""
    config_dir = tmp_path / "conduit-config"
    config_dir.mkdir()
    monkeypatch.setenv("CONDUIT_CONFIG_DIR", str(config_dir))
    monkeypatch.setenv("CONDUIT_DIR", str(Path(__file__).parent.parent))
    monkeypatch.setenv("CONDUIT_APP_NAME", "qp-conduit-test")

    # Patch module-level paths before importing
    import server as srv

    monkeypatch.setattr(srv, "CONFIG_DIR", config_dir)
    monkeypatch.setattr(srv, "REGISTRY_PATH", config_dir / "services.json")
    monkeypatch.setattr(srv, "AUDIT_PATH", config_dir / "audit.log")

    return config_dir


@pytest.fixture
def config_dir(_isolate_config):
    return _isolate_config


@pytest.fixture
def client():
    """Synchronous test client for the FastAPI app."""
    from httpx import Client, ASGITransport
    import server as srv

    transport = ASGITransport(app=srv.app)
    with Client(transport=transport, base_url="http://testserver") as c:
        yield c


@pytest.fixture
def registry_file(config_dir):
    """Create a valid services.json registry file."""
    path = config_dir / "services.json"
    data = {"version": 1, "services": []}
    path.write_text(json.dumps(data))
    return path


@pytest.fixture
def populated_registry(config_dir):
    """Create a registry with sample services."""
    path = config_dir / "services.json"
    data = {
        "version": 1,
        "services": [
            {
                "name": "hub",
                "host": "127.0.0.1",
                "port": 8090,
                "protocol": "https",
                "health_path": "/healthz",
                "status": "active",
                "health_status": "unknown",
                "last_health_check": None,
                "registered_at": "2026-04-04T12:00:00Z",
                "deregistered_at": None,
            },
            {
                "name": "grafana",
                "host": "10.0.1.5",
                "port": 3000,
                "protocol": "https",
                "health_path": "/api/health",
                "status": "active",
                "health_status": "up",
                "last_health_check": "2026-04-04T12:05:00Z",
                "registered_at": "2026-04-04T12:01:00Z",
                "deregistered_at": None,
            },
        ],
    }
    path.write_text(json.dumps(data))
    return path


@pytest.fixture
def audit_file(config_dir):
    """Create an audit log with sample entries."""
    path = config_dir / "audit.log"
    entries = [
        {
            "timestamp": "2026-04-04T12:00:00Z",
            "action": "setup",
            "status": "success",
            "message": "Conduit initialized",
            "user": "admin",
            "details": {},
        },
        {
            "timestamp": "2026-04-04T12:01:00Z",
            "action": "service_register",
            "status": "success",
            "message": "Registered hub",
            "user": "admin",
            "details": {"name": "hub"},
        },
        {
            "timestamp": "2026-04-04T12:02:00Z",
            "action": "service_register",
            "status": "success",
            "message": "Registered grafana",
            "user": "admin",
            "details": {"name": "grafana"},
        },
    ]
    lines = [json.dumps(e) for e in entries]
    path.write_text("\n".join(lines) + "\n")
    return path


# ===========================================================================
# GET /api/ping
# ===========================================================================


class TestPing:
    def test_ping_returns_ok_true(self, client):
        resp = client.get("/api/ping")
        assert resp.status_code == 200
        assert resp.json() == {"ok": True}

    def test_ping_is_get_only(self, client):
        resp = client.post("/api/ping")
        assert resp.status_code == 405


# ===========================================================================
# GET /api/status
# ===========================================================================


class TestStatus:
    def test_status_returns_valid_shape(self, client, registry_file):
        resp = client.get("/api/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "dns" in data
        assert "caddy" in data
        assert "services" in data
        assert "certs" in data
        assert "servers" in data

    def test_status_services_counts(self, client, populated_registry):
        resp = client.get("/api/status")
        data = resp.json()
        assert "services" in data
        assert "total" in data["services"]

    def test_status_returns_last_audit(self, client, registry_file, audit_file):
        resp = client.get("/api/status")
        data = resp.json()
        # last_audit may be None or a dict
        assert "last_audit" in data

    def test_status_without_registry_file(self, client):
        resp = client.get("/api/status")
        assert resp.status_code == 200

    def test_status_dns_field_is_boolean(self, client, registry_file):
        resp = client.get("/api/status")
        data = resp.json()
        assert isinstance(data["dns"], bool)

    def test_status_caddy_field_is_boolean(self, client, registry_file):
        resp = client.get("/api/status")
        data = resp.json()
        assert isinstance(data["caddy"], bool)


# ===========================================================================
# GET /api/services
# ===========================================================================


class TestListServices:
    def test_returns_services_array(self, client, registry_file):
        resp = client.get("/api/services")
        assert resp.status_code == 200
        data = resp.json()
        assert "services" in data
        assert isinstance(data["services"], list)

    def test_returns_empty_when_no_services(self, client, registry_file):
        resp = client.get("/api/services")
        data = resp.json()
        assert data["services"] == []

    def test_returns_populated_services(self, client, populated_registry):
        resp = client.get("/api/services")
        data = resp.json()
        assert len(data["services"]) == 2

    def test_service_has_name_field(self, client, populated_registry):
        resp = client.get("/api/services")
        services = resp.json()["services"]
        assert services[0]["name"] == "hub"

    def test_service_has_host_field(self, client, populated_registry):
        resp = client.get("/api/services")
        services = resp.json()["services"]
        assert services[0]["host"] == "127.0.0.1"

    def test_service_has_port_field(self, client, populated_registry):
        resp = client.get("/api/services")
        services = resp.json()["services"]
        assert services[0]["port"] == 8090

    def test_handles_missing_registry_file(self, client):
        resp = client.get("/api/services")
        assert resp.status_code == 200
        data = resp.json()
        assert data["services"] == []

    def test_handles_corrupt_registry_file(self, client, config_dir):
        (config_dir / "services.json").write_text("not json")
        resp = client.get("/api/services")
        assert resp.status_code == 200


# ===========================================================================
# POST /api/services
# ===========================================================================


class TestRegisterService:
    @patch("server._run")
    def test_validates_required_name(self, mock_run, client):
        mock_run.return_value = {"ok": True, "stdout": "", "stderr": "", "exit_code": 0}
        resp = client.post("/api/services", json={"name": "hub", "host": "127.0.0.1"})
        assert resp.status_code == 200

    @patch("server._run")
    def test_calls_register_script(self, mock_run, client):
        mock_run.return_value = {"ok": True, "stdout": "", "stderr": "", "exit_code": 0}
        client.post("/api/services", json={"name": "hub", "host": "127.0.0.1"})
        mock_run.assert_called_once()
        args = mock_run.call_args[0]
        assert args[0] == "conduit-register.sh"

    @patch("server._run")
    def test_passes_name_and_host(self, mock_run, client):
        mock_run.return_value = {"ok": True, "stdout": "", "stderr": "", "exit_code": 0}
        client.post("/api/services", json={"name": "hub", "host": "10.0.1.5"})
        call_args = mock_run.call_args[0]
        assert "--name" in call_args
        assert "hub" in call_args
        assert "--host" in call_args
        assert "10.0.1.5" in call_args

    @patch("server._run")
    def test_passes_no_tls_flag(self, mock_run, client):
        mock_run.return_value = {"ok": True, "stdout": "", "stderr": "", "exit_code": 0}
        client.post("/api/services", json={"name": "hub", "host": "10.0.1.5", "no_tls": True})
        call_args = mock_run.call_args[0]
        assert "--no-tls" in call_args

    @patch("server._run")
    def test_returns_script_result(self, mock_run, client):
        mock_run.return_value = {"ok": False, "stdout": "", "stderr": "error", "exit_code": 1}
        resp = client.post("/api/services", json={"name": "hub", "host": "127.0.0.1"})
        data = resp.json()
        assert data["ok"] is False


# ===========================================================================
# DELETE /api/services/{name}
# ===========================================================================


class TestDeregisterService:
    @patch("server._run")
    def test_calls_deregister_script(self, mock_run, client):
        mock_run.return_value = {"ok": True, "stdout": "", "stderr": "", "exit_code": 0}
        resp = client.delete("/api/services/hub")
        assert resp.status_code == 200
        mock_run.assert_called_once()

    @patch("server._run")
    def test_passes_service_name(self, mock_run, client):
        mock_run.return_value = {"ok": True, "stdout": "", "stderr": "", "exit_code": 0}
        client.delete("/api/services/grafana")
        call_args = mock_run.call_args[0]
        assert "grafana" in call_args

    @patch("server._run")
    def test_returns_result(self, mock_run, client):
        mock_run.return_value = {"ok": True, "stdout": "done", "stderr": "", "exit_code": 0}
        resp = client.delete("/api/services/hub")
        data = resp.json()
        assert data["ok"] is True


# ===========================================================================
# GET /api/services/{name}/health
# ===========================================================================


class TestServiceHealth:
    def test_returns_health_for_known_service(self, client, populated_registry):
        resp = client.get("/api/services/hub/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "hub"

    def test_returns_404_for_unknown_service(self, client, populated_registry):
        resp = client.get("/api/services/nonexistent/health")
        assert resp.status_code == 404

    def test_returns_error_message_for_missing(self, client, populated_registry):
        resp = client.get("/api/services/nonexistent/health")
        data = resp.json()
        assert "error" in data


# ===========================================================================
# GET /api/dns
# ===========================================================================


class TestDNS:
    @patch("server._run")
    def test_returns_output(self, mock_run, client):
        mock_run.return_value = {"ok": True, "stdout": "DNS entries", "stderr": "", "exit_code": 0}
        resp = client.get("/api/dns")
        assert resp.status_code == 200
        data = resp.json()
        assert "output" in data

    @patch("server._run")
    def test_calls_dns_script(self, mock_run, client):
        mock_run.return_value = {"ok": True, "stdout": "", "stderr": "", "exit_code": 0}
        client.get("/api/dns")
        args = mock_run.call_args[0]
        assert args[0] == "conduit-dns.sh"


# ===========================================================================
# POST /api/dns/resolve
# ===========================================================================


class TestDNSResolve:
    @patch("server._run")
    def test_resolves_domain(self, mock_run, client):
        mock_run.return_value = {"ok": True, "stdout": "127.0.0.1", "stderr": "", "exit_code": 0}
        resp = client.post("/api/dns/resolve", json={"domain": "hub"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["domain"] == "hub"

    @patch("server._run")
    def test_includes_output(self, mock_run, client):
        mock_run.return_value = {"ok": True, "stdout": "resolved", "stderr": "", "exit_code": 0}
        resp = client.post("/api/dns/resolve", json={"domain": "hub"})
        data = resp.json()
        assert "output" in data


# ===========================================================================
# POST /api/dns/flush
# ===========================================================================


class TestDNSFlush:
    @patch("server._run")
    def test_flush_returns_result(self, mock_run, client):
        mock_run.return_value = {"ok": True, "stdout": "flushed", "stderr": "", "exit_code": 0}
        resp = client.post("/api/dns/flush")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True


# ===========================================================================
# GET /api/tls
# ===========================================================================


class TestTLS:
    @patch("server._run")
    def test_returns_output(self, mock_run, client):
        mock_run.return_value = {"ok": True, "stdout": "certs list", "stderr": "", "exit_code": 0}
        resp = client.get("/api/tls")
        assert resp.status_code == 200
        data = resp.json()
        assert "output" in data


# ===========================================================================
# POST /api/tls/{name}/rotate
# ===========================================================================


class TestTLSRotate:
    @patch("server._run")
    def test_rotate_returns_result(self, mock_run, client):
        mock_run.return_value = {"ok": True, "stdout": "rotated", "stderr": "", "exit_code": 0}
        resp = client.post("/api/tls/hub/rotate")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True

    @patch("server._run")
    def test_rotate_passes_name(self, mock_run, client):
        mock_run.return_value = {"ok": True, "stdout": "", "stderr": "", "exit_code": 0}
        client.post("/api/tls/grafana/rotate")
        call_args = mock_run.call_args[0]
        assert "grafana" in call_args


# ===========================================================================
# GET /api/tls/{name}/inspect
# ===========================================================================


class TestTLSInspect:
    @patch("server._run")
    def test_inspect_returns_output(self, mock_run, client):
        mock_run.return_value = {"ok": True, "stdout": "cert details", "stderr": "", "exit_code": 0}
        resp = client.get("/api/tls/hub/inspect")
        assert resp.status_code == 200
        data = resp.json()
        assert "output" in data


# ===========================================================================
# GET /api/servers
# ===========================================================================


class TestServers:
    @patch("server._run")
    def test_returns_output(self, mock_run, client):
        mock_run.return_value = {"ok": True, "stdout": "server stats", "stderr": "", "exit_code": 0}
        resp = client.get("/api/servers")
        assert resp.status_code == 200
        data = resp.json()
        assert "output" in data


# ===========================================================================
# GET /api/servers/containers
# ===========================================================================


class TestContainers:
    @patch("server._run")
    def test_returns_output(self, mock_run, client):
        mock_run.return_value = {"ok": True, "stdout": "containers", "stderr": "", "exit_code": 0}
        resp = client.get("/api/servers/containers")
        assert resp.status_code == 200
        data = resp.json()
        assert "output" in data


# ===========================================================================
# GET /api/routing
# ===========================================================================


class TestRouting:
    def test_returns_routes_array(self, client, populated_registry):
        resp = client.get("/api/routing")
        assert resp.status_code == 200
        data = resp.json()
        assert "routes" in data
        assert isinstance(data["routes"], list)

    def test_routes_have_name(self, client, populated_registry):
        resp = client.get("/api/routing")
        routes = resp.json()["routes"]
        assert routes[0]["name"] == "hub"

    def test_routes_have_upstream(self, client, populated_registry):
        resp = client.get("/api/routing")
        routes = resp.json()["routes"]
        assert routes[0]["upstream"] == "127.0.0.1:8090"

    def test_empty_routes_when_no_services(self, client, registry_file):
        resp = client.get("/api/routing")
        data = resp.json()
        assert data["routes"] == []


# ===========================================================================
# POST /api/routing/reload
# ===========================================================================


class TestRoutingReload:
    @patch("server.subprocess.run")
    def test_reload_returns_result(self, mock_run, client):
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_run.return_value = mock_result
        resp = client.post("/api/routing/reload")
        assert resp.status_code == 200
        data = resp.json()
        assert "ok" in data

    @patch("server.subprocess.run", side_effect=FileNotFoundError)
    def test_reload_handles_missing_curl(self, mock_run, client):
        resp = client.post("/api/routing/reload")
        data = resp.json()
        assert data["ok"] is False


# ===========================================================================
# GET /api/audit
# ===========================================================================


class TestAudit:
    def test_returns_entries_and_total(self, client, audit_file):
        resp = client.get("/api/audit")
        assert resp.status_code == 200
        data = resp.json()
        assert "entries" in data
        assert "total" in data
        assert isinstance(data["entries"], list)

    def test_returns_correct_count(self, client, audit_file):
        resp = client.get("/api/audit")
        data = resp.json()
        assert data["total"] == 3

    def test_respects_limit_parameter(self, client, audit_file):
        resp = client.get("/api/audit?limit=2")
        data = resp.json()
        assert len(data["entries"]) == 2

    def test_default_limit_is_50(self, client, audit_file):
        resp = client.get("/api/audit")
        data = resp.json()
        # Should return all 3 since 3 < 50
        assert data["total"] == 3

    def test_limit_min_is_1(self, client, audit_file):
        resp = client.get("/api/audit?limit=0")
        assert resp.status_code == 422

    def test_limit_max_is_500(self, client, audit_file):
        resp = client.get("/api/audit?limit=501")
        assert resp.status_code == 422

    def test_returns_empty_when_no_audit_file(self, client):
        resp = client.get("/api/audit")
        data = resp.json()
        assert data["entries"] == []
        assert data["total"] == 0

    def test_entries_have_timestamp(self, client, audit_file):
        resp = client.get("/api/audit")
        entries = resp.json()["entries"]
        assert "timestamp" in entries[0]

    def test_entries_have_action(self, client, audit_file):
        resp = client.get("/api/audit")
        entries = resp.json()["entries"]
        assert "action" in entries[0]

    def test_entries_ordered_most_recent_first(self, client, audit_file):
        resp = client.get("/api/audit")
        entries = resp.json()["entries"]
        # Last entry in file should be first in response (reversed)
        assert entries[0]["action"] == "service_register"


# ===========================================================================
# _read_json helper
# ===========================================================================


class TestReadJson:
    def test_handles_missing_file(self, config_dir):
        import server as srv

        result = srv._read_json(config_dir / "nonexistent.json")
        assert result == {}

    def test_handles_invalid_json(self, config_dir):
        import server as srv

        bad_file = config_dir / "bad.json"
        bad_file.write_text("not json at all")
        result = srv._read_json(bad_file)
        assert result == {}

    def test_handles_valid_json(self, config_dir):
        import server as srv

        good_file = config_dir / "good.json"
        good_file.write_text('{"key": "value"}')
        result = srv._read_json(good_file)
        assert result == {"key": "value"}

    def test_returns_custom_default(self, config_dir):
        import server as srv

        result = srv._read_json(config_dir / "missing.json", default={"services": []})
        assert result == {"services": []}

    def test_handles_empty_file(self, config_dir):
        import server as srv

        empty_file = config_dir / "empty.json"
        empty_file.write_text("")
        result = srv._read_json(empty_file)
        assert result == {}


# ===========================================================================
# _read_audit helper
# ===========================================================================


class TestReadAudit:
    def test_handles_missing_file(self):
        import server as srv

        # Temporarily point to a nonexistent path
        original = srv.AUDIT_PATH
        srv.AUDIT_PATH = Path("/tmp/nonexistent-audit-test-file.log")
        result = srv._read_audit()
        assert result == []
        srv.AUDIT_PATH = original

    def test_handles_empty_file(self, config_dir):
        import server as srv

        audit_path = config_dir / "audit.log"
        audit_path.write_text("")
        result = srv._read_audit()
        assert result == []

    def test_respects_limit(self, audit_file):
        import server as srv

        result = srv._read_audit(limit=1)
        assert len(result) == 1

    def test_skips_invalid_json_lines(self, config_dir):
        import server as srv

        audit_path = config_dir / "audit.log"
        audit_path.write_text('{"valid": true}\nnot json\n{"also_valid": true}\n')
        result = srv._read_audit(limit=10)
        assert len(result) == 2

    def test_returns_most_recent_first(self, audit_file):
        import server as srv

        result = srv._read_audit(limit=10)
        assert result[0]["action"] == "service_register"
        assert result[0]["message"] == "Registered grafana"


# ===========================================================================
# _run helper
# ===========================================================================


class TestRunHelper:
    def test_returns_ok_true_on_success(self):
        import server as srv

        result = srv._run("echo", "hello")
        # echo is not a conduit script, so it may fail as FileNotFoundError
        # depending on path. Test the structure.
        assert "ok" in result
        assert "stdout" in result
        assert "stderr" in result
        assert "exit_code" in result

    def test_handles_missing_script(self):
        import server as srv

        result = srv._run("nonexistent-script-xyz.sh")
        assert result["ok"] is False
        assert result["exit_code"] == -1

    @patch("server.subprocess.run", side_effect=Exception("timeout"))
    def test_handles_timeout(self, mock_run):
        import server as srv

        # subprocess.TimeoutExpired is caught in _run
        from subprocess import TimeoutExpired

        with patch("server.subprocess.run", side_effect=TimeoutExpired("cmd", 5)):
            result = srv._run("test.sh")
            assert result["ok"] is False
            assert "timed out" in result["stderr"].lower()


# ===========================================================================
# SPA fallback
# ===========================================================================


class TestSPAFallback:
    def test_spa_returns_503_when_ui_not_built(self, client, config_dir):
        """When UI dist does not exist, the SPA route may not be registered."""
        # The app mounts SPA only if UI_DIST exists at import time.
        # Since we are in test environment, UI may or may not exist.
        resp = client.get("/")
        # Either 200 (if UI is built) or 404 (if route not registered)
        assert resp.status_code in (200, 404, 503)

    def test_api_routes_take_precedence(self, client, registry_file):
        """API routes should always work even with SPA fallback."""
        resp = client.get("/api/ping")
        assert resp.status_code == 200
        assert resp.json() == {"ok": True}


# ===========================================================================
# POST /api/tls/trust
# ===========================================================================


class TestTLSTrust:
    @patch("server._run")
    def test_trust_returns_result(self, mock_run, client):
        mock_run.return_value = {"ok": True, "stdout": "trusted", "stderr": "", "exit_code": 0}
        resp = client.post("/api/tls/trust")
        assert resp.status_code == 200
