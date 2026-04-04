---
title: "QP Conduit REST API Reference"
description: "Complete REST API reference for the QP Conduit admin server (server.py). Documents all endpoints for status, services, DNS, TLS, servers, routing, and audit."
date_modified: "2026-04-04"
ai_context: |
  REST API reference for QP Conduit's FastAPI admin server (server.py).
  Endpoints grouped by: Status, Services, DNS, TLS, Servers, Routing, Audit.
  Server runs on port 9999 via uvicorn. Wraps conduit-*.sh scripts and reads
  services.json + audit.log directly. SPA fallback serves the React admin UI.
related:
  - ./ADMIN-UI.md
  - ./COMMANDS.md
  - ./GUIDE.md
---

# REST API Reference

The Conduit admin server (`server.py`) is a FastAPI application that wraps Conduit shell scripts and reads state files directly. It serves on port 9999 and provides the backend for the admin dashboard.

**Base URL:** `http://localhost:9999/api`

## Error Response Format

All error responses follow this structure:

```json
{
  "error": "Description of the error"
}
```

Script-wrapping endpoints return a standard result object:

```json
{
  "ok": true,
  "stdout": "Script output text",
  "stderr": "",
  "exit_code": 0
}
```

When `ok` is `false`, check `stderr` and `exit_code` for details.

---

## Status

### GET /api/status

Global Conduit health status. Returns the state of DNS, Caddy, services, certificates, and servers.

**Response:**

```json
{
  "dns": true,
  "caddy": true,
  "services": { "up": 3, "degraded": 0, "down": 1, "total": 4 },
  "certs": { "valid": 0, "expiring": 0, "expired": 0 },
  "servers": { "online": 0, "total": 0 },
  "last_audit": {
    "timestamp": "2026-04-04T12:00:00Z",
    "action": "service_register",
    "status": "success",
    "message": "Registered core",
    "user": "operator",
    "details": {}
  }
}
```

| Field | Type | Description |
|---|---|---|
| `dns` | boolean | Whether dnsmasq is running (checked via `pgrep`) |
| `caddy` | boolean | Whether Caddy admin API is reachable |
| `services` | object | Count of services by health status |
| `certs` | object | Count of certificates by validity status |
| `servers` | object | Count of monitored servers |
| `last_audit` | object/null | Most recent audit log entry |

**Status codes:** 200

**Example:**

```bash
curl -s http://localhost:9999/api/status | jq .
```

### GET /api/ping

Simple health check endpoint.

**Response:**

```json
{ "ok": true }
```

**Status codes:** 200

**Example:**

```bash
curl -s http://localhost:9999/api/ping
```

---

## Services

### GET /api/services

List all registered services from `services.json`.

**Response:**

```json
{
  "services": [
    {
      "name": "core",
      "host": "127.0.0.1",
      "port": 8000,
      "protocol": "https",
      "health_path": "/healthz",
      "status": "active",
      "health_status": "healthy",
      "last_health_check": "2026-04-04T12:00:00Z",
      "registered_at": "2026-04-04T10:00:00Z",
      "deregistered_at": null
    }
  ]
}
```

**Status codes:** 200

**Example:**

```bash
curl -s http://localhost:9999/api/services | jq '.services[] | .name'
```

### POST /api/services

Register a new service. Wraps `conduit-register.sh`.

**Request body:**

```json
{
  "name": "grafana",
  "host": "10.0.1.5",
  "health_path": "/api/health",
  "no_tls": false
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | string | yes | | Service name (`[a-zA-Z0-9_-]+`) |
| `host` | string | yes | | Upstream host IP or hostname |
| `health_path` | string | no | `/` | Health check endpoint path |
| `no_tls` | boolean | no | `false` | Skip TLS certificate issuance |

**Response:** Standard script result object.

**Status codes:** 200

**Example:**

```bash
curl -s -X POST http://localhost:9999/api/services \
  -H "Content-Type: application/json" \
  -d '{"name":"grafana","host":"10.0.1.5","health_path":"/api/health"}'
