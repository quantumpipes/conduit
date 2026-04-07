---
title: "QP Conduit Deployment Guide"
description: "Deployment guide for QP Conduit covering Docker, air-gapped, multi-server, and production environments. Includes integration with QP Tunnel and QP Core."
date_modified: "2026-04-04"
ai_context: |
  Deployment guide for QP Conduit. Docker via docker-compose.yml (port 9999),
  air-gapped setup (no internet), multi-server monitoring over SSH, integration
  with QP Tunnel (WireGuard) and QP Core (FastAPI), systemd service files,
  backup/restore, and upgrade procedures.
related:
  - ./guide.md
  - ./architecture.md
  - ./network-guide.md
  - ./security.md
---

# Deployment Guide

## Docker (Recommended)

The simplest deployment uses Docker Compose. The included `docker-compose.yml` builds a multi-stage image (Node 22 for the UI, Python 3.14 for the server) and exposes the dashboard on port 9999.

### Quick Start

```bash
# Start in development mode (foreground, with logs)
make dev

# Start in background
make go

# Stop
make stop

# View logs
make logs

# Rebuild after code changes
make refresh
```

### docker-compose.yml Explained

```yaml
services:
  app:
    build: .                          # Multi-stage Dockerfile
    container_name: qp-conduit
    ports:
      - "9999:9999"                   # Dashboard + API
    volumes:
      - ./server.py:/app/server.py    # Live reload for server changes
      - ./conduit-*.sh:/app/...       # Live reload for scripts
      - ./lib:/app/lib                # Live reload for lib modules
      - ~/.config/qp-conduit:/root/.config/qp-conduit  # Persistent state
      - /var/run/docker.sock:/var/run/docker.sock       # Container monitoring
    environment:
      - CONDUIT_APP_NAME=qp-conduit
      - CONDUIT_CONFIG_DIR=/root/.config/qp-conduit
      - CONDUIT_CADDY_ADMIN=host.docker.internal:2019
    extra_hosts:
      - "host.docker.internal:host-gateway"
    restart: unless-stopped
```

Key design decisions:

- **Shell scripts are volume-mounted** so changes take effect on the next API call without rebuilding
- **Config directory is mounted** from the host, so state persists across container restarts
- **Docker socket is mounted** for container monitoring (read-only queries only)
- **host.docker.internal** resolves to the host machine, allowing the container to reach Caddy's admin API

### Environment Variables

Override defaults with a `.env` file or environment variables:

| Variable | Default | Description |
|---|---|---|
| `CONDUIT_APP_NAME` | `qp-conduit` | Application name |
| `CONDUIT_CONFIG_DIR` | `~/.config/qp-conduit` | Configuration directory on host |
| `CONDUIT_CADDY_ADMIN` | `host.docker.internal:2019` | Caddy admin API address |
| `CONDUIT_DOCKER_SOCKET` | `/var/run/docker.sock` | Docker socket path |

---

## Air-Gapped Deployment

Conduit operates with zero internet connectivity after initial setup. For air-gapped environments:

### Pre-Stage Dependencies

On a machine with internet access, download:

