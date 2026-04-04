---
title: "QP Conduit: The Complete Guide"
description: "Narrative walkthrough for new users covering setup, service registration, DNS, TLS, monitoring, and day-to-day operations."
date_modified: "2026-04-04"
ai_context: |
  User-facing guide for QP Conduit. Covers initial setup (conduit-setup.sh),
  registering services (conduit-register.sh), DNS management, TLS certificate
  lifecycle, hardware monitoring (GPU, containers, servers), and routine
  operations. Prerequisites: bash 4+, jq, Caddy 2.10+, dnsmasq.
related:
  - ./architecture.md
  - ./COMMANDS.md
  - ./API.md
  - ./DEPLOYMENT.md
---

# QP Conduit: The Complete Guide

## Chapter 1: What Is Conduit

QP Conduit is the internal infrastructure layer for on-premises AI deployments. It provides four capabilities in one tool: DNS resolution (so services have human-readable names instead of IP addresses), TLS certificate management (so all internal traffic is encrypted), health-aware reverse proxy routing (so requests reach the right service and avoid unhealthy ones), and hardware monitoring (so you know when a GPU overheats or a container restarts). You install it on one gateway host, register your services, and every service gets a name, a certificate, a route, and monitoring. No Kubernetes. No cloud dependencies. No database server. Just shell scripts, Caddy, dnsmasq, and jq.

## Chapter 2: How It Relates to Tunnel

QP Tunnel and QP Conduit are complementary layers. Tunnel sits at the network boundary and handles external access: remote users connect through a WireGuard VPN to reach the internal network. Conduit sits inside the boundary and handles internal routing: once traffic arrives on the LAN, Conduit resolves DNS names, terminates TLS, and forwards requests to the correct upstream service.

Tunnel gets you in. Conduit connects everything inside.

You can run either tool independently. Conduit works without Tunnel for local-only deployments. Tunnel works without Conduit for direct IP access. Together, they provide a complete access and routing layer with a unified audit trail.

## Chapter 3: Prerequisites

Before running Conduit, install these four dependencies:

| Tool | Version | Purpose |
|---|---|---|
| `bash` | 4.0+ | Shell runtime for all scripts |
| `jq` | 1.6+ | JSON processing for the service registry and audit log |
| `caddy` | 2.10+ | TLS termination, reverse proxy, internal certificate authority |
| `dnsmasq` | 2.80+ | Internal DNS resolution |

Optional tools:

| Tool | Purpose |
|---|---|
| `openssl` | Certificate inspection and manual issuance |
| `qp-capsule` | Tamper-evident audit sealing (auto-installs via pip) |
| `nvidia-smi` | GPU monitoring |
| `docker` | Container monitoring |
| `ssh` | Remote server monitoring |

Verify your installation:

```bash
bash --version
jq --version
caddy version
dnsmasq --version
```

## Chapter 4: Initial Setup

Run `conduit-setup.sh` to initialize Conduit on your gateway host:

```bash
./conduit-setup.sh
```

This command performs six steps:

1. Creates the configuration directory at `~/.config/qp-conduit/` with mode 700
2. Initializes the service registry (`services.json`) with an empty services array
3. Configures dnsmasq with a generated `dnsmasq.conf` (local-only DNS, no upstream forwarding)
4. Initializes the internal TLS CA using Caddy (Ed25519 root certificate, 10-year validity)
5. Generates the initial Caddyfile with global configuration
6. Writes the first audit log entry

You can customize the setup with flags:

```bash
./conduit-setup.sh --domain=lab.internal --dns-port=5353 --upstream-dns=8.8.8.8
```

Or use environment variables in `.env.conduit`:

```bash
cp .env.conduit.example .env.conduit
# Edit .env.conduit with your values
```

After setup completes, start the infrastructure services:

```bash
dnsmasq -C ~/.config/qp-conduit/dnsmasq.conf
caddy run --config ~/.config/qp-conduit/Caddyfile
```

## Chapter 5: Registering Your First Service

Register a service with `conduit-register.sh`. You provide the name, host IP, and port:

```bash
./conduit-register.sh --name=core --host=127.0.0.1 --port=8000
```

This command does six things in sequence:

1. Adds a DNS entry mapping `core.qp.local` to `127.0.0.1`
2. Issues a TLS certificate for `core.qp.local` signed by the internal CA
3. Creates a Caddy reverse proxy route from `core.qp.local:443` to `127.0.0.1:8000`
4. Adds the service to `services.json` with status "active"
5. Regenerates the Caddyfile and reloads Caddy
6. Writes an audit entry for the registration

Your service is now accessible at `https://core.qp.local`. Caddy handles TLS termination, so the upstream service can run plain HTTP.

