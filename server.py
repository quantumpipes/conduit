"""
QP Conduit — Admin API server for on-premises infrastructure management.

FastAPI server that wraps Conduit shell commands, reads the services registry,
and serves the React admin dashboard. Provides REST endpoints for DNS, TLS,
routing, monitoring, and audit operations.
"""

import hmac
import json
import os
import re
import subprocess
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

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

# API key for authentication (required in production, optional in dev)
API_KEY = os.environ.get("CONDUIT_API_KEY", "")

# Caddy admin URL (restricted to localhost by default)
CADDY_ADMIN_HOST = os.environ.get("CONDUIT_CADDY_ADMIN", "localhost:2019")
_CADDY_ADMIN_ALLOWED = re.compile(r"^(localhost|127\.0\.0\.1|host\.docker\.internal)(:\d+)?$")


# ---------------------------------------------------------------------------
# Input validation patterns
# ---------------------------------------------------------------------------

SERVICE_NAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}[a-zA-Z0-9]$|^[a-zA-Z0-9]$")
HOST_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,253}[a-zA-Z0-9]$")
HEALTH_PATH_RE = re.compile(r"^/[a-zA-Z0-9/_.-]{0,255}$")
DOMAIN_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,253}[a-zA-Z0-9]$")


def _validate_service_name(name: str) -> str:
    """Validate and return a service name, or raise 422."""
    if not SERVICE_NAME_RE.match(name):
        raise HTTPException(422, f"Invalid service name: must match [a-zA-Z0-9_-]")
    return name


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class ServiceRegister(BaseModel):
    name: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_-]*$")
    host: str = Field(..., min_length=3, max_length=255, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9._:-]*$")
    health_path: str = Field(default="/", max_length=256, pattern=r"^/[a-zA-Z0-9/_.-]*$")
    no_tls: bool = False


class DnsResolve(BaseModel):
    domain: str = Field(..., min_length=1, max_length=255, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9._-]*$")


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------


async def verify_api_key(x_api_key: str = Header(default="")):
    """Verify API key if CONDUIT_API_KEY is set. Skip auth if unset (dev mode)."""
    if not API_KEY:
        return  # No key configured: dev mode, allow all
    if not x_api_key or not hmac.compare_digest(x_api_key, API_KEY):
        raise HTTPException(401, "Invalid or missing API key")


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="QP Conduit",
    version="0.1.0",
    dependencies=[Depends(verify_api_key)],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:9999",
        "http://localhost:5173",
        "https://localhost:9999",
    ],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["X-API-Key", "Content-Type"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _run(script: str, *args: str, timeout: int = 30) -> dict:
    """Run a conduit script and return stdout, exit code. Stderr is logged, not returned."""
    cmd = [str(HERE / script)] + list(args)
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, cwd=str(HERE)
        )
        return {
            "ok": result.returncode == 0,
            "stdout": result.stdout,
            "exit_code": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "stdout": "", "exit_code": -1}
    except FileNotFoundError:
        return {"ok": False, "stdout": "", "exit_code": -1}


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


def _caddy_admin_url() -> str:
    """Return validated Caddy admin URL. Restricted to localhost."""
    if not _CADDY_ADMIN_ALLOWED.match(CADDY_ADMIN_HOST):
        return "localhost:2019"  # Fallback to safe default
    return CADDY_ADMIN_HOST


def _caddy_status() -> bool:
    """Check if Caddy admin API is reachable."""
    url = _caddy_admin_url()
    try:
        result = subprocess.run(
            ["curl", "-sf", f"http://{url}/config/"],
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
def register_service(body: ServiceRegister):
    """Register a new service."""
    args = ["--name", body.name, "--host", body.host]
    if body.health_path and body.health_path != "/":
        args += ["--health", body.health_path]
    if body.no_tls:
        args.append("--no-tls")

    result = _run("conduit-register.sh", *args)
    return result


@app.delete("/api/services/{name}")
def deregister_service(name: str):
    """Deregister a service."""
    _validate_service_name(name)
    result = _run("conduit-deregister.sh", "--name", name)
    return result


@app.get("/api/services/{name}/health")
def service_health(name: str):
    """Check health of a specific service."""
    _validate_service_name(name)
    services = _read_json(REGISTRY_PATH, {"services": []}).get("services", [])
    svc = next((s for s in services if s.get("name") == name), None)
    if not svc:
        return JSONResponse({"error": "Service not found"}, status_code=404)
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
def resolve_dns(body: DnsResolve):
    """Resolve a domain name."""
    result = _run("conduit-dns.sh", "--resolve", body.domain)
    return {"ok": result["ok"], "domain": body.domain, "output": result["stdout"]}


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
    _validate_service_name(name)
    result = _run("conduit-certs.sh", "--rotate", name)
    return result


@app.get("/api/tls/{name}/inspect")
def inspect_cert(name: str):
    """Inspect a certificate."""
    _validate_service_name(name)
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
    url = _caddy_admin_url()
    try:
        result = subprocess.run(
            ["curl", "-sf", "-X", "POST", f"http://{url}/load"],
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
    _UI_DIST_RESOLVED = UI_DIST.resolve()

    @app.get("/{path:path}")
    def spa_fallback(path: str):
        # Path traversal guard
        if path:
            file_path = (UI_DIST / path).resolve()
            if not str(file_path).startswith(str(_UI_DIST_RESOLVED)):
                raise HTTPException(403, "Forbidden")
            if file_path.exists() and file_path.is_file():
                return FileResponse(str(file_path))
        # SPA fallback: serve index.html for all routes
        index = UI_DIST / "index.html"
        if index.exists():
            return HTMLResponse(index.read_text())
        return JSONResponse({"error": "UI not built. Run: make ui-build"}, status_code=503)
