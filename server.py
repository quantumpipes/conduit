"""
QP Conduit — Admin API server for on-premises infrastructure management.

FastAPI server that wraps Conduit shell commands, reads the services registry,
and serves the React admin dashboard. Provides REST endpoints for DNS, TLS,
routing, monitoring, and audit operations.
"""

import json
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

HERE = Path(__file__).parent
CONDUIT_DIR = os.environ.get("CONDUIT_DIR", str(HERE))
CONFIG_DIR = Path(
    os.environ.get(
        "CONDUIT_CONFIG_DIR",
        str(Path.home() / ".config" / os.environ.get("CONDUIT_APP_NAME", "qp-conduit")),
    )
)
REGISTRY_PATH = CONFIG_DIR / "services.json"
AUDIT_PATH = CONFIG_DIR / "audit.log"

app = FastAPI(title="QP Conduit", version="0.1.0")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _run(script: str, *args: str, timeout: int = 30) -> dict:
    """Run a conduit script and return stdout, stderr, exit code."""
    cmd = [str(HERE / script)] + list(args)
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, cwd=str(HERE)
        )
        return {
            "ok": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "stdout": "", "stderr": "Command timed out", "exit_code": -1}
    except FileNotFoundError:
        return {"ok": False, "stdout": "", "stderr": f"Script not found: {script}", "exit_code": -1}


def _read_json(path: Path, default=None):
    """Read a JSON file, return default if missing or invalid."""
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return default if default is not None else {}


def _read_audit(limit: int = 50) -> list[dict]:
    """Read the last N audit log entries (JSONL format)."""
    try:
        lines = AUDIT_PATH.read_text().strip().splitlines()
        entries = []
        for line in reversed(lines):
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
            if len(entries) >= limit:
                break
        return entries
    except FileNotFoundError:
        return []


