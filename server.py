"""
QP Conduit — Admin API server for on-premises infrastructure management.

FastAPI server that wraps Conduit shell commands, reads the services registry,
and serves the React admin dashboard. Provides REST endpoints for DNS, TLS,
routing, monitoring, and audit operations.
"""

import hmac
import ipaddress
import json
import os
import re
import socket
import subprocess
import time
from collections import defaultdict
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
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

# API key for authentication. Read-only endpoints allow anonymous access only
# when this is unset (dev mode); state-changing / sudo-backed endpoints ALWAYS
# require it and fail closed when it is unset. See verify_api_key /
# require_privileged below.
API_KEY = os.environ.get("CONDUIT_API_KEY", "")

# Default bind address for the admin server. Loopback-only by default so the
# privileged admin API is never exposed on a routable interface unless the
# operator explicitly opts in (CONDUIT_BIND_HOST). Used by the __main__ runner.
BIND_HOST = os.environ.get("CONDUIT_BIND_HOST", "127.0.0.1")
BIND_PORT = int(os.environ.get("CONDUIT_BIND_PORT", "9999"))

# Caddy admin URL (restricted to localhost by default)
CADDY_ADMIN_HOST = os.environ.get("CONDUIT_CADDY_ADMIN", "localhost:2019")
_CADDY_ADMIN_ALLOWED = re.compile(r"^(localhost|127\.0\.0\.1|host\.docker\.internal)(:\d+)?$")

# Optional operator-configured upstream allowlist for service registration.
# Comma-separated list of hostnames and/or CIDR networks. When set, a service
# upstream host must resolve into one of these networks (or exactly match an
# allowed hostname). When unset, registration still rejects loopback,
# link-local, metadata, and unspecified ranges (see _validate_upstream_host).
ALLOWED_UPSTREAMS = [
    item.strip()
    for item in os.environ.get("CONDUIT_ALLOWED_UPSTREAMS", "").split(",")
    if item.strip()
]


# ---------------------------------------------------------------------------
# Cloud instance-metadata (IMDS) endpoints that must never be a proxy upstream
# ---------------------------------------------------------------------------

# Provider metadata endpoints that the stdlib ``ipaddress`` flags do NOT cover.
# AWS/EC2/Azure/GCP-IPv4 all live at 169.254.169.254 (caught by is_link_local),
# but these do not fall into any blocked flag and would otherwise be a usable
# SSRF / credential-theft pivot:
#   - 100.100.100.200  Alibaba Cloud ECS metadata (in 100.64.0.0/10 CGNAT, not
#                       flagged private/reserved by ipaddress)
#   - 192.0.0.192      Oracle Cloud / OpenStack metadata (192.0.0.0/24 is
#                       is_private but NOT checked here, since blanket private
#                       blocking would also reject legitimate RFC1918 LAN
#                       upstreams)
#   - fd00:ec2::254    IPv6 EC2 / cloud metadata (ULA fd00::/8, is_private but
#                       not checked here for the same reason)
_BLOCKED_METADATA_IPS = frozenset(
    ipaddress.ip_address(addr)
    for addr in ("100.100.100.200", "192.0.0.192", "fd00:ec2::254")
)


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


