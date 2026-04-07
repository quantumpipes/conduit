---
title: "Why QP Conduit"
description: "Business case for QP Conduit: the problem of internal service discovery and routing in on-premises AI deployments, why internal DNS, why internal TLS, why unified routing, why monitoring, competitive positioning, and scope boundaries."
date_modified: "2026-04-04"
ai_context: |
  Business case document for QP Conduit. Covers the internal infrastructure
  problem space for on-premises AI deployments, DNS value proposition, internal
  TLS rationale (zero-trust, compliance), unified routing with health checks,
  GPU/container/server monitoring, comparison against alternatives (manual hosts,
  Consul, Traefik, nginx, mDNS/Avahi), target use cases (healthcare, defense,
  home GPU lab, enterprise), scope boundaries (not a service mesh, not K8s),
  and the complementary relationship with QP Tunnel.
---

# Why QP Conduit

> **On-premises AI deployments have 3-10 services that need to find each other, trust each other, and stay healthy. That should not require Kubernetes.**

---

## The Problem

You deploy Quantum Pipes on-premises. The stack has at least five services: QP Core (API), QP Hub (frontend), PostgreSQL, Redis, and an LLM runtime (Ollama or vLLM). A production deployment adds Grafana, a vector database, and possibly multiple GPU servers running different models.

Each service runs on an IP and port. Someone has to remember that Core is at `10.0.1.10:8000`, Ollama is at `10.0.1.20:11434`, and PostgreSQL is at `10.0.1.5:5432`. They configure these addresses in environment variables, Docker Compose files, and application configs. They update them when IPs change.

Now multiply this across the problems that arise:

**Service discovery.** A new GPU server comes online. Someone updates three config files to point to it. They miss one. The LLM requests fail silently for two hours before anyone notices.

**TLS on the LAN.** The compliance team asks if internal traffic is encrypted. The answer is "no, but it is on a trusted network." The auditor marks it as a finding. Someone spends a week setting up a manual CA, generating certificates, and configuring every service to use them. The certificates expire six months later. Nobody notices until services start failing.

**Health monitoring.** You have a $30,000 GPU server running vLLM. The GPU overheats and throttles. Inference latency doubles. Nobody knows until users complain. You SSH into the box, run `nvidia-smi`, see the temperature at 92C, and realize the fan failed two days ago.

**Audit trail.** The security team asks what services were running last week and when the routing changed. You search through shell history and Docker logs across five machines. The answer takes a day to assemble.

These are not complex problems. They are tedious problems that every on-premises AI deployment faces. Conduit solves all four with one tool.

---

## Why Internal DNS

### The Problem with IP:Port

Every service configuration contains hardcoded addresses:

```bash
# Without Conduit: scattered across config files
CORE_URL=http://10.0.1.10:8000
OLLAMA_URL=http://10.0.1.20:11434
POSTGRES_HOST=10.0.1.5
REDIS_HOST=10.0.1.5
```

When the Ollama server moves to new hardware, you update every file that references `10.0.1.20`. Miss one and the system breaks.

### The Solution

```bash
# With Conduit: human-readable, stable names
CORE_URL=https://core.internal
OLLAMA_URL=https://ollama.internal
POSTGRES_HOST=postgres.internal
REDIS_HOST=redis.internal
```

The IP address for `ollama.internal` changes in one place: `services.json`. Conduit regenerates DNS. Every service resolves the new IP automatically.

### Air-Gap Compatible

Conduit's DNS runs entirely on dnsmasq. No external DNS queries. No dependency on cloud DNS services. No split-horizon configuration needed. It works on isolated networks with no internet access.

---

## Why Internal TLS

### "It Is on a Trusted Network"

This statement fails for five reasons:

1. **Lateral movement.** One compromised container on the LAN can sniff all unencrypted traffic between services. Internal TLS stops passive observation.
2. **Compliance mandates.** HIPAA (164.312(e)(1)), PCI DSS (Requirement 4), and CMMC L2 (SC.L2-3.13.8) require encryption of data in transit, including internal networks.
3. **Insider threat.** Anyone with LAN access (employees, contractors, visitors, cleaning staff with a USB Ethernet adapter) can capture unencrypted traffic.
4. **Network equipment compromise.** Switches and routers can be backdoored. TLS protects against man-in-the-middle attacks at the network layer.
5. **Audit simplification.** When all traffic is encrypted, the answer to "is data encrypted in transit?" is always "yes." No caveats, no exceptions, no findings.

### How Conduit Makes It Easy

Setting up internal TLS manually is painful: generate a CA, issue certificates, configure each service, handle renewal, distribute trust. Conduit automates the entire lifecycle:

