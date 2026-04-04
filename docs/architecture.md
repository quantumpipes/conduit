---
title: "QP Conduit Architecture"
description: "Technical architecture of QP Conduit: internal DNS, TLS, service routing, monitoring, state management, audit chain, and integration with QP Tunnel."
date_modified: "2026-04-04"
ai_context: |
  Full architecture of QP Conduit. Covers the four subsystems (DNS via dnsmasq,
  TLS via Caddy internal CA, reverse proxy routing with health checks, multi-target
  monitoring), state management (services.json registry, audit.log), JSONL audit
  with optional Capsule Protocol sealing, network topology relative to QP Tunnel
  and the firewall boundary, and the split responsibility model (Tunnel = external
  access, Conduit = internal routing). Tech stack: Bash 4.0+, Caddy 2.10+,
  dnsmasq, jq. Source: conduit-*.sh, lib/, templates/.
---

# Architecture

> **Internal DNS. Internal TLS. Health-aware routing. GPU monitoring. One unified layer for on-premises AI infrastructure.**

---

## Design Philosophy

QP Conduit follows three principles:

1. **Shell-native.** Bash scripts, library modules, zero compiled binaries. Every operation is inspectable, auditable, and modifiable.
2. **State as files.** One JSON registry (services.json) and one JSONL log (audit.log) hold all state. No database server. No daemon. Back them up with `cp`.
3. **Zero-trust internal.** TLS everywhere, even on the LAN. Internal CA issues Ed25519 certificates automatically. Services authenticate to each other, not just to external clients.

---

## System Overview

QP Conduit provides four capabilities as a unified infrastructure layer:

```
┌─────────────────────────────────────────────────────────────────┐
│                      QP CONDUIT                                 │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   DNS        │  │   TLS        │  │   ROUTING            │  │
│  │              │  │              │  │                      │  │
│  │  dnsmasq     │  │  Caddy       │  │  Caddy reverse       │  │
│  │  *.internal  │  │  internal CA │  │  proxy + health      │  │
│  │  *.local     │  │  Ed25519     │  │  checks              │  │
│  │  auto-config │  │  auto-renew  │  │  load balancing      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   MONITORING                                             │  │
│  │                                                          │  │
│  │  GPU (nvidia-smi)  Containers (Docker API)  Servers (SSH)│  │
│  │  Temperature, VRAM, utilization, process lists           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   AUDIT                                                  │  │
│  │   Structured JSONL + optional Capsule Protocol sealing   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

Each capability operates independently. You can use DNS without routing, routing without monitoring, or the full stack together.

---

## Network Topology

Conduit sits inside the network boundary. Tunnel sits outside it. Together they form a complete access and routing layer.

```
                    INTERNET
                       │
                       │ UDP :51820
                       ▼
            ┌────────────────────┐
            │   QP Tunnel Relay  │
            │   (public relay)   │
            └────────┬───────────┘
                     │
                     │ WireGuard
                     │
         ════════════╪═══════════════════  FIREWALL
                     │
                     ▼
            ┌────────────────────┐
            │   QP Conduit       │
            │   (gateway host)   │
            │                    │
            │  DNS:   :53        │
            │  Proxy: :443       │
            │  Monitor: local    │
            └──┬─────┬─────┬────┘
               │     │     │
        ┌──────┘     │     └──────┐
        │            │            │
        ▼            ▼            ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐
   │ QP Core │ │ Ollama   │ │ vLLM    │
   │ :8000   │ │ :11434   │ │ :8001   │
   │ (API)   │ │ (LLM)   │ │ (LLM)   │
   └─────────┘ └─────────┘ └─────────┘
   ┌─────────┐ ┌─────────┐ ┌─────────┐
   │ Postgres │ │ Redis   │ │ Grafana │
   │ :5432   │ │ :6379   │ │ :3000   │
   └─────────┘ └─────────┘ └─────────┘
