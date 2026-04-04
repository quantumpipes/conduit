---
title: "QP Conduit Command Reference"
description: "Detailed reference for all 8 Conduit shell commands: preflight, setup, register, deregister, status, monitor, certs, and dns."
date_modified: "2026-04-04"
ai_context: |
  Complete reference for conduit-preflight.sh, conduit-setup.sh,
  conduit-register.sh, conduit-deregister.sh, conduit-status.sh,
  conduit-monitor.sh, conduit-certs.sh, conduit-dns.sh. Includes synopsis,
  options, environment variables, examples, exit codes, and audit actions.
related:
  - ./GUIDE.md
  - ./API.md
  - ./architecture.md
---

# Command Reference

All commands source `conduit-preflight.sh`, which loads environment from `.env.conduit`, applies defaults, initializes the registry, validates `jq` is installed, and sets an ERR trap for audit logging.

---

## conduit-preflight.sh

**Synopsis:**

```
source conduit-preflight.sh
```

**Description:** Pre-flight initialization sourced by all other commands. Not executed directly. Loads all library modules (`lib/common.sh`, `lib/registry.sh`, `lib/audit.sh`, `lib/dns.sh`, `lib/tls.sh`, `lib/routing.sh`), sources `.env.conduit`, applies default configuration, creates the config directory, initializes the service registry, validates `jq` is on PATH, attempts to install `qp-capsule` via pip, verifies Capsule chain integrity, and sets an ERR trap that writes failure entries to the audit log.

**Guard:** Includes a double-source guard (`_CONDUIT_PREFLIGHT_LOADED`). Safe to source multiple times.

---

## conduit-setup.sh

**Synopsis:**

```
conduit-setup.sh [OPTIONS]
```

**Description:** Initialize QP Conduit on the local network. Configures dnsmasq for DNS resolution, Caddy for TLS and reverse proxying, and creates the service registry. Run once per gateway host.

**Options:**

| Flag | Description | Default |
|---|---|---|
| `--domain=DOMAIN` | Base domain for service DNS entries | `qp.local` |
| `--dns-port=PORT` | DNS listen port | `53` |
| `--proxy-port=PORT` | HTTPS reverse proxy port | `443` |
| `--upstream-dns=IP` | Upstream DNS server for non-Conduit queries | `1.1.1.1` |
| `--skip-dns` | Skip dnsmasq configuration | |
| `--skip-tls` | Skip TLS CA initialization | |
| `-h`, `--help` | Show usage help | |

**Environment Variables:**

| Variable | Description |
|---|---|
| `CONDUIT_DOMAIN` | Alternative to `--domain` |
| `CONDUIT_DNS_PORT` | Alternative to `--dns-port` |
| `CONDUIT_PROXY_PORT` | Alternative to `--proxy-port` |
| `CONDUIT_UPSTREAM_DNS` | Alternative to `--upstream-dns` |
| `CONDUIT_CONFIG_DIR` | Configuration directory (default: `~/.config/qp-conduit`) |

**Examples:**

```bash
# Default setup
./conduit-setup.sh

# Custom domain and DNS port
./conduit-setup.sh --domain=lab.internal --dns-port=5353

# Skip DNS (configure dnsmasq separately)
./conduit-setup.sh --skip-dns
```

**Exit codes:** 0 on success, 1 on missing dependency or configuration failure.

**Audit action:** `setup` (success/failure)

---

## conduit-register.sh

**Synopsis:**

```
conduit-register.sh --name=NAME --host=HOST --port=PORT [OPTIONS]
```

**Description:** Register a service with QP Conduit. Creates a DNS entry, issues a TLS certificate, adds a Caddy reverse proxy route, and updates the service registry. Regenerates the Caddyfile and reloads Caddy.

**Options:**