## Chapter 6: Adding More Services

Register additional services with the same command. Each gets its own DNS entry, TLS certificate, and reverse proxy route:

```bash
./conduit-register.sh --name=ollama --host=10.0.1.20 --port=11434 --health=/api/tags
./conduit-register.sh --name=grafana --host=10.0.1.5 --port=3000 --health=/api/health
./conduit-register.sh --name=hub --host=127.0.0.1 --port=8090
```

Use the `--health` flag to specify a custom health check endpoint. The default is `/healthz`. Caddy probes this endpoint every 30 seconds.

If a service does not need TLS (for example, it handles TLS itself), use `--no-tls`:

```bash
./conduit-register.sh --name=postgres --host=10.0.1.5 --port=5432 --no-tls
```

## Chapter 7: Checking Status and Health

Run `conduit-status.sh` to see all registered services with health, TLS, and DNS information:

```bash
./conduit-status.sh
```

Output shows a table with columns for name, upstream host, port, health status, TLS certificate expiry, and DNS resolution status. The script performs live health checks against each service's health endpoint.

For DNS-specific information:

```bash
./conduit-dns.sh                     # List all DNS entries
./conduit-dns.sh --resolve=core      # Test resolution for a specific service
```

## Chapter 8: Certificate Management

List all certificates with their expiry dates:

```bash
./conduit-certs.sh
```

Rotate a certificate (revoke the old one, issue a new one):

```bash
./conduit-certs.sh --rotate=grafana
```

Inspect a certificate's full details:

```bash
./conduit-certs.sh --inspect=core
```

Install the internal CA into your system's trust store so browsers trust your services without warnings:

```bash
./conduit-certs.sh --trust
```

On macOS, this adds the CA to the System Keychain. On Linux, it copies the CA cert to `/usr/local/share/ca-certificates/` and runs `update-ca-certificates`.

## Chapter 9: Monitoring Hardware

Run `conduit-monitor.sh` to see CPU, memory, disk usage, GPU stats, and Docker containers:

```bash
./conduit-monitor.sh                          # Local machine
./conduit-monitor.sh --server=root@10.0.1.20  # Remote server via SSH
```

The monitor collects:

- **CPU:** core count and load average
- **Memory:** total and used (via `free` on Linux, `sysctl` on macOS)
- **Disk:** usage of the root filesystem
- **GPU:** temperature, utilization, VRAM usage (requires `nvidia-smi`)
- **Docker:** container stats including CPU, memory, network I/O, and PID count

For remote monitoring, the script runs all commands over SSH with a 5-second connect timeout and batch mode (no interactive prompts).

## Chapter 10: Day-to-Day Operations

### Flush DNS Cache

After adding or removing services, flush the dnsmasq cache to ensure immediate resolution:

```bash
./conduit-dns.sh --flush
```

### Rotate Certificates

Rotate certificates on a regular schedule (every 90 days recommended). The `--rotate` flag archives the old certificate and issues a new one:

```bash
./conduit-certs.sh --rotate=core
./conduit-certs.sh --rotate=ollama
```

### Verify Audit Chain

If `qp-capsule` is installed, verify the tamper-evident audit chain:

```bash
qp-capsule verify --db ~/.config/qp-conduit/capsules.db
```

This confirms that no audit entries have been modified or deleted since they were sealed.

### Deregister a Service

When a service is retired, deregister it. This removes DNS, archives the TLS certificate, removes the route, and marks the service as inactive in the registry:

```bash
./conduit-deregister.sh --name=grafana
```

Deregistered services are never deleted from `services.json`. They remain with status "inactive" and a `deregistered_at` timestamp, preserving the audit history.

### Back Up State

All state lives in `~/.config/qp-conduit/`. Back up this directory to preserve your registry, audit log, CA certificates, and Capsule database:

```bash
tar czf conduit-backup-$(date +%Y%m%d).tar.gz ~/.config/qp-conduit/
```

### Use the Admin Dashboard

Start the admin dashboard with Docker for a visual overview:

```bash
make dev    # http://localhost:9999, with live logs
make go     # Background mode
```

The dashboard provides six views: Dashboard (global health overview), Services, DNS, TLS, Servers, and Routing. See [ADMIN-UI.md](./ADMIN-UI.md) for details.

---

## Related Documentation

- [Commands Reference](./COMMANDS.md): Detailed reference for all 8 scripts
- [API Reference](./API.md): REST API documentation for the admin server
- [Architecture](./architecture.md): Technical design and system overview
- [Deployment](./DEPLOYMENT.md): Docker, air-gap, and multi-server deployment guides
- [Admin UI](./ADMIN-UI.md): Dashboard documentation
