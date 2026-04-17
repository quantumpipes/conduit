<div align="center">

# QP Conduit

**Internal infrastructure for on-premises AI deployments.**

Tunnel gets you in. Conduit connects everything inside. Automatic DNS, internal TLS, service routing, and hardware monitoring. Eight commands. Structured audit logging. Zero internet dependency.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Crypto](https://img.shields.io/badge/Crypto-Internal_CA_%2B_TLS_1.3-purple.svg)](#security)
[![Capsule](https://img.shields.io/badge/Audit-Capsule_Protocol-orange.svg)](https://github.com/quantumpipes/capsule)
[![Tests](https://img.shields.io/badge/Tests-225_passing-brightgreen.svg)](#admin-dashboard)
[![Coverage](https://img.shields.io/badge/Coverage-97%25-brightgreen.svg)](#admin-dashboard)
[![Admin UI](https://img.shields.io/badge/UI-React_19_%2B_OKLCH-ff69b4.svg)](#admin-dashboard)
[![AI Agents](https://img.shields.io/badge/AI%20Agents-AGENTS.md-blueviolet.svg)](./AGENTS.md)

</div>

> **AI coding agents:** start with [AGENTS.md](./AGENTS.md). It contains the 8-command shell surface, the FastAPI admin API, the React UI test gates, the bash + Python + TypeScript style rules, and the split-tunnel / auth-required invariants for the admin plane.

---

## The Problem

You deploy AI services on-premises. Each service needs a hostname, a TLS certificate, and health monitoring. Without automation, you configure dnsmasq by hand, generate certificates manually, write Caddy routes one at a time, and SSH into servers to check GPU utilization. Scale to five services and the maintenance burden is already unsustainable. Scale to twenty and something will break silently.

QP Conduit eliminates this with one-command service registration: DNS, TLS, and routing in a single operation, with continuous health monitoring and a cryptographic audit trail.

```
OUTSIDE              BOUNDARY              INSIDE
                                    ┌─────────────────────────────┐
┌──────────┐    ┌──────────────┐    │       QP Conduit            │
│  Remote   │    │              │    │                             │
│  Users    │────│  QP Tunnel   │────│  DNS:  grafana.internal     │
│           │    │  (WireGuard) │    │  TLS:  auto-cert via CA     │
└──────────┘    │              │    │  Route: reverse proxy        │
                └──────────────┘    │  Monitor: GPU/CPU/disk       │
                   Firewall         │  Health: container checks    │
                                    └─────────────────────────────┘
```

---

## Why QP Conduit

**One command, full stack.** Register a service and Conduit creates the DNS entry, generates a TLS certificate, configures the reverse proxy route, and starts health checks. One command. Done.

**Internal TLS everywhere.** Caddy's built-in CA generates certificates automatically for every registered service. No manual cert management. No expiry surprises. No external certificate authority.

**Automatic service discovery.** Services register with human-readable names. `grafana.internal` resolves to the right container. `hub.local` routes to the Hub. No IP addresses to remember.

**Hardware monitoring.** GPU utilization, CPU load, memory pressure, disk usage, container health. Monitor local and remote servers on the LAN via SSH. One dashboard for your entire deployment.

**Cryptographic audit trail.** Every registration, deregistration, certificate rotation, and health state change logged as structured JSON. Optional [Capsule Protocol](https://github.com/quantumpipes/capsule) integration seals each entry with SHA3-256 + Ed25519 for tamper evidence.

**Air-gap compatible.** Internal CA, local DNS, no external dependencies. Works in classified environments, air-gapped clinics, and disconnected field deployments.

**Pairs with QP Tunnel.** Tunnel handles the boundary (VPN access from outside). Conduit handles the interior (DNS, TLS, routing, monitoring). Together they form a complete networking layer for on-premises AI.

---

## Explore the fit with your AI coding agent

Paste this prompt into Claude Code, Cursor, Codex, or any other agent:

```text
Read the QP Conduit README and AGENTS.md at https://github.com/quantumpipes/conduit.
Then survey my on-premises infrastructure for services that need internal DNS, TLS
certificates, reverse proxying, or health monitoring. For each, show what a single
`conduit-register.sh` call would configure (DNS entry, Caddy route, cert issuance,
audit entry). Identify services currently reachable on raw IP:port and recommend the
migration order, with concrete hostnames and ports.
```

---

## Quick Start

```bash
# 1. Initialize Conduit on your network
./conduit-setup.sh

# 2. Register your first service
./conduit-register.sh --name grafana --host 10.0.1.50:3000

# 3. Verify it works
./conduit-status.sh
#   grafana.internal  →  10.0.1.50:3000  [healthy]  TLS ✓  DNS ✓
```

After setup, `grafana.internal` resolves via DNS, serves over HTTPS with an auto-generated certificate, and reports health status continuously.

```bash
# Register more services
./conduit-register.sh --name hub --host 10.0.1.10:4200
./conduit-register.sh --name api --host 10.0.1.10:8000
./conduit-register.sh --name ollama --host 10.0.1.20:11434

# Check everything
./conduit-status.sh
#   hub.local         →  10.0.1.10:4200   [healthy]  TLS ✓  DNS ✓
#   api.local         →  10.0.1.10:8000   [healthy]  TLS ✓  DNS ✓
#   ollama.internal   →  10.0.1.20:11434  [healthy]  TLS ✓  DNS ✓
#   grafana.internal  →  10.0.1.50:3000   [healthy]  TLS ✓  DNS ✓
```

---

## Commands

| Command | Description |
|---------|-------------|
| `conduit-setup.sh` | Initialize Conduit (install dnsmasq, configure Caddy, generate internal CA) |
| `conduit-register.sh --name <n> --host <ip:port>` | Register a service: DNS + TLS + routing in one step |
| `conduit-deregister.sh --name <n>` | Remove a service (DNS, route, and cert cleanup) |
| `conduit-status.sh` | Show all registered services with health, TLS, and DNS status |
| `conduit-monitor.sh` | Show server hardware stats (GPU, CPU, memory, disk) |
| `conduit-certs.sh` | List, rotate, or inspect TLS certificates |
| `conduit-dns.sh` | List or flush DNS entries |
| `conduit-logs.sh` | Aggregate and stream service logs |

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        QP Conduit                                  │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────────────┐ │
│  │ dnsmasq  │    │    Caddy     │    │   Monitor Daemon         │ │
│  │          │    │              │    │                          │ │
│  │ DNS      │    │ Internal CA  │    │ GPU (nvidia-smi)         │ │
│  │ resolver │    │ TLS certs    │    │ CPU / Memory / Disk      │ │
│  │          │    │ Reverse proxy│    │ Container health         │ │
│  │          │    │ Health checks│    │ Remote servers (SSH)     │ │
│  └────┬─────┘    └──────┬───────┘    └────────────┬─────────────┘ │
│       │                 │                         │               │
│       └────────┬────────┴─────────────────────────┘               │
│                │                                                   │
│         ┌──────┴──────┐                                           │
│         │  Registry   │  services.json                            │
│         │  + Audit    │  audit.log                                │
│         └─────────────┘  capsules.db (optional)                   │
└────────────────────────────────────────────────────────────────────┘
         │                    │                    │
    ┌────┴────┐         ┌────┴────┐         ┌─────┴─────┐
    │  Hub    │         │  Core   │         │  Ollama   │
    │ :4200   │         │ :8000   │         │ :11434    │
    └─────────┘         └─────────┘         └───────────┘
    hub.local           api.local           ollama.internal
```

**dnsmasq** resolves internal hostnames to service addresses. All DNS queries for registered services return the correct IP without any external lookup.

**Caddy** serves three roles: internal certificate authority, TLS termination, and reverse proxy. When a service registers, Caddy generates a certificate from its internal CA, configures a route, and starts health checking the upstream.

**Monitor Daemon** polls hardware metrics (GPU utilization via nvidia-smi, CPU/memory/disk via standard tools) and container health (via Docker socket). For remote servers on the LAN, it connects over SSH.

**Registry** is the single source of truth: a JSON file listing all registered services with their hostnames, upstreams, health status, and certificate metadata. The audit log records every mutation.

---

## Service Registration

Registration is atomic. One command creates the DNS entry, generates a TLS certificate, and configures the reverse proxy route:

```bash
./conduit-register.sh --name grafana --host 10.0.1.50:3000
```

**What happens:**
1. Adds `grafana.internal → 10.0.1.50` to dnsmasq configuration
2. Reloads dnsmasq to activate the DNS entry
3. Adds a reverse proxy route in Caddy (`grafana.internal → 10.0.1.50:3000`)
4. Caddy's internal CA auto-generates a TLS certificate for `grafana.internal`
5. Registers a health check against the upstream
6. Writes the service to `services.json`
7. Creates a Capsule audit record

Deregistration reverses all steps cleanly:

```bash
./conduit-deregister.sh --name grafana
```

---

## Internal TLS

Every registered service gets HTTPS automatically. No manual certificate management.

```
┌─────────────────────────────────────────────────────────┐
│                    Caddy Internal CA                     │
│                                                         │
│   Root CA: Ed25519 (generated at conduit-setup)         │
│   Per-service: auto-generated, auto-renewed             │
│   Trust: distribute root cert to clients once           │
│                                                         │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│   │ hub.local    │  │ api.local    │  │ grafana      │ │
│   │ TLS cert     │  │ TLS cert     │  │ .internal    │ │
│   │ (auto)       │  │ (auto)       │  │ TLS cert     │ │
│   └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Trust distribution:** After setup, install the root CA certificate on client machines. Conduit outputs trust commands for macOS, Linux, and Windows. Install once, trust all services forever.

**Certificate rotation:** Caddy handles renewal automatically. For manual inspection or forced rotation:

```bash
./conduit-certs.sh                    # List all certificates with expiry dates
./conduit-certs.sh --rotate grafana   # Force certificate rotation
./conduit-certs.sh --inspect grafana  # Show full certificate details
```

---

## Monitoring

### Hardware Stats

```bash
./conduit-monitor.sh
```

```
SERVER: 10.0.1.20 (gpu-server)
  GPU 0: NVIDIA H200  |  Util: 87%  |  Mem: 72.1/141.1 GB  |  Temp: 62°C
  GPU 1: NVIDIA H200  |  Util: 43%  |  Mem: 31.4/141.1 GB  |  Temp: 58°C
  CPU:   24/48 cores   |  Load: 12.3
  Memory: 189.2 / 256.0 GB (74%)
  Disk:   1.2 / 3.8 TB (32%)

SERVER: 10.0.1.10 (app-server)
  CPU:   8/16 cores    |  Load: 2.1
  Memory: 12.4 / 32.0 GB (39%)
  Disk:   45.2 / 500.0 GB (9%)
```

### Container Health

Conduit connects to the Docker socket for real-time container inspection:

```bash
./conduit-monitor.sh --containers
```

```
CONTAINER          STATUS     CPU    MEM       UPTIME
qp-hub             running    2.3%   384 MB    4d 12h
qp-core            running    8.7%   1.2 GB    4d 12h
qp-postgres        running    1.1%   256 MB    4d 12h
qp-redis           running    0.2%    48 MB    4d 12h
qp-ollama          running   45.2%   68.3 GB   4d 12h
qp-caddy           running    0.4%    32 MB    4d 12h
```

### Remote Servers

Monitor servers across your LAN via SSH. Configure targets in `.env.conduit`:

```bash
CONDUIT_REMOTE_SERVERS="10.0.1.20:gpu-server,10.0.1.30:inference-node"
```

---

## Audit System

Every operation writes a structured JSON entry to `audit.log`:

```json
{
  "timestamp": "2026-04-04T10:15:00Z",
  "action": "service_register",
  "status": "success",
  "message": "Registered grafana.internal → 10.0.1.50:3000",
  "user": "operator",
  "details": {"name": "grafana", "host": "10.0.1.50:3000", "tls": true, "dns": true}
}
```

Logged actions: `conduit_setup`, `service_register`, `service_deregister`, `cert_rotate`, `dns_flush`, `health_change`, `monitor_alert`, and all error traps.

### Capsule Protocol Integration

When [qp-capsule](https://github.com/quantumpipes/capsule) is installed, audit events are sealed as tamper-evident Capsules using SHA3-256 + Ed25519 signatures. This provides cryptographic proof that records have not been modified after creation.

```bash
pip install qp-capsule           # Or: auto-installs on first use
qp-capsule verify --db capsules.db   # Verify chain integrity
```

The JSON audit log is the fast local index. Capsules are the cryptographic source of truth. Golden test vectors for the audit format are in [`conformance/`](./conformance/).

---

## Admin Dashboard

Conduit includes a browser-based admin UI for managing your entire on-premises infrastructure visually.

```bash
make dev       # Start in Docker (http://localhost:9999)
make ui        # UI dev mode with hot reload (http://localhost:5173)
```

```
┌──────────────────────────────────────────────────────────────────────┐
│  QP Conduit            DNS ● Caddy ● 4/4 up ● 3 certs valid        │
├──────────┬───────────────────────────────────────────────────────────┤
│ Overview │                                                          │
│ ┌──────┐ │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│ │Dashbd│ │  │ Hub          │  │ Core API     │  │ Grafana      │   │
│ ├──────┤ │  │ ● hub.local  │  │ ● api.local  │  │ ● grafana    │   │
│ │Svc   │ │  │ :4200  TLS ✓ │  │ :8000  TLS ✓ │  │ .internal    │   │
│ │DNS   │ │  │ 12ms healthy │  │ 8ms  healthy │  │ 15ms healthy │   │
│ │TLS   │ │  └──────────────┘  └──────────────┘  └──────────────┘   │
│ ├──────┤ │                                                          │
│ │Server│ │  GPU Server (10.0.1.20)                                  │
│ │Route │ │  GPU 0: H200  87%  ███████░░  72/141 GB  62°C           │
│ └──────┘ │  GPU 1: H200  43%  ████░░░░░  31/141 GB  58°C           │
│          │  CPU: 24/48   Mem: 189/256 GB   Disk: 1.2/3.8 TB        │
└──────────┴───────────────────────────────────────────────────────────┘
```

**URL routing.** Each view has a dedicated URL (`/`, `/services`, `/dns`, `/tls`, `/servers`, `/routing`). Deep links, bookmarks, and browser back/forward all work.

**Blank slate.** First-time users see an interactive topology visualization with animated data packets, capability cards, and step-by-step getting started guidance. It disappears automatically when you register your first service.

**Six views.** Dashboard (health overview), Services (register/manage), DNS (entries + resolver), TLS (certificates + CA), Servers (GPU/CPU/memory), Routing (proxy routes). Each view has a rich empty state with feature descriptions and CLI commands.

**Tech.** React 19, TypeScript, Vite 6, TailwindCSS 4 (OKLCH perceptual color system), Zustand, TanStack Query. Node 24 + Python 3.14 in Docker. 225 tests, 97% coverage.

**Keyboard-first.** `1-6` switches views, `/` focuses search, `Esc` dismisses panels.

See [docs/admin-ui.md](./docs/admin-ui.md) for the full dashboard reference.

---

## Security

| Layer | Mechanism |
|-------|-----------|
| **TLS** | Internal CA (Ed25519) with auto-generated per-service certificates |
| **DNS** | Local dnsmasq, no external queries, no DNS-over-HTTPS dependency |
| **Routing** | Caddy reverse proxy with upstream health checks |
| **File protection** | umask 077 on all keys and CA material (owner-only, mode 600) |
| **Input validation** | Strict `[a-zA-Z0-9_-]` regex on service names (prevents injection) |
| **No eval** | Zero use of `eval` in the entire codebase |
| **Audit trail** | Every operation logged with timestamp, user, and result |
| **Tamper evidence** | Optional Capsule Protocol sealing (SHA3-256 + Ed25519) |
| **Isolation** | Services are independently routed; one failure does not cascade |
| **Certificate rotation** | Automatic renewal; manual rotation available on demand |

---

## Compliance

Conduit's internal TLS, DNS isolation, and audit logging contribute to controls across five regulatory frameworks. Each mapping documents which controls Conduit satisfies and which require complementary application-level controls.

| Framework | Controls | Focus |
|-----------|----------|-------|
| [HIPAA](./docs/compliance/hipaa.md) | 164.312(e)(1), 164.312(a)(1) | Transmission security, access control, audit |
| [CMMC 2.0](./docs/compliance/cmmc.md) | SC.L2-3.13.8, AU.L2-3.3.x | Network architecture, encrypted sessions, logging |
| [FedRAMP](./docs/compliance/fedramp.md) | SC-8, SC-12, AU-2/3 | Transmission confidentiality, key management |
| [SOC 2](./docs/compliance/soc2.md) | CC6.1, CC6.6, CC7.x | Logical access, network security, monitoring |
| [ISO 27001](./docs/compliance/iso27001.md) | A.8.20, A.8.21, A.8.24 | Network security, web filtering, cryptography |

---

## Configuration

Copy `.env.conduit.example` to `.env.conduit` and customize:

| Variable | Default | Description |
|----------|---------|-------------|
| `CONDUIT_APP_NAME` | `qp-conduit` | Config directory, log tags |
| `CONDUIT_DOMAIN` | `internal` | Default domain suffix for services |
| `CONDUIT_DNS_PORT` | `53` | dnsmasq listen port |
| `CONDUIT_DNS_UPSTREAM` | `127.0.0.1` | Upstream DNS for non-internal queries |
| `CONDUIT_CADDY_ADMIN` | `localhost:2019` | Caddy admin API address |
| `CONDUIT_CADDY_HTTPS_PORT` | `443` | HTTPS listen port |
| `CONDUIT_HEALTH_INTERVAL` | `30` | Health check interval in seconds |
| `CONDUIT_REMOTE_SERVERS` | (none) | Comma-separated `ip:label` pairs for remote monitoring |
| `CONDUIT_CONFIG_DIR` | `~/.config/qp-conduit` | State directory (registry, certs, audit) |
| `CONDUIT_DOCKER_SOCKET` | `/var/run/docker.sock` | Docker socket path for container monitoring |

All values are overridable via environment variables or `.env.conduit`.

---

## Dependencies

**Required:**

| Dependency | Purpose |
|------------|---------|
| `bash` 4.0+ | Shell runtime |
| `jq` | JSON processing for service registry |
| `caddy` 2.10+ | Internal CA, TLS termination, reverse proxy |
| `dnsmasq` | Local DNS resolution for internal hostnames |

**Optional:**

| Dependency | Purpose |
|------------|---------|
| `docker` | Container inspection and health monitoring |
| `nvidia-smi` | GPU utilization monitoring |
| `ssh` | Remote server monitoring across LAN |
| `qp-capsule` | Tamper-evident audit sealing (auto-installs via pip) |

---

## Documentation

| Document | Audience | Description |
|----------|----------|-------------|
| [Why Conduit](./docs/why-conduit.md) | Decision-Makers | The case for on-premises infrastructure mesh |
| [Guide](./docs/guide.md) | Operators | End-to-end walkthrough |
| [Architecture](./docs/architecture.md) | Developers, Auditors | Component model and data flow |
| [Admin UI](./docs/admin-ui.md) | Developers | Dashboard: routing, blank slate, design system, testing |
| [API Reference](./docs/api.md) | Developers | REST endpoints served by server.py |
| [Commands](./docs/commands.md) | Operators | Reference for all 8 CLI scripts |
| [Security Evaluation](./docs/security.md) | CISOs | Threat model and cryptographic guarantees |
| [Network Guide](./docs/network-guide.md) | Network Engineers | DNS, TLS trust, air-gap configuration |
| [Development](./docs/development.md) | Contributors | Prerequisites, testing, code style |
| [Deployment](./docs/deployment.md) | DevOps | Docker, air-gap, multi-server |
| [Compliance](./docs/compliance/) | Regulators, GRC | HIPAA, CMMC, FedRAMP, SOC 2, ISO 27001 |

### Examples

| Guide | Use Case |
|-------|----------|
| [Home Lab with GPU](./examples/home-lab-gpu.md) | Multi-GPU server with Ollama and Grafana |
| [Healthcare Clinic](./examples/healthcare-clinic.md) | Air-gapped clinic with EHR and AI diagnostics |
| [Defense Installation](./examples/defense-installation.md) | Classified environment, no internet, full audit |

---

## Project Structure

```
.
├── conduit-*.sh                 # 8 commands (setup, register, deregister, status, monitor, certs, dns, logs)
├── conduit-preflight.sh         # Pre-flight setup (sourced by all scripts)
├── lib/
│   ├── common.sh                # Logging, validation, config defaults
│   ├── registry.sh              # Service registry CRUD (JSON/jq)
│   ├── audit.sh                 # Structured audit logging + Capsule sealing
│   ├── dns.sh                   # dnsmasq configuration and management
│   ├── tls.sh                   # Caddy CA and certificate operations
│   └── routing.sh               # Reverse proxy route management
├── ui/                          # Admin dashboard (React 19 + TypeScript + Vite 6)
│   ├── vitest.config.ts         # Test configuration (happy-dom, 225 tests)
│   └── src/
│       ├── components/views/    # 6 views + blank slate + per-view empty states
│       ├── components/layout/   # AppShell, Sidebar, StatusBar
│       ├── components/shared/   # HealthDot, CopyButton, SlideOver, Toast, ViewBlankSlate
│       ├── api/                 # Typed API client modules
│       ├── stores/              # Zustand state (URL-synced routing)
│       └── lib/                 # Types, formatters, OKLCH theme
├── templates/
│   └── Caddyfile.service.tpl    # Per-service Caddy configuration template
├── conformance/                 # Audit log golden test vectors
├── completions/                 # Bash and Zsh tab-completion scripts
├── tests/                       # Unit, integration, and smoke tests (bats-core)
├── docs/                        # Architecture, security, compliance, guides
├── examples/                    # Deployment walkthroughs
├── .env.conduit.example         # Configuration template
├── Makefile                     # All operations as Make targets
└── VERSION                      # 0.2.0
```

---

## Part of the Quantum Pipes Stack

QP Conduit is the internal infrastructure layer. It works alongside:

| Component | Role | Repository |
|-----------|------|------------|
| **QP Conduit** | DNS, TLS, routing, monitoring (you are here) | [quantumpipes/conduit](https://github.com/quantumpipes/conduit) |
| **QP Tunnel** | WireGuard VPN boundary layer | [quantumpipes/tunnel](https://github.com/quantumpipes/tunnel) |
| **QP Capsule** | Cryptographic audit trail (SHA3-256 + Ed25519) | [quantumpipes/capsule](https://github.com/quantumpipes/capsule) |
| **qp-vault** | Governed knowledge store with content addressing | [quantumpipes/vault](https://github.com/quantumpipes/vault) |

Tunnel handles the perimeter. Conduit handles the interior. Capsule provides tamper evidence. Vault stores knowledge.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Issues and pull requests welcome.

## License and Patents

[Apache License 2.0](./LICENSE) with [additional patent grant](./PATENTS.md). You can use all patented innovations freely for any purpose, including commercial use.

---

<div align="center">

**Internal DNS. Automatic TLS. Service routing. Hardware monitoring. Full audit trail.**

[Documentation](./docs/) · [Examples](./examples/) · [Conformance](./conformance/) · [Security Policy](./SECURITY.md) · [Patent Grant](./PATENTS.md)

Copyright 2026 [Quantum Pipes Technologies, LLC](https://quantumpipes.com)

</div>