1. Caddy binary (single static binary from [caddyserver.com/download](https://caddyserver.com/download))
2. dnsmasq (from your distribution's package repository)
3. jq binary (single static binary from [jqlang.github.io/jq/download](https://jqlang.github.io/jq/download))
4. The Conduit repository (git clone or tarball)
5. Python 3.14 and pip packages: `pip download -r requirements.txt -d packages/`
6. Node 22 and npm packages: `cd ui && npm pack` (for UI pre-build)

Transfer all files to the air-gapped network via approved media (USB, optical disc, cross-domain solution).

### Install on Air-Gapped Host

```bash
# Install pre-staged binaries
sudo cp caddy /usr/local/bin/
sudo cp jq /usr/local/bin/
sudo apt install ./dnsmasq*.deb  # or rpm, depending on distribution

# Install Python packages offline
pip install --no-index --find-links packages/ -r requirements.txt

# Pre-build the UI (or build on a staging machine and copy ui/dist/)
cd ui && npm ci --offline && npm run build && cd ..

# Initialize Conduit (no internet required)
./conduit-setup.sh --upstream-dns=127.0.0.1  # No upstream forwarding
```

### Air-Gap DNS Configuration

Set `CONDUIT_UPSTREAM_DNS=127.0.0.1` (or any local resolver) to prevent dnsmasq from attempting upstream queries. All DNS resolution is local.

```bash
./conduit-setup.sh --domain=facility.internal --upstream-dns=127.0.0.1
```

---

## Multi-Server Deployment

Conduit runs on a single gateway host but monitors multiple servers via SSH.

### Setup Remote Monitoring

1. Create a dedicated monitoring user on each remote server:
   ```bash
   sudo useradd -m -s /bin/bash conduit-monitor
   ```

2. Generate an SSH key on the Conduit gateway and distribute:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/conduit-monitor -N ""
   ssh-copy-id -i ~/.ssh/conduit-monitor conduit-monitor@10.0.1.20
   ```

3. Monitor remote servers:
   ```bash
   ./conduit-monitor.sh --server=conduit-monitor@10.0.1.20
   ./conduit-monitor.sh --server=conduit-monitor@10.0.1.30
   ```

### Register Remote Services

Register services running on other machines by specifying their IP:

```bash
./conduit-register.sh --name=ollama --host=10.0.1.20 --port=11434 --health=/api/tags
./conduit-register.sh --name=vllm --host=10.0.1.30 --port=8001 --health=/health
```

DNS resolves these names from any machine that uses Conduit's dnsmasq as its DNS server.

---

## Integration with QP Tunnel

Conduit and Tunnel run together on the same gateway host. Tunnel handles external access (WireGuard VPN), Conduit handles internal routing (DNS, TLS, reverse proxy).

### Setup

1. Set up Tunnel on the gateway host (see Tunnel documentation)
2. Set up Conduit:
   ```bash
   ./conduit-setup.sh --domain=qp.local
   ```
3. Register services:
   ```bash
   ./conduit-register.sh --name=core --host=127.0.0.1 --port=8000
   ./conduit-register.sh --name=hub --host=127.0.0.1 --port=8090
   ```

### Traffic Flow

```
Remote peer (WireGuard) -> Tunnel target (10.8.0.2) -> Conduit DNS + TLS -> Upstream service
```

Remote peers resolve `core.qp.local` via Conduit's dnsmasq. The request routes through Caddy with TLS termination. Caddy forwards to the upstream service.

### DNS Configuration for Tunnel Peers

Configure Tunnel peers to use the gateway host's IP as their DNS server. In the WireGuard client config:

```ini
[Interface]
DNS = 10.8.0.2
```

This routes all DNS queries through the tunnel to Conduit's dnsmasq.

---

## Integration with QP Core

Register QP Core services with Conduit for DNS, TLS, and monitoring:

```bash
# QP Core API
./conduit-register.sh --name=core --host=127.0.0.1 --port=8000

# QP Hub frontend
./conduit-register.sh --name=hub --host=127.0.0.1 --port=8090

# PostgreSQL (no TLS, uses its own encryption)
./conduit-register.sh --name=postgres --host=127.0.0.1 --port=5432 --no-tls

# Redis (no TLS)
./conduit-register.sh --name=redis --host=127.0.0.1 --port=6379 --no-tls

# Ollama LLM runtime
./conduit-register.sh --name=ollama --host=127.0.0.1 --port=11434 --health=/api/tags
```

Update QP Core's environment to use Conduit DNS names:

```bash
CORE_URL=https://core.qp.local
HUB_URL=https://hub.qp.local
OLLAMA_URL=https://ollama.qp.local
```

---

## Systemd Service (Production)

For production deployments without Docker, create systemd service files:

### Conduit Dashboard

```ini
# /etc/systemd/system/qp-conduit.service
[Unit]
Description=QP Conduit Admin Dashboard
After=network.target caddy.service

[Service]
Type=simple
User=conduit
Group=conduit
WorkingDirectory=/opt/qp-conduit
ExecStart=/usr/bin/uvicorn server:app --host 127.0.0.1 --port 9999
Restart=on-failure
RestartSec=5
Environment=CONDUIT_CONFIG_DIR=/etc/qp-conduit
Environment=CONDUIT_DIR=/opt/qp-conduit

[Install]
WantedBy=multi-user.target
```

### dnsmasq

```ini
# /etc/systemd/system/qp-conduit-dns.service
[Unit]
Description=QP Conduit DNS (dnsmasq)
After=network.target

[Service]
Type=forking
ExecStart=/usr/sbin/dnsmasq -C /etc/qp-conduit/dnsmasq.conf
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable --now qp-conduit qp-conduit-dns
```

---

## Backup and Restore

### What to Back Up

All state lives in the config directory (default: `~/.config/qp-conduit/`):

| File/Directory | Purpose | Priority |
|---|---|---|
| `services.json` | Service registry | Critical |
| `audit.log` | Audit trail | Critical |
| `capsules.db` | Tamper-evident Capsule database | Critical |
| `certs/root.crt` | CA public certificate | Critical |
| `certs/root.key` | CA private key | Critical |
| `certs/*/` | Per-service certificates | High |
| `conduit-hosts` | DNS hosts file | Low (regenerated) |
| `dnsmasq.conf` | dnsmasq config | Low (regenerated) |
| `Caddyfile` | Caddy config | Low (regenerated) |
| `routes/*.caddy` | Per-service routes | Low (regenerated) |

### Backup

```bash
# Full backup
tar czf conduit-backup-$(date +%Y%m%d).tar.gz ~/.config/qp-conduit/

# Critical files only
tar czf conduit-critical-$(date +%Y%m%d).tar.gz \
  ~/.config/qp-conduit/services.json \
  ~/.config/qp-conduit/audit.log \
  ~/.config/qp-conduit/capsules.db \
  ~/.config/qp-conduit/certs/root.crt \
  ~/.config/qp-conduit/certs/root.key
```

### Restore

```bash
tar xzf conduit-backup-20260404.tar.gz -C /
# Regenerate derived config
./conduit-setup.sh --skip-tls  # Regenerates Caddyfile and dnsmasq.conf
```

---

## Upgrading Conduit

1. Back up the config directory
2. Pull or download the new version
3. Rebuild if using Docker:
   ```bash
   make stop
   git pull
   make go
   ```
4. For native installs:
   ```bash
   pip install -r requirements.txt
   make ui-build
   ```
5. Verify services are healthy:
   ```bash
   ./conduit-status.sh
   ```

Conduit does not run database migrations. The `services.json` format is versioned (currently version 1). Future versions will include automatic migration if the schema changes.

---

## Related Documentation

- [Guide](./guide.md): Getting started walkthrough
- [Network Guide](./network-guide.md): DNS and TLS trust configuration
- [Architecture](./architecture.md): System design
- [Security](./security.md): Security evaluation and hardening