| Flag | Description | Default |
|---|---|---|
| `--name=NAME` | Service name (required, `[a-zA-Z0-9_-]+`) | |
| `--host=HOST` | Upstream host IP or hostname (required) | |
| `--port=PORT` | Upstream port number (required, 1-65535) | |
| `--health=PATH` | Health check endpoint path | `/healthz` |
| `--protocol=PROTO` | Protocol: `http` or `https` | `https` |
| `--no-tls` | Skip TLS certificate issuance | |
| `-h`, `--help` | Show usage help | |

**Examples:**

```bash
# Register QP Core
./conduit-register.sh --name=core --host=127.0.0.1 --port=8000

# Register Grafana with custom health check
./conduit-register.sh --name=grafana --host=10.0.1.5 --port=3000 --health=/api/health

# Register without TLS (service handles its own TLS)
./conduit-register.sh --name=postgres --host=10.0.1.5 --port=5432 --no-tls
```

**Exit codes:** 0 on success, 1 on validation failure or duplicate service name.

**Audit action:** `service_register` (success/failure)

---

## conduit-deregister.sh

**Synopsis:**

```
conduit-deregister.sh --name=NAME
```

**Description:** Remove a service from QP Conduit. Removes the DNS entry, archives the TLS certificate (moves to `.revoked/`), removes the Caddy routing rule, and marks the service as inactive in the registry. The service entry is never deleted from `services.json`, preserving audit history.

**Options:**

| Flag | Description |
|---|---|
| `--name=NAME` | Service name to deregister (required) |
| `-h`, `--help` | Show usage help |

**Examples:**

```bash
# Deregister Grafana
./conduit-deregister.sh --name=grafana

# Verify it was removed
./conduit-status.sh
```

**Exit codes:** 0 on success, 1 if the service is not found or already inactive.

**Audit action:** `service_deregister` (success/failure)

---

## conduit-status.sh

**Synopsis:**

```
conduit-status.sh
```

**Description:** Display all registered services with live health status, DNS resolution status, and TLS certificate expiry dates. Performs active health checks against each service's health endpoint using `curl` with a 3-second timeout.

**Options:**

| Flag | Description |
|---|---|
| `-h`, `--help` | Show usage help |

**Output columns:**

| Column | Description |
|---|---|
| NAME | Service name |
| UPSTREAM | Host IP |
| PORT | Upstream port |
| HEALTH | `healthy`, `down`, or `unknown` |
| TLS EXPIRY | Certificate expiration date (first 12 chars) |
| DNS | `ok` or `fail` (resolution via `host`, `getent`, or `dig`) |

**Examples:**

```bash
# Show all services
./conduit-status.sh

# Pipe to grep for failing services
./conduit-status.sh 2>/dev/null | grep -i down
```

**Exit codes:** 0 always (status is informational).

**Audit action:** `health_check` (success)

---

## conduit-monitor.sh

**Synopsis:**

```
conduit-monitor.sh [OPTIONS]
```

**Description:** Show server hardware statistics: CPU, memory, disk usage, GPU utilization, and Docker container stats. Runs locally by default, or on a remote server via SSH.

**Options:**

| Flag | Description |
|---|---|
| `--server=SSH_HOST` | Monitor a remote server via SSH (e.g., `user@10.0.1.5`) |
| `-h`, `--help` | Show usage help |

**Sections displayed:**

| Section | Source | Requires |
|---|---|---|
| Hostname and uptime | `hostname`, `uptime` | Always available |
| CPU | `nproc` + `/proc/loadavg` (Linux), `sysctl` (macOS) | Always available |
| Memory | `free -h` (Linux), `sysctl` + `vm_stat` (macOS) | Always available |
| Disk | `df -h /` | Always available |
| GPU | `nvidia-smi` | NVIDIA GPU + driver |
| Docker | `docker stats --no-stream` | Docker daemon |

**Examples:**

```bash
# Local machine
./conduit-monitor.sh

# Remote GPU server
./conduit-monitor.sh --server=root@gpu-server.qp.local

# Remote server by IP
./conduit-monitor.sh --server=operator@10.0.1.20
```

**Exit codes:** 0 on success, non-zero if SSH connection fails.