1. Caddy generates an Ed25519 root CA (one-time, 10-year validity)
2. Caddy issues per-service certificates automatically when services register
3. Caddy renews certificates before expiry (no manual intervention)
4. You distribute the CA cert once to clients

Every `conduit-register` command gets TLS for free. No OpenSSL commands. No certificate signing requests. No cron jobs for renewal.

---

## Why Unified Routing

### The Problem with Direct Connections

Without a routing layer, every client connects directly to every service. This creates several problems:

- **No health awareness.** If a service is down, clients discover it by timing out. There is no fast-fail, no circuit breaking, no automatic recovery detection.
- **No single audit point.** Traffic flows directly between services. Logging requires instrumentation in every service.
- **Port sprawl.** Each service exposes its own port. Firewall rules multiply with every new service.
- **No TLS termination.** Each service must handle its own TLS configuration, or traffic is unencrypted.

### The Solution

Conduit routes all service traffic through Caddy as a reverse proxy:

- **One entry point.** All services are accessible on port 443 via their `.internal` domain.
- **Health checks.** Caddy probes upstreams every 30 seconds. Unhealthy services are removed from routing instantly. Recovery is automatic.
- **Centralized audit.** Every request passes through one proxy. One access log. One audit trail.
- **TLS termination.** Caddy handles TLS for all services. Upstream services run plain HTTP.

---

## Why Monitoring

### GPU Servers Are Expensive

An NVIDIA H200 server costs $30,000+. An A100 cluster costs $200,000+. When a GPU overheats, throttles, or fails, you need to know immediately, not when users start complaining about slow inference.

Conduit monitors GPU servers with `nvidia-smi`:

| Metric | Why It Matters |
|---|---|
| Temperature | GPUs throttle above 83C. Fan failures cause thermal runaway. |
| VRAM usage | OOM kills crash inference servers. Track usage trends to prevent them. |
| Utilization | 0% utilization means the service is not receiving requests (routing issue). 100% sustained means you need another GPU. |
| Process list | Verify the correct model is loaded. Detect unauthorized GPU usage. |

### Containers Restart Silently

Docker containers restart and nobody notices. The restart count climbs. The root cause (memory leak, segfault, OOM) goes uninvestigated. Conduit tracks container health, restart counts, and resource usage.

### Servers Degrade Gradually

Disk fills up over weeks. Memory pressure increases as caches grow. CPU load creeps up as usage grows. By the time someone notices, the system is in a degraded state. Conduit provides continuous visibility.

---

## Comparison