def _caddy_status() -> bool:
    """Check if Caddy admin API is reachable."""
    admin_url = os.environ.get("CONDUIT_CADDY_ADMIN", "localhost:2019")
    try:
        result = subprocess.run(
            ["curl", "-sf", f"http://{admin_url}/config/"],
            capture_output=True, timeout=3,
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def _dns_status() -> bool:
    """Check if dnsmasq is running."""
    try:
        result = subprocess.run(
            ["pgrep", "-x", "dnsmasq"], capture_output=True, timeout=3
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------


@app.get("/api/status")
def get_status():
    """Global Conduit health status."""
    services = _read_json(REGISTRY_PATH, {"services": []}).get("services", [])
    up = sum(1 for s in services if s.get("status") == "up")
    degraded = sum(1 for s in services if s.get("status") == "degraded")
    down = sum(1 for s in services if s.get("status") == "down")

    audit = _read_audit(1)

    return {
        "dns": _dns_status(),
        "caddy": _caddy_status(),
        "services": {"up": up, "degraded": degraded, "down": down, "total": len(services)},
        "certs": {"valid": 0, "expiring": 0, "expired": 0},
        "servers": {"online": 0, "total": 0},
        "last_audit": audit[0] if audit else None,
    }


@app.get("/api/ping")
def ping():
    return {"ok": True}


# ---------------------------------------------------------------------------
# Services
# ---------------------------------------------------------------------------


@app.get("/api/services")
def list_services():
    """List all registered services."""
    data = _read_json(REGISTRY_PATH, {"services": []})
    return {"services": data.get("services", [])}


@app.post("/api/services")
def register_service(body: dict):
    """Register a new service."""
    name = body.get("name", "")
    host = body.get("host", "")
    health = body.get("health_path", "/")
    no_tls = body.get("no_tls", False)

    args = ["--name", name, "--host", host]
    if health and health != "/":
        args += ["--health", health]
    if no_tls:
        args.append("--no-tls")

    result = _run("conduit-register.sh", *args)
    return result


@app.delete("/api/services/{name}")
def deregister_service(name: str):
    """Deregister a service."""
    result = _run("conduit-deregister.sh", "--name", name)
    return result


@app.get("/api/services/{name}/health")
def service_health(name: str):
    """Check health of a specific service."""
    services = _read_json(REGISTRY_PATH, {"services": []}).get("services", [])
    svc = next((s for s in services if s.get("name") == name), None)
    if not svc:
        return JSONResponse({"error": f"Service '{name}' not found"}, status_code=404)
    return {"name": name, "status": svc.get("status", "unknown")}


# ---------------------------------------------------------------------------
# DNS
# ---------------------------------------------------------------------------


@app.get("/api/dns")
def list_dns():
    """List DNS entries."""
    result = _run("conduit-dns.sh")
    return {"ok": result["ok"], "output": result["stdout"]}


@app.post("/api/dns/resolve")
def resolve_dns(body: dict):
    """Resolve a domain name."""
    domain = body.get("domain", "")
    result = _run("conduit-dns.sh", "--resolve", domain)
    return {"ok": result["ok"], "domain": domain, "output": result["stdout"]}


@app.post("/api/dns/flush")
def flush_dns():
    """Flush DNS cache."""
    result = _run("conduit-dns.sh", "--flush")
    return result


# ---------------------------------------------------------------------------
# TLS
# ---------------------------------------------------------------------------


@app.get("/api/tls")
def list_certs():
    """List all TLS certificates."""
    result = _run("conduit-certs.sh")
    return {"ok": result["ok"], "output": result["stdout"]}


@app.post("/api/tls/{name}/rotate")
def rotate_cert(name: str):
    """Rotate a certificate."""
    result = _run("conduit-certs.sh", "--rotate", name)
    return result


@app.get("/api/tls/{name}/inspect")
def inspect_cert(name: str):
    """Inspect a certificate."""
    result = _run("conduit-certs.sh", "--inspect", name)
    return {"ok": result["ok"], "output": result["stdout"]}


@app.post("/api/tls/trust")
def trust_ca():
    """Install internal CA in system trust store."""
    result = _run("conduit-certs.sh", "--trust")
    return result


# ---------------------------------------------------------------------------
# Servers / Monitoring
# ---------------------------------------------------------------------------


@app.get("/api/servers")
def list_servers():
    """List configured servers with hardware stats."""
    result = _run("conduit-monitor.sh", timeout=15)
    return {"ok": result["ok"], "output": result["stdout"]}


@app.get("/api/servers/containers")
def list_containers():
    """List Docker containers."""
    result = _run("conduit-monitor.sh", "--containers", timeout=15)
    return {"ok": result["ok"], "output": result["stdout"]}


# ---------------------------------------------------------------------------
# Routing
# ---------------------------------------------------------------------------


@app.get("/api/routing")
def list_routes():
    """List all proxy routes."""
    services = _read_json(REGISTRY_PATH, {"services": []}).get("services", [])
    routes = [
        {
            "name": s.get("name"),
            "domain": s.get("domain", f"{s.get('name')}.internal"),
            "upstream": f"{s.get('host')}:{s.get('port')}",
            "tls": s.get("tls_enabled", True),
            "health_status": s.get("status", "unknown"),
            "response_time": s.get("response_time"),
            "last_checked": s.get("last_check"),
        }
        for s in services
    ]
    return {"routes": routes}


@app.post("/api/routing/reload")
def reload_routing():
    """Reload Caddy configuration."""
    admin_url = os.environ.get("CONDUIT_CADDY_ADMIN", "localhost:2019")
    try:
        result = subprocess.run(
            ["curl", "-sf", "-X", "POST", f"http://{admin_url}/load"],
            capture_output=True, timeout=5,
        )
        return {"ok": result.returncode == 0}
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return {"ok": False, "error": "Caddy admin API unreachable"}


# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------


@app.get("/api/audit")
def get_audit(limit: int = Query(50, ge=1, le=500)):
    """Get recent audit log entries."""
    entries = _read_audit(limit)
    return {"entries": entries, "total": len(entries)}


# ---------------------------------------------------------------------------
# SPA fallback
# ---------------------------------------------------------------------------

UI_DIST = HERE / "ui" / "dist"
UI_ASSETS = UI_DIST / "assets"

if UI_ASSETS.exists():
    app.mount("/assets", StaticFiles(directory=str(UI_ASSETS)), name="assets")

if UI_DIST.exists():

    @app.get("/{path:path}")
    def spa_fallback(path: str):
        # Serve specific files from dist (e.g., vite.svg, favicon)
        file_path = UI_DIST / path
        if path and file_path.exists() and file_path.is_file():
            return HTMLResponse(file_path.read_bytes())
        # SPA fallback: serve index.html for all routes
        index = UI_DIST / "index.html"
        if index.exists():
            return HTMLResponse(index.read_text())
        return JSONResponse({"error": "UI not built. Run: make ui-build"}, status_code=503)