**Audit action:** None (read-only operation).

---

## conduit-certs.sh

**Synopsis:**

```
conduit-certs.sh [OPTIONS]
```

**Description:** Manage TLS certificates for registered services. With no options, lists all certificates and their expiry dates.

**Options:**

| Flag | Description |
|---|---|
| `--rotate=NAME` | Revoke and reissue certificate for a service |
| `--inspect=NAME` | Show detailed certificate information (full `openssl x509 -text`) |
| `--trust` | Install the internal CA in the system trust store |
| `-h`, `--help` | Show usage help |

**List output columns:**

| Column | Description |
|---|---|
| SERVICE | Service name (directory name under `certs/`) |
| EXPIRES | Certificate expiration date |
| DOMAIN | Certificate common name (CN) |

**Examples:**

```bash
# List all certificates
./conduit-certs.sh

# Rotate a certificate
./conduit-certs.sh --rotate=core

# Inspect certificate details
./conduit-certs.sh --inspect=core

# Trust the CA (requires sudo)
./conduit-certs.sh --trust
```

**Exit codes:** 0 on success, 1 if certificate not found or CA not initialized.

**Audit actions:**

| Action | When |
|---|---|
| `cert_rotate` | After successful rotation |

---

## conduit-dns.sh

**Synopsis:**

```
conduit-dns.sh [OPTIONS]
```

**Description:** Manage DNS entries for registered services. With no options, lists all DNS entries from the Conduit hosts file.

**Options:**

| Flag | Description |
|---|---|
| `--flush` | Clear the dnsmasq DNS cache (sends SIGHUP) |
| `--resolve=NAME` | Test DNS resolution for a service using `host`, `getent`, or `dig` |
| `-h`, `--help` | Show usage help |

**List output columns:**

| Column | Description |
|---|---|
| HOSTNAME | Fully qualified domain name (e.g., `core.qp.local`) |
| IP | Resolved IP address |

**Examples:**

```bash
# List all DNS entries
./conduit-dns.sh

# Flush DNS cache
./conduit-dns.sh --flush

# Test resolution
./conduit-dns.sh --resolve=core
```

**Exit codes:** 0 on success, 1 if dnsmasq is not running (for flush/resolve).

**Audit actions:**

| Action | When |
|---|---|
| `dns_flush` | After successful cache flush |

---

## Make Targets

All commands have equivalent Make targets for convenience:

| Make Target | Command | Extra Variables |
|---|---|---|
| `make conduit-setup` | `conduit-setup.sh` | |
| `make conduit-register` | `conduit-register.sh` | `NAME=`, `HOST=`, `HEALTH=`, `NO_TLS=` |
| `make conduit-deregister` | `conduit-deregister.sh` | `NAME=` |
| `make conduit-status` | `conduit-status.sh` | |
| `make conduit-monitor` | `conduit-monitor.sh` | `SERVER=` |
| `make conduit-certs` | `conduit-certs.sh` | |
| `make conduit-certs-rotate` | `conduit-certs.sh --rotate` | `NAME=` |
| `make conduit-certs-inspect` | `conduit-certs.sh --inspect` | `NAME=` |
| `make conduit-certs-trust` | `conduit-certs.sh --trust` | |
| `make conduit-dns` | `conduit-dns.sh` | |
| `make conduit-dns-flush` | `conduit-dns.sh --flush` | |
| `make conduit-dns-resolve` | `conduit-dns.sh --resolve` | `DOMAIN=` |
| `make conduit-verify` | `qp-capsule verify` | |

**Example:**

```bash
make conduit-register NAME=grafana HOST=10.0.1.5:3000 HEALTH=/api/health
make conduit-status
make conduit-certs-rotate NAME=grafana
```

---

## Related Documentation

- [Guide](./GUIDE.md): Narrative walkthrough for new users
- [API Reference](./API.md): REST API that wraps these commands
- [Architecture](./architecture.md): Technical design and system overview