```

**Tunnel handles ingress.** Remote peers connect through WireGuard to reach the internal network.

**Conduit handles routing.** Once inside the network, requests resolve via internal DNS, terminate TLS at Caddy, and route to the correct upstream service.

The Conduit gateway host is typically the same machine running QP Tunnel's target device agent. Traffic arrives via Tunnel, hits Conduit's DNS and reverse proxy, and reaches internal services.

---

## DNS Resolution

### dnsmasq Configuration

Conduit runs a local dnsmasq instance that resolves internal service names to their host IPs. No external DNS queries leave the network.

```
DNS Resolution Flow
───────────────────

  Client request          dnsmasq              Service
  "core.internal"    ─────▶  lookup   ─────▶   10.0.1.10:8000
                            services.json
                            mapping
```

### Resolution Order

1. Client queries `core.internal` (or `core.local`)
2. dnsmasq checks its local configuration (generated from `services.json`)
3. If found: returns the service IP
4. If not found: returns NXDOMAIN (no upstream forwarding in air-gap mode)

### Domain Conventions

| Pattern | Purpose | Example |
|---|---|---|
| `<name>.internal` | Production services | `core.internal`, `ollama.internal` |
| `<name>.local` | Development services | `core.local`, `hub.local` |
| `<name>.test` | Test/staging services | `core.test` |

`conduit-dns` generates the dnsmasq configuration from the service registry. Adding or removing a service automatically regenerates DNS records.

### Air-Gap DNS

In air-gapped deployments, dnsmasq operates as the sole DNS resolver for the network segment. No queries are forwarded to external resolvers. All resolution is local.

---

## TLS Certificate Lifecycle

### Internal CA

Conduit uses Caddy's built-in certificate authority to issue Ed25519 TLS certificates for internal services. No external CA dependency.

```
Certificate Lifecycle
─────────────────────

  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │ Caddy        │     │ Service      │     │ Auto-Renewal │
  │ Internal CA  │────▶│ Certificate  │────▶│ Before       │
  │              │     │ Ed25519      │     │ Expiry       │
  │ Ed25519 root │     │ 1-year valid │     │ (automatic)  │
  │ 10-year root │     │ SAN: *.internal   │ No downtime  │
  └──────────────┘     └──────────────┘     └──────────────┘
        │
        ▼
  ┌──────────────┐
  │ Trust        │
  │ Distribution │
  │              │
  │ CA cert to   │
  │ all clients  │
  └──────────────┘
```

### Certificate Properties

| Property | Value |
|---|---|
| Root CA algorithm | Ed25519 |
| Root CA validity | 10 years |
| Leaf cert algorithm | Ed25519 |
| Leaf cert validity | 1 year (auto-renewed) |
| TLS version | 1.3 only |
| Key exchange | X25519 (with ML-KEM-768 when Caddy supports it) |
| Bulk cipher | AES-256-GCM |

### Trust Distribution

The CA certificate must be distributed to all clients that connect to internal services. Conduit provides the CA cert at a well-known path for automated distribution:

- `conduit-ca export` outputs the CA certificate in PEM format
- Clients add it to their trust store (system, browser, or application-level)
- Docker containers mount the CA cert at build or runtime

No certificate is ever transmitted over an unencrypted channel. The CA private key never leaves the Conduit gateway host.

---

## Service Routing

### Caddy Reverse Proxy

All internal traffic routes through Caddy as a TLS-terminating reverse proxy. Services register themselves in the service registry, and Caddy routes based on hostname.

```
Routing Flow
────────────

  Client                Caddy                  Upstream
  https://core.internal ──▶ TLS termination ──▶ http://10.0.1.10:8000
                            │
                            ├── Health check (active)
                            ├── Retry on failure
                            └── Audit log entry