def _is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Return True when an IP falls in a range that must never be a proxy upstream.

    Blocks loopback (127.0.0.0/8, ::1), link-local incl. the AWS/Azure/GCP cloud
    metadata endpoint 169.254.169.254 (169.254.0.0/16, fe80::/10), the
    unspecified address (0.0.0.0, ::), other non-routable/reserved ranges, and
    the non-169.254 provider metadata endpoints (Alibaba 100.100.100.200,
    Oracle/OpenStack 192.0.0.192, IPv6 fd00:ec2::254) that the stdlib flags do
    not classify. This closes the SSRF / metadata-pivot and proxy-takeover
    vectors where a registered upstream is pointed at the Conduit host itself or
    any cloud instance metadata service.

    Args:
        ip: The parsed IPv4 or IPv6 address.

    Returns:
        True if the address is in a blocked range, False if it is an allowed
        routable destination.
    """
    return (
        ip in _BLOCKED_METADATA_IPS
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_unspecified
        or ip.is_multicast
        or ip.is_reserved
    )


def _host_in_allowlist(host: str, resolved: list[ipaddress.IPv4Address | ipaddress.IPv6Address]) -> bool:
    """Return True when an upstream host is permitted by the operator allowlist.

    A host matches when its literal name equals an allowlist entry, or when
    every resolved address is contained in an allowlist CIDR network. When the
    allowlist is empty this returns True (no allowlist configured); the caller
    still enforces the blocked-range guard separately.

    Args:
        host: The requested upstream hostname or IP literal.
        resolved: The IP addresses ``host`` resolves to.

    Returns:
        True if the host is allowed by the configured allowlist (or none is set).
    """
    if not ALLOWED_UPSTREAMS:
        return True
    for entry in ALLOWED_UPSTREAMS:
        if entry == host:
            return True
        try:
            network = ipaddress.ip_network(entry, strict=False)
        except ValueError:
            continue
        if resolved and all(
            addr.version == network.version and addr in network for addr in resolved
        ):
            return True
    return False


def _validate_upstream_host(host: str) -> str:
    """Validate a reverse-proxy upstream host, rejecting SSRF-prone targets.

    Strips an optional ``:port`` suffix, resolves the host to its IP addresses,
    and rejects any host that resolves into a loopback, link-local (incl. the
    169.254.169.254 metadata endpoint), unspecified, or reserved range. When
    ``CONDUIT_ALLOWED_UPSTREAMS`` is set the host must additionally match the
    operator allowlist. This must run before the host is written into a Caddy
    ``reverse_proxy`` block so a registration cannot turn Conduit into an open
    proxy or pivot to cloud instance metadata.

    Args:
        host: The upstream host as submitted, optionally including ``:port``.

    Returns:
        The validated host (without the port suffix).

    Raises:
        HTTPException: 422 when the host cannot be resolved, resolves into a
            blocked range, or is not permitted by the configured allowlist.
    """
    # Separate an optional :port suffix. IPv6 literals are not accepted here
    # because the registry/Caddy block uses host:port and bare v6 is ambiguous.
    bare = host.rsplit(":", 1)[0] if host.count(":") == 1 else host

    # A literal IP is validated directly; a name is resolved (DNS rebinding is
    # mitigated because every resolved address must pass, and the bash layer
    # re-validates at write time as defense in depth).
    try:
        literal = ipaddress.ip_address(bare)
        resolved = [literal]
    except ValueError:
        try:
            infos = socket.getaddrinfo(bare, None)
        except (socket.gaierror, UnicodeError, OSError):
            raise HTTPException(422, "Upstream host does not resolve")
        resolved = []
        for info in infos:
            try:
                resolved.append(ipaddress.ip_address(info[4][0]))
            except ValueError:
                continue
        if not resolved:
            raise HTTPException(422, "Upstream host does not resolve to a valid address")

    for addr in resolved:
        if _is_blocked_ip(addr):
            raise HTTPException(
                422,
                "Upstream host is in a blocked range "
                "(loopback, link-local/metadata, unspecified, or reserved)",
            )

    if not _host_in_allowlist(bare, resolved):
        raise HTTPException(422, "Upstream host is not in the configured allowlist")

    return bare


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class ServiceRegister(BaseModel):
    name: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_-]*$")
    host: str = Field(..., min_length=3, max_length=255, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9._:-]*$")
    health_path: str = Field(default="/", max_length=256, pattern=r"^/[a-zA-Z0-9/_.-]*$")
    no_tls: bool = False
    # Re-registering an existing service name is an explicit, audited override:
    # without this flag a second register call for a live name is rejected so a
    # caller cannot silently repoint an existing route to a new upstream.
    overwrite: bool = False


class DnsResolve(BaseModel):
    domain: str = Field(..., min_length=1, max_length=255, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9._-]*$")


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------


async def verify_api_key(x_api_key: str = Header(default="")) -> None:
    """Verify the API key for read-only endpoints.

    When ``CONDUIT_API_KEY`` is set the key is enforced for every request.
    When it is unset (dev mode) read-only endpoints allow anonymous access;
    privileged endpoints separately enforce ``require_privileged`` which fails
    closed regardless of dev mode.

    Args:
        x_api_key: The ``X-API-Key`` request header value.

    Raises:
        HTTPException: 401 when a key is configured but the header is absent or
            does not match in constant time.
    """
    if not API_KEY:
        return  # No key configured: dev mode, read-only endpoints allow all.
    if not x_api_key or not hmac.compare_digest(x_api_key, API_KEY):
        raise HTTPException(401, "Invalid or missing API key")


async def require_privileged(x_api_key: str = Header(default="")) -> None:
    """Fail-closed authentication gate for privileged, state-changing endpoints.

    Privileged endpoints are sudo-backed or reconfigure routing/TLS (CA trust
    install, Caddy reload, service register/deregister, cert rotate, DNS flush).
    These MUST never be reachable anonymously, so when no key is configured the
    request is refused (503) rather than allowed: the operator is told to set
    ``CONDUIT_API_KEY`` before exposing privileged operations.

    Args:
        x_api_key: The ``X-API-Key`` request header value.

    Raises:
        HTTPException: 503 when no key is configured (privileged surface is
            sealed until the operator sets one); 401 when a key is configured
            but the header is absent or does not match in constant time.
    """
    if not API_KEY:
        raise HTTPException(
            503,
            "Privileged endpoint disabled: set CONDUIT_API_KEY to enable "
            "state-changing and sudo-backed operations.",
        )
    if not x_api_key or not hmac.compare_digest(x_api_key, API_KEY):
        raise HTTPException(401, "Invalid or missing API key")


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="QP Conduit",
    version="0.2.0",
    dependencies=[Depends(verify_api_key)],
)

import logging as _logging
_log = _logging.getLogger("conduit")

if not API_KEY:
    _log.warning(
        "CONDUIT_API_KEY is not set (dev mode). Read-only endpoints allow "
        "anonymous access; privileged, state-changing and sudo-backed endpoints "
        "fail closed (HTTP 503) until a key is set. Set CONDUIT_API_KEY in your "
        "environment to enable privileged operations for production deployments."
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
# Rate limiting (simple in-memory, no external dependency)
# ---------------------------------------------------------------------------

_rate_buckets: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT = int(os.environ.get("CONDUIT_RATE_LIMIT", "60"))  # requests per minute
RATE_WINDOW = 60.0  # seconds


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Simple per-IP rate limiter. Skips for /api/ping and static assets."""
    path = request.url.path
    if path.startswith("/assets") or path == "/api/ping":
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()

    # Prune old entries and evict empty buckets to prevent memory growth
    bucket = [t for t in _rate_buckets[client_ip] if now - t < RATE_WINDOW]
    if bucket:
        _rate_buckets[client_ip] = bucket
    else:
        _rate_buckets.pop(client_ip, None)

    if len(_rate_buckets.get(client_ip, [])) >= RATE_LIMIT:
        return JSONResponse(
            {"error": "Rate limit exceeded. Try again later."},
            status_code=429,
            headers={"Retry-After": "60"},
        )

    _rate_buckets[client_ip].append(now)
    response = await call_next(request)

    # Security headers on every response
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if not path.startswith("/assets"):
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-ancestors 'none'"
        )

    return response


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