| Capability | QP Conduit | Manual /etc/hosts | Consul | Traefik | nginx | mDNS/Avahi |
|---|---|---|---|---|---|---|
| Internal DNS | Yes (dnsmasq) | Manual file editing | Yes (DNS interface) | No | No | Yes (*.local) |
| Internal TLS (auto) | Yes (Caddy CA) | No | No (manual certs) | Yes (Let's Encrypt) | No (manual certs) | No |
| Reverse proxy | Yes (Caddy) | No | No (needs separate proxy) | Yes | Yes | No |
| Health checks | Yes (active) | No | Yes (agent-based) | Yes | Limited | No |
| GPU monitoring | Yes | No | No | No | No | No |
| Container monitoring | Yes | No | Yes (agent-based) | No | No | No |
| Structured audit log | Yes (JSONL + Capsule) | No | Yes (audit backend) | Access logs | Access logs | No |
| Air-gap compatible | Yes | Yes | Yes | Partial (needs LE for auto-TLS) | Yes | Yes |
| Setup complexity | One command per service | Edit files on every machine | Agent on every node + server cluster | Config file per service | Config file per service | Zero-config (but limited) |
| Dependencies | 4 (bash, jq, Caddy, dnsmasq) | None | Consul binary per node | Traefik binary | nginx binary | avahi-daemon |

### Where Conduit Wins

**Unified stack.** DNS + TLS + routing + monitoring in one tool. Consul gives you DNS and health checks but needs a separate proxy. Traefik gives you routing and TLS but needs a separate DNS solution. nginx gives you routing but no DNS, no auto-TLS, no monitoring.

**GPU-aware monitoring.** No other routing tool monitors GPU temperature, VRAM, and utilization. You need a separate monitoring stack (Prometheus + nvidia-dcgm-exporter + Grafana) to get what Conduit provides out of the box.

**Air-gap auto-TLS.** Traefik's auto-TLS requires Let's Encrypt (internet access). Conduit's auto-TLS uses a local CA. No internet required.

**Audit depth.** Structured JSONL with optional cryptographic sealing. Not just access logs, but tamper-evident proof of every infrastructure change.

### Where Others Win

**Service mesh (Istio, Linkerd).** For large Kubernetes clusters with hundreds of services, a service mesh provides mutual TLS, traffic splitting, canary deployments, and distributed tracing. Conduit is not a service mesh. If you run Kubernetes with 50+ services, use a service mesh.

**Consul for multi-datacenter.** Consul supports multi-datacenter service discovery with WAN gossip protocol. Conduit serves a single site. For multi-site deployments, run a Conduit instance per site.

**Traefik for Docker-native routing.** Traefik reads Docker labels for automatic routing configuration. If your entire stack is Docker Compose and you do not need internal DNS or GPU monitoring, Traefik is simpler.

**mDNS/Avahi for zero-config.** If you need zero-configuration service discovery on a small LAN and do not care about TLS, monitoring, or audit logging, mDNS works with no setup at all.

---

## Target Use Cases

### Healthcare Clinic

A practice management system with QP Core, PostgreSQL, Redis, and Ollama running on a single server or a small cluster. HIPAA requires encryption in transit (164.312(e)(1)). Conduit provides internal TLS for all service communication. The audit log satisfies access monitoring requirements. No cloud dependency.

### Defense Facility

A SCIF or classified enclave running AI workloads on air-gapped infrastructure. No internet access. No cloud services. Conduit provides DNS, TLS, and routing entirely from local configuration. The Capsule Protocol audit trail provides tamper-evident records for security reviews.

### Home GPU Lab

A researcher with two GPU servers (one A100, one RTX 4090) and a NUC running QP Core. Services are at random IPs that change when DHCP leases expire. Conduit gives stable DNS names, automatic TLS, and GPU monitoring from a single dashboard command. Setup takes minutes.

### Enterprise AI Cluster

A company deploying QP across 10+ servers with multiple GPU nodes, redundant databases, and load-balanced API servers. Conduit provides health-aware routing (automatically removing unhealthy upstreams), GPU monitoring across all nodes, and a centralized audit trail for the security team.

---

## What Conduit Is NOT

Be clear about scope. Conduit is a specific tool for a specific problem.

**Not a service mesh.** Conduit is a reverse proxy with DNS and monitoring. It does not provide mutual TLS between arbitrary services, traffic splitting, retry policies, or distributed tracing. For Kubernetes-scale service mesh capabilities, use Istio or Linkerd.

**Not a container orchestrator.** Conduit does not start, stop, or schedule containers. It monitors them and routes traffic to them. For container orchestration, use Docker Compose, Docker Swarm, or Kubernetes.

**Not a replacement for Kubernetes.** If you have 50+ services, multiple teams, and need auto-scaling, rolling deployments, and resource quotas, use Kubernetes. Conduit targets deployments with 3-15 services on 1-10 machines.

**Not an external-facing proxy.** Conduit routes internal traffic. For external access, use QP Tunnel (which provides WireGuard VPN with PQ TLS). Conduit handles what happens after traffic arrives inside the network.

**Not a full monitoring platform.** Conduit provides infrastructure health visibility (GPU, containers, servers). For application-level metrics, distributed tracing, and custom dashboards, use Prometheus + Grafana or a dedicated observability stack. Conduit's monitoring output is structured JSON that feeds into those platforms.

---

## Relationship to QP Tunnel

Conduit and Tunnel are complementary. They are not competing products.

| Concern | QP Tunnel | QP Conduit |
|---|---|---|
| Purpose | Get remote users into the network | Route traffic to the right service |
| Boundary | Internet to LAN | LAN to services |
| Encryption | WireGuard + PQ TLS | Caddy TLS 1.3 (internal CA) |
| DNS | N/A | dnsmasq (*.internal, *.local) |
| Monitoring | Peer connection status | GPU, containers, servers |

**Tunnel gets you in. Conduit connects everything inside.**

A typical deployment runs both:

1. A remote user connects via QP Tunnel (WireGuard VPN)
2. Their traffic arrives on the internal network
3. They request `https://core.internal`
4. Conduit's dnsmasq resolves the domain to the correct IP
5. Conduit's Caddy terminates TLS and routes to the upstream service
6. Both Tunnel and Conduit write audit entries for the complete access chain

You can run either tool independently. Conduit works without Tunnel (for local-only deployments). Tunnel works without Conduit (for direct IP access). Together, they provide a complete access and routing layer.

---

## Related Documentation

- [Guide](./guide.md): Getting started walkthrough for new users
- [Architecture](./architecture.md): System overview, DNS, TLS, routing, monitoring design
- [Security Evaluation](./security.md): Cryptographic inventory and threat model for CISOs
- [Deployment](./deployment.md): Docker, air-gap, and multi-server deployment
- [Deployment Examples](../examples/README.md): Real-world scenarios (home lab, healthcare, defense)