```

### Health Checks

Caddy performs active health checks against registered upstreams:

| Parameter | Default | Purpose |
|---|---|---|
| Interval | 30 seconds | How often to probe the upstream |
| Timeout | 5 seconds | Max wait for health check response |
| Path | `/health` | HTTP path to probe |
| Threshold | 2 consecutive failures | Failures before marking unhealthy |

When an upstream fails health checks, Caddy stops routing traffic to it and logs the event. When it recovers, traffic resumes automatically.

### Service Registration

`conduit-register` adds a service to the routing layer:

```bash
conduit-register --name core --upstream 10.0.1.10:8000 --domain core.internal
```

This operation:

1. Adds the service to `services.json`
2. Regenerates the Caddy configuration from the service registry
3. Regenerates dnsmasq configuration with the new domain mapping
4. Issues a TLS certificate for the domain (if not already present)
5. Reloads Caddy and dnsmasq (graceful, no downtime)
6. Writes an audit log entry

`conduit-deregister` reverses the process, removing the service from DNS and routing.

---

## Monitoring Architecture

Conduit monitors three types of infrastructure targets:

```
Monitoring Targets
──────────────────

  ┌──────────────────────────────────────────────────────────┐
  │                  conduit-monitor                          │
  │                                                          │
  │  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │
  │  │ GPU        │  │ Container  │  │ Server             │ │
  │  │            │  │            │  │                    │ │
  │  │ nvidia-smi │  │ Docker API │  │ SSH + system       │ │
  │  │ (local or  │  │ (socket)   │  │ commands           │ │
  │  │  SSH)      │  │            │  │                    │ │
  │  │            │  │            │  │                    │ │
  │  │ Temp       │  │ Status     │  │ CPU, RAM, disk     │ │
  │  │ VRAM       │  │ CPU/RAM    │  │ uptime, load       │ │
  │  │ Util %     │  │ Health     │  │ service status     │ │
  │  │ Processes  │  │ Restarts   │  │                    │ │
  │  └────────────┘  └────────────┘  └────────────────────┘ │
  └──────────────────────────────────────────────────────────┘
```

### GPU Monitoring

`conduit-monitor --gpu` queries `nvidia-smi` for:

| Metric | Source | Alert Threshold |
|---|---|---|
| GPU temperature | `nvidia-smi --query-gpu=temperature.gpu` | > 85C |
| VRAM usage | `nvidia-smi --query-gpu=memory.used,memory.total` | > 90% |
| GPU utilization | `nvidia-smi --query-gpu=utilization.gpu` | Informational |
| Running processes | `nvidia-smi --query-compute-apps=pid,process_name,used_memory` | Informational |

For remote GPU servers, monitoring runs over SSH. The Conduit gateway host does not need a GPU itself.

### Container Monitoring

`conduit-monitor --containers` queries the Docker socket (`/var/run/docker.sock`) for:

| Metric | Source |
|---|---|
| Container status | Docker API (`/containers/json`) |
| CPU / memory usage | Docker API (`/containers/{id}/stats`) |
| Health check status | Docker API (health field) |
| Restart count | Docker API (restart count field) |

### Server Monitoring

`conduit-monitor --server` collects system metrics locally or via SSH:

| Metric | Command |
|---|---|
| CPU usage | `top -bn1` or `/proc/stat` |
| Memory usage | `free -b` |
| Disk usage | `df -B1` |
| System load | `uptime` or `/proc/loadavg` |
| Uptime | `uptime -s` |

### Output Format

All monitoring output is structured JSON, suitable for piping to dashboards, alerting systems, or the audit log:

```json
{
  "timestamp": "2026-04-04T12:00:00Z",
  "target": "gpu-server-01",
  "type": "gpu",
  "metrics": {
    "temperature_c": 72,
    "vram_used_mb": 38400,
    "vram_total_mb": 81920,
    "utilization_pct": 94,
    "processes": [
      {"pid": 12345, "name": "vllm", "vram_mb": 36000}
    ]
  }
}
```

---

## State Management

### Directory Structure

All state lives in `~/.config/${CONDUIT_APP_NAME}/` (default: `~/.config/qp-conduit/`):

```
~/.config/qp-conduit/
├── services.json           Service registry (DNS, routing, monitoring targets)
├── audit.log               Structured JSONL audit log
├── capsules.db             SQLite Capsule database (tamper-evident)
├── tls/
│   ├── ca.key              Caddy internal CA key (managed by Caddy)
│   ├── ca.crt              CA public certificate (distribute to clients)
│   └── <domain>/           Per-service cert directory (managed by Caddy)
├── dns/
│   └── dnsmasq.conf        Generated dnsmasq configuration
├── routing/
│   └── Caddyfile           Generated Caddy routing configuration
└── monitoring/
    └── targets.json        Monitoring target definitions