_PATH_PATTERN = re.compile(r"(/[\w./-]{3,})")


def _sanitize_output(text: str) -> str:
    """Strip absolute file paths and stack traces from shell output before returning to client."""
    lines = []
    for line in text.splitlines():
        # Skip lines that look like stack traces or internal error details
        if line.strip().startswith("Traceback") or line.strip().startswith("File "):
            continue
        # Redact absolute paths
        line = _PATH_PATTERN.sub("[path]", line)
        lines.append(line)
    return "\n".join(lines)


def _run(script: str, *args: str, timeout: int = 30) -> dict:
    """Run a conduit script and return its sanitized result.

    Both stdout and stderr are passed through ``_sanitize_output`` (which strips
    absolute paths and stack traces) before being returned, so no internal
    filesystem detail leaks to the client.

    Args:
        script: The conduit script filename to execute (resolved under HERE).
        *args: Positional arguments passed to the script.
        timeout: Maximum seconds to wait before killing the process.

    Returns:
        A dict with ``ok`` (bool), ``stdout`` (str), ``stderr`` (str), and
        ``exit_code`` (int). ``exit_code`` is -1 on timeout or missing script.
    """
    cmd = [str(HERE / script)] + list(args)
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, cwd=str(HERE)
        )
        return {
            "ok": result.returncode == 0,
            "stdout": _sanitize_output(result.stdout),
            "stderr": _sanitize_output(result.stderr),
            "exit_code": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "stdout": "", "stderr": "Command timed out", "exit_code": -1}
    except FileNotFoundError:
        return {"ok": False, "stdout": "", "stderr": "Script not found", "exit_code": -1}


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