```

### DELETE /api/services/{name}

Deregister a service. Wraps `conduit-deregister.sh`.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `name` | string | Service name to deregister |

**Response:** Standard script result object.

**Status codes:** 200

**Example:**

```bash
curl -s -X DELETE http://localhost:9999/api/services/grafana
```

### GET /api/services/{name}/health

Check health of a specific service.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `name` | string | Service name |

**Response (success):**

```json
{
  "name": "core",
  "status": "active"
}
```

**Response (not found):**

```json
{
  "error": "Service 'unknown-svc' not found"
}
```

**Status codes:** 200, 404

**Example:**

```bash
curl -s http://localhost:9999/api/services/core/health
```

---

## DNS

### GET /api/dns

List all DNS entries. Wraps `conduit-dns.sh` (no arguments).

**Response:**

```json
{
  "ok": true,
  "output": "HOSTNAME                                 IP\n--------                                 --\ncore.qp.local                            127.0.0.1\n"
}
```

**Status codes:** 200

**Example:**

```bash
curl -s http://localhost:9999/api/dns | jq -r .output
```

### POST /api/dns/resolve

Resolve a domain name. Wraps `conduit-dns.sh --resolve`.

**Request body:**

```json
{
  "domain": "core"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `domain` | string | yes | Service name to resolve |

**Response:**

```json
{
  "ok": true,
  "domain": "core",
  "output": "core.qp.local has address 127.0.0.1\n"
}
```

**Status codes:** 200

**Example:**

```bash
curl -s -X POST http://localhost:9999/api/dns/resolve \
  -H "Content-Type: application/json" \
  -d '{"domain":"core"}'
```

### POST /api/dns/flush

Flush the dnsmasq DNS cache. Wraps `conduit-dns.sh --flush`.

**Response:** Standard script result object.

**Status codes:** 200

**Example:**

```bash
curl -s -X POST http://localhost:9999/api/dns/flush
```

---

## TLS

### GET /api/tls

List all TLS certificates with expiry dates. Wraps `conduit-certs.sh` (no arguments).

**Response:**

```json
{
  "ok": true,
  "output": "SERVICE                        EXPIRES              DOMAIN\n-------                        -------              ------\ncore                           Apr  4 12:00:00 2027 core.qp.local\n"
}
```

**Status codes:** 200

**Example:**

```bash
curl -s http://localhost:9999/api/tls | jq -r .output
```

### POST /api/tls/{name}/rotate

Rotate (revoke and reissue) a service certificate. Wraps `conduit-certs.sh --rotate`.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `name` | string | Service name |

**Response:** Standard script result object.

**Status codes:** 200

**Example:**

```bash
curl -s -X POST http://localhost:9999/api/tls/core/rotate
```

### GET /api/tls/{name}/inspect

Inspect a certificate's full details. Wraps `conduit-certs.sh --inspect`.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `name` | string | Service name |

**Response:**

```json
{
  "ok": true,
  "output": "=== Certificate: core ===\n\nCertificate:\n    Data:\n        Version: 3 (0x2)..."
}
```

**Status codes:** 200

**Example:**

```bash
curl -s http://localhost:9999/api/tls/core/inspect | jq -r .output
```

### POST /api/tls/trust

Install the internal CA certificate in the system trust store. Wraps `conduit-certs.sh --trust`. Requires sudo privileges.

**Response:** Standard script result object.

**Status codes:** 200

**Example:**

```bash
curl -s -X POST http://localhost:9999/api/tls/trust
```

---

## Servers

### GET /api/servers

List configured servers with hardware stats (CPU, memory, disk, GPU). Wraps `conduit-monitor.sh` with a 15-second timeout.

**Response:**

```json
{
  "ok": true,
  "output": "Host:   gpu-server-01\nUptime: 12:00:00 up 45 days...\n\n--- CPU ---\nCores: 32\nLoad:  4.2 3.8 3.5\n..."
}
```

**Status codes:** 200

**Example:**

```bash
curl -s http://localhost:9999/api/servers | jq -r .output
```

### GET /api/servers/containers

List Docker containers with stats. Wraps `conduit-monitor.sh --containers` with a 15-second timeout.

**Response:**

```json
{
  "ok": true,
  "output": "NAME            CPU%    MEM USAGE/LIMIT     NET I/O     PIDS\nqp-core         2.34%   512MiB / 16GiB      1.2MB / 800kB  24\n"
}
```

**Status codes:** 200

**Example:**

```bash
curl -s http://localhost:9999/api/servers/containers | jq -r .output
```

---

## Routing

### GET /api/routing

List all proxy routes. Reads `services.json` and constructs route objects.

**Response:**

```json
{
  "routes": [
    {
      "name": "core",
      "domain": "core.qp.local",
      "upstream": "127.0.0.1:8000",
      "tls": true,
      "health_status": "unknown",
      "response_time": null,
      "last_checked": null
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `name` | string | Service name |
| `domain` | string | FQDN for the route |
| `upstream` | string | Upstream `host:port` |
| `tls` | boolean | Whether TLS is enabled |
| `health_status` | string | `up`, `degraded`, `down`, or `unknown` |
| `response_time` | number/null | Last response time in milliseconds |
| `last_checked` | string/null | ISO 8601 timestamp of last health check |

**Status codes:** 200

**Example:**

```bash
curl -s http://localhost:9999/api/routing | jq '.routes[] | {name, domain, upstream}'
```

### POST /api/routing/reload

Reload the Caddy reverse proxy configuration via the Caddy admin API.

**Response:**

```json
{ "ok": true }
```

If Caddy is unreachable:

```json
{ "ok": false, "error": "Caddy admin API unreachable" }
```

**Status codes:** 200

**Example:**

```bash
curl -s -X POST http://localhost:9999/api/routing/reload
```

---

## Audit

### GET /api/audit

Retrieve recent audit log entries from `audit.log` (JSONL format). Returns entries in reverse chronological order.

**Query parameters:**

| Parameter | Type | Default | Range | Description |
|---|---|---|---|---|
| `limit` | integer | 50 | 1-500 | Maximum number of entries to return |

**Response:**

```json
{
  "entries": [
    {
      "timestamp": "2026-04-04T12:00:00Z",
      "action": "service_register",
      "status": "success",
      "message": "Registered service: core (127.0.0.1:8000)",
      "user": "operator",
      "details": {
        "name": "core",
        "host": "127.0.0.1",
        "port": "8000",
        "protocol": "https",
        "health_path": "/healthz",
        "tls": true
      }
    }
  ],
  "total": 1
}
```

**Status codes:** 200

**Example:**

```bash
# Last 10 entries
curl -s "http://localhost:9999/api/audit?limit=10" | jq '.entries[] | {action, status, timestamp}'

# All failure entries
curl -s "http://localhost:9999/api/audit?limit=100" | jq '[.entries[] | select(.status == "failure")]'
```

---

## SPA Fallback

All paths not matching `/api/*` serve the React admin dashboard from `ui/dist/`. If the UI has not been built, the server returns:

```json
{ "error": "UI not built. Run: make ui-build" }
```

**Status code:** 503

---

## Running the Server

### Docker (recommended)

```bash
make dev    # Starts on http://localhost:9999, with live logs
make go     # Starts in background
make stop   # Stops the container
```

### Native

```bash
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 9999 --reload
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CONDUIT_DIR` | Script directory | Path to Conduit scripts |
| `CONDUIT_CONFIG_DIR` | `~/.config/qp-conduit` | Configuration directory |
| `CONDUIT_APP_NAME` | `qp-conduit` | Application name (used in paths) |
| `CONDUIT_CADDY_ADMIN` | `localhost:2019` | Caddy admin API address |

---

## Related Documentation

- [Admin UI](./ADMIN-UI.md): Dashboard that consumes this API
- [Commands Reference](./COMMANDS.md): Shell scripts that the API wraps
- [Guide](./GUIDE.md): Getting started walkthrough