```

### services.json

The service registry is a flat JSON file managed through `jq`. It drives DNS, routing, and monitoring configuration.

```json
{
  "version": 1,
  "services": [
    {
      "name": "core",
      "upstream": "10.0.1.10:8000",
      "domain": "core.internal",
      "status": "active",
      "registered_at": "2026-04-04T12:00:00Z",
      "health_check": "/health",
      "monitoring": {
        "type": "container",
        "container_name": "qp-core"
      }
    },
    {
      "name": "ollama",
      "upstream": "10.0.1.20:11434",
      "domain": "ollama.internal",
      "status": "active",
      "registered_at": "2026-04-04T12:00:00Z",
      "health_check": "/api/tags",
      "monitoring": {
        "type": "gpu",
        "ssh_host": "10.0.1.20"
      }
    }
  ]
}
```

Key design decisions:

- **Deregistered services are never deleted.** They remain with `status: "inactive"` and a `deregistered_at` timestamp. This preserves audit history.
- **One registry drives all subsystems.** DNS records, Caddy routes, and monitoring targets all generate from `services.json`. Single source of truth.
- **Duplicate detection by name and domain.** You cannot register two services with the same name or the same domain.

---

## Audit Chain

### JSONL Audit Log

Every operation writes a structured JSON line to `audit.log`:

```json
{"timestamp":"2026-04-04T12:00:00Z","action":"service_register","status":"success","message":"Registered core at core.internal","user":"operator","details":{"name":"core","domain":"core.internal","upstream":"10.0.1.10:8000"}}
```

Logged actions: `service_register`, `service_deregister`, `dns_reload`, `tls_issue`, `tls_renew`, `health_check_fail`, `health_check_recover`, `monitor_alert`, and all error traps.

### Capsule Protocol Integration

When `qp-capsule` is installed, every audit entry is sealed as a tamper-evident Capsule:

```
audit_log()
    │
    ├──▶ Append JSON line to audit.log (fast local index)
    │
    └──▶ _capsule_seal()
              │
              └──▶ qp-capsule seal --db capsules.db
                        │
                        ├──▶ SHA3-256 hash
                        ├──▶ Ed25519 signature
                        └──▶ Hash chain link
```

The JSONL audit log serves as a fast local index. Capsules are the cryptographic source of truth. Verify the chain:

```bash
qp-capsule verify --db ~/.config/qp-conduit/capsules.db
```

If `qp-capsule` is not installed, audit logging continues normally without sealing. The system never blocks on Capsule availability.

---

## Integration with QP Tunnel

Conduit and Tunnel operate as complementary layers:

| Concern | QP Tunnel | QP Conduit |
|---|---|---|
| Boundary | External (internet to LAN) | Internal (LAN to services) |
| Encryption | WireGuard + PQ TLS | Caddy TLS 1.3 (internal CA) |
| Identity | Peer keypairs | Service certificates |
| DNS | N/A | dnsmasq (*.internal, *.local) |
| Routing | Split-tunnel to subnet | Reverse proxy to upstream |
| Monitoring | Peer status (handshakes) | GPU, containers, servers |
| Audit | JSONL + Capsule | JSONL + Capsule (shared format) |

### Traffic Flow (External Peer to Internal Service)

```
Remote peer
    │
    │ WireGuard (Tunnel)
    ▼
Tunnel target device (10.8.0.2)
    │
    │ Internal network
    ▼
Conduit DNS (core.internal → 10.0.1.10)
    │
    │ TLS 1.3 (Conduit CA)
    ▼
Conduit Caddy proxy (:443)
    │
    │ Health check passes
    ▼
QP Core upstream (:8000)
```

Both Tunnel and Conduit share the same audit log format and Capsule Protocol integration. A unified audit view spans both external access events and internal routing events.

---

## Related Documentation

- [Why QP Conduit](./why-conduit.md) -- Business case and comparison positioning
- [Security Evaluation](./security.md) -- Cryptographic inventory and threat model for CISOs