def _audit_capsule(action: str, status: str, message: str, details: dict | None = None) -> None:
    """Append a structured audit entry and seal it as a tamper-evident Capsule.

    Mirrors the bash ``audit_log`` (lib/audit.sh) so a privileged operation
    performed directly in the Python layer (e.g. the Caddy reload, which calls
    the admin API via curl rather than a conduit-* script) still leaves the same
    immutable audit/capsule record that ``cert_rotate`` and ``dns_flush`` emit.
    The JSONL line is always written (it is the durable audit record); the
    Capsule seal is best-effort and fails open when ``qp-capsule`` is absent or
    air-gapped, matching the bash ``_capsule_seal`` behaviour.

    Args:
        action: The audit action name (e.g. ``"caddy_reload"``).
        status: ``"success"`` or ``"failure"``.
        message: Human-readable description of the operation.
        details: Optional JSON-serialisable detail object merged into the entry.

    Returns:
        None. Failures to write or seal are swallowed so an audit-path problem
        can never break the privileged operation it records.
    """
    entry = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "action": action,
        "status": status,
        "message": message,
        "user": os.environ.get("USER") or os.environ.get("LOGNAME") or "unknown",
        "details": details or {},
    }
    line = json.dumps(entry, separators=(",", ":"))

    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        # Owner-only: the audit log records privileged, security-relevant events.
        if not AUDIT_PATH.exists():
            AUDIT_PATH.touch(mode=0o600)
        with AUDIT_PATH.open("a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except OSError as exc:
        _log.warning("Failed to write audit entry for %s: %s", action, exc)
        return

    # Best-effort Capsule seal (tamper evidence). Air-gap safe: never installs
    # qp-capsule and never reaches the network; silently skips when unavailable.
    try:
        subprocess.run(
            ["qp-capsule", "seal", "--db", str(CONFIG_DIR / "capsules.db")],
            input=line,
            text=True,
            capture_output=True,
            timeout=5,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as exc:
        _log.debug("Capsule seal skipped for %s: %s", action, exc)


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


@app.post("/api/services", dependencies=[Depends(require_privileged)])
def register_service(body: ServiceRegister):
    """Register a new service (privileged: writes routing/TLS config).

    Constrains the reverse-proxy upstream to a non-blocked, allowlisted host so
    a registration cannot turn Conduit into an open proxy or pivot to cloud
    instance metadata. Re-registering an existing service name requires the
    explicit ``overwrite`` flag so a live route cannot be silently repointed.

    Args:
        body: The validated registration request.

    Returns:
        The sanitized result of the underlying ``conduit-register.sh`` run.

    Raises:
        HTTPException: 422 when the upstream host is blocked or not allowlisted;
            409 when the name already exists and ``overwrite`` was not set.
    """
    # SSRF / proxy-takeover guard: resolve and range-check the upstream before
    # it is ever written into a Caddy reverse_proxy block.
    _validate_upstream_host(body.host)

    # Re-registration of an existing live service requires an explicit override.
    existing = _read_json(REGISTRY_PATH, {"services": []}).get("services", [])
    if any(s.get("name") == body.name for s in existing) and not body.overwrite:
        raise HTTPException(
            409,
            f"Service '{body.name}' already registered. "
            "Set overwrite=true to repoint an existing route.",
        )

    args = ["--name", body.name, "--host", body.host]
    if body.health_path and body.health_path != "/":
        args += ["--health", body.health_path]
    if body.no_tls:
        args.append("--no-tls")

    result = _run("conduit-register.sh", *args)
    return result


@app.delete("/api/services/{name}", dependencies=[Depends(require_privileged)])
def deregister_service(name: str):
    """Deregister a service (privileged: removes routing config)."""
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


@app.post("/api/dns/flush", dependencies=[Depends(require_privileged)])
def flush_dns():
    """Flush DNS cache (privileged: mutates resolver state)."""
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


@app.post("/api/tls/{name}/rotate", dependencies=[Depends(require_privileged)])
def rotate_cert(name: str):
    """Rotate a certificate (privileged: regenerates key material)."""
    _validate_service_name(name)
    result = _run("conduit-certs.sh", "--rotate", name)
    return result


@app.get("/api/tls/{name}/inspect")
def inspect_cert(name: str):
    """Inspect a certificate."""
    _validate_service_name(name)
    result = _run("conduit-certs.sh", "--inspect", name)
    return {"ok": result["ok"], "output": result["stdout"]}


@app.post("/api/tls/trust", dependencies=[Depends(require_privileged)])
def trust_ca():
    """Install internal CA in system trust store (privileged: sudo-backed)."""
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


@app.post("/api/routing/reload", dependencies=[Depends(require_privileged)])
def reload_routing():
    """Reload Caddy configuration (privileged: reconfigures the proxy).

    Reloading the proxy is a privileged, routing-changing operation, so it emits
    an immutable audit/capsule record on every outcome (success, non-zero exit,
    or unreachable admin API), consistent with ``cert_rotate`` and ``dns_flush``.

    Returns:
        ``{"ok": bool}`` on a completed reload attempt, or
        ``{"ok": False, "error": ...}`` when the Caddy admin API is unreachable.
    """
    url = _caddy_admin_url()
    try:
        result = subprocess.run(
            ["curl", "-sf", "-X", "POST", f"http://{url}/load"],
            capture_output=True, timeout=5,
        )
        ok = result.returncode == 0
        _audit_capsule(
            "caddy_reload",
            "success" if ok else "failure",
            "Caddy configuration reloaded" if ok else "Caddy reload returned non-zero",
            {"admin": url, "exit_code": result.returncode},
        )
        return {"ok": ok}
    except (subprocess.TimeoutExpired, FileNotFoundError) as exc:
        _audit_capsule(
            "caddy_reload",
            "failure",
            "Caddy admin API unreachable during reload",
            {"admin": url, "error": type(exc).__name__},
        )
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


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    # Bind loopback-only by default so the privileged admin API is never exposed
    # on a routable interface unless the operator explicitly sets a non-loopback
    # CONDUIT_BIND_HOST. When the bind host is non-loopback, refuse to start
    # unless CONDUIT_API_KEY is configured, so a routable surface is never
    # served unauthenticated.
    try:
        _is_loopback_bind = ipaddress.ip_address(BIND_HOST).is_loopback
    except ValueError:
        _is_loopback_bind = BIND_HOST == "localhost"

    if not _is_loopback_bind and not API_KEY:
        raise SystemExit(
            "Refusing to start: CONDUIT_BIND_HOST is non-loopback "
            f"({BIND_HOST!r}) but CONDUIT_API_KEY is unset. Set an API key "
            "before exposing the admin server on a routable interface."
        )

    uvicorn.run(app, host=BIND_HOST, port=BIND_PORT)
