---
title: "Security Evaluation Guide"
description: "Security evaluation guide for CISOs and security teams assessing QP Conduit for organizational adoption. Covers cryptographic inventory, DNS security, attack surface, monitoring security, input validation, audit integrity, dependencies, STRIDE threat model, zero-trust rationale, and deployment hardening."
date_modified: "2026-04-04"
classification: "Public"
ai_context: |
  CISO-targeted security evaluation of QP Conduit. Covers TLS 1.3 via Caddy
  internal CA (Ed25519 certs), DNS security (dnsmasq, local-only resolution),
  attack surface (internal CA compromise, DNS poisoning, routing hijack),
  monitoring security (SSH keys, Docker socket), input validation (strict regex,
  no eval), audit trail with optional Capsule Protocol sealing, dependency audit
  (bash, jq, Caddy, dnsmasq, bats-core), STRIDE threat model for internal
  infrastructure, zero-trust rationale, and deployment hardening checklist.
  Source: conduit-*.sh, lib/, templates/.
---

# Security Evaluation Guide

**For CISOs and Security Teams Evaluating QP Conduit**

*QP Conduit v0.1.0, April 2026*
*Classification: Public*

---

## 1. Executive Summary

QP Conduit is the internal infrastructure layer for on-premises AI deployments. It handles DNS resolution, TLS certificate management, service routing, and hardware monitoring inside the network boundary.

**The security proposition in four sentences:**

1. All internal traffic is encrypted with TLS 1.3 using Ed25519 certificates issued by Caddy's built-in certificate authority.
2. DNS resolution is entirely local via dnsmasq, with no queries forwarded to external resolvers.
3. Every operation is logged as structured JSON with optional Capsule Protocol sealing (SHA3-256 + Ed25519) for tamper-evident audit trails.
4. The system requires four dependencies (bash, jq, Caddy, dnsmasq) and operates with zero internet connectivity after initial setup.

---

## 2. Cryptographic Inventory

### TLS Layer (Caddy Internal CA)

| Algorithm | Standard | Purpose | Notes |
|---|---|---|---|
| Ed25519 | RFC 8032 / FIPS 186-5 | Certificate signatures (root CA + leaf certs) | All certificates use Ed25519 |
| X25519 | RFC 7748 | TLS 1.3 key exchange | Standard Caddy TLS handshake |
| AES-256-GCM | FIPS 197 / SP 800-38D | Bulk encryption | TLS 1.3 cipher suite |
| TLS 1.3 | RFC 8446 | Transport security | No TLS 1.2 or lower negotiation |

Caddy enforces TLS 1.3 as the minimum version. There is no cipher negotiation fallback to weaker protocols.

### Audit Layer (Optional)

| Algorithm | Standard | Purpose |
|---|---|---|
| SHA3-256 | FIPS 202 | Content integrity hashing |
| Ed25519 | FIPS 186-5 | Non-repudiation signatures |

Activated when `qp-capsule` is installed. See the [Capsule Security Evaluation](../../capsule/docs/security.md) for the full cryptographic analysis of the audit layer.

### No Deprecated Cryptography

| Algorithm | Status |
|---|---|
| SHA-1 | Not used |
| MD5 | Not used |
| RSA | Not used |
| DES / 3DES | Not used |
| RC4 | Not used |
| TLS 1.0 / 1.1 / 1.2 | Not used |
| Self-signed certs (non-CA) | Not used |

---

## 3. DNS Security

### Local Resolution Only

dnsmasq resolves internal domains (`.internal`, `.local`, `.test`) from locally generated configuration files. No DNS queries leave the network.

| Property | Implementation |
|---|---|
| Upstream forwarding | Disabled in air-gap mode |
| Cache poisoning | Not applicable (no upstream queries to poison) |
| Zone transfer | Not applicable (not an authoritative DNS server) |
| DNSSEC | Not implemented (local trust model, no external validation needed) |

### DNSSEC Considerations

Conduit does not implement DNSSEC because the threat model does not require it. DNSSEC protects against spoofing of responses from upstream DNS servers. Conduit has no upstream servers. All resolution is local, from configuration files that Conduit itself generates.

If your deployment forwards non-internal queries to an upstream resolver (non-air-gap mode), enable DNSSEC validation on that upstream resolver. Conduit's local resolution remains unaffected.

### DNS Rebinding Protection

dnsmasq is configured with `stop-dns-rebind` to reject DNS responses that resolve to private IP ranges from external sources. This prevents DNS rebinding attacks where an external domain resolves to an internal IP.

---

## 4. Attack Surface Analysis

### Internal CA Compromise

| Threat | Impact | Mitigation |
|---|---|---|
| CA private key stolen | Attacker can issue certificates for any internal domain | CA key stored with mode 600, managed by Caddy, never exported |
| CA cert replaced | Attacker substitutes their own CA and issues rogue certs | CA cert hash recorded in audit log at creation time; clients pin the CA cert |
| Rogue leaf cert issued | Attacker impersonates an internal service | Caddy manages all cert issuance; no external CSR submission path |

**Recovery from CA compromise:** Regenerate the CA (`conduit-ca regenerate`), reissue all service certificates (automatic on Caddy reload), redistribute the new CA cert to all clients. The audit log records the regeneration event.

### DNS Poisoning (Internal)

| Threat | Impact | Mitigation |
|---|---|---|
| Modify dnsmasq.conf | Redirect service traffic to attacker-controlled host | File permissions (root-owned), regenerated from services.json on every change |
| ARP spoofing to redirect DNS | Client queries reach attacker's DNS server | TLS certificate validation catches the mismatch (wrong cert for the domain) |
| Rogue DHCP assigns attacker's DNS | Clients bypass Conduit DNS entirely | Deploy Conduit as the DHCP server, or use static DNS configuration on clients |

The critical mitigation is TLS. Even if DNS is poisoned, the attacker cannot present a valid certificate for the target domain (they lack the CA private key). The client's TLS handshake fails, and the connection is refused.

### Routing Hijack

| Threat | Impact | Mitigation |
|---|---|---|
| Modify Caddyfile | Route traffic to unauthorized upstream | File permissions, regenerated from services.json, audit-logged |
| Caddy process replaced | Attacker serves their own responses | Process PID tracked, binary integrity (package manager verification) |
| Upstream spoofing | Service impersonates another service | Health check path validation, upstream TLS (optional mutual TLS) |

### Monitoring Security

| Surface | Exposure | Mitigation |
|---|---|---|
| Docker socket (`/var/run/docker.sock`) | Root-equivalent access to host | Read-only API queries; never mounts socket into containers |
| SSH keys for remote monitoring | Access to monitored servers | Dedicated monitoring user with restricted shell; key-based auth only |
| nvidia-smi output | GPU workload visibility | Local execution or restricted SSH; no sensitive data in GPU metrics |

---

## 5. Input Validation

### Service Name Validation

All service names pass through strict regex validation:

```bash
^[a-zA-Z0-9_-]+$
```

This prevents:

| Attack | How It Is Prevented |
|---|---|
| Command injection | No shell metacharacters allowed (`;`, `\|`, `&`, `` ` ``, `$`) |
| Path traversal | No slashes or dots allowed (`/`, `..`) |
| Null byte injection | No null bytes in the regex character class |
| Whitespace injection | No spaces or tabs allowed |

### Domain Validation

Domain names are validated against:

```bash
^[a-zA-Z0-9._-]+$
```

Additionally, domains must end with a recognized suffix (`.internal`, `.local`, `.test`). Public domain suffixes are rejected.

### No eval

The word `eval` does not appear anywhere in the codebase. This eliminates the entire category of code injection through dynamic evaluation.

### Upstream Validation

Upstream addresses are validated as `host:port` pairs. The host must be an IP address or a valid hostname. The port must be a number between 1 and 65535.

### JSON Validation

The audit system validates that `details` parameters are valid JSON before writing. Invalid JSON falls back to an empty object rather than writing malformed data.

Registry initialization checks `services.json` validity with `jq empty`. Corrupt files are backed up and reinitialized.

---

## 6. Audit Trail Integrity

### Three Layers of Audit

| Layer | Format | Integrity | Purpose |
|---|---|---|---|
| JSONL log | `audit.log` | Append-only file | Fast local index, human-readable |
| Capsule database | `capsules.db` | SHA3-256 + Ed25519 signed, hash-chained | Tamper-evident cryptographic proof |
| Caddy access logs | Caddy structured log | Caddy-managed | Per-request HTTP access records |

### Audit Log Properties

- **Structured.** Every entry is valid JSON with timestamp, action, status, message, user, and details.
- **Error-trapped.** Every script uses `set -euo pipefail` with an ERR trap that writes a failure entry on any unhandled error, including script name and line number.
- **Atomic appends.** Each entry is written as a single `printf` to prevent partial writes.

### Capsule Sealing

When `qp-capsule` is installed, every audit entry is additionally sealed as a Capsule:

1. Content hashed with SHA3-256 (FIPS 202)
2. Hash signed with Ed25519 (FIPS 186-5)
3. Linked to previous Capsule via hash chain

Tampering with any record invalidates its signature and breaks the chain for all subsequent records. Verification: `qp-capsule verify --db capsules.db`.

If `qp-capsule` is not available, audit logging continues normally. Capsule sealing never blocks normal operations.

---

## 7. Dependency Audit

### Required Dependencies

| Package | License | Purpose | Attack Surface |
|---|---|---|---|
| `bash` 4.0+ | GPL-3.0 | Shell runtime | Standard system utility |
| `jq` | MIT | JSON processing for state files | Processes only local, validated JSON |
| `caddy` 2.10+ | Apache 2.0 | TLS termination, reverse proxy, internal CA | Handles all TLS and HTTP traffic |
| `dnsmasq` | GPL-2.0 | Internal DNS resolution | Listens on localhost or internal interface only |

**Total: 4 required dependencies.**

### Optional Dependencies

| Package | License | Purpose | When Needed |
|---|---|---|---|
| `qp-capsule` | Apache 2.0 | Tamper-evident audit sealing | Audit hardening (optional) |
| `nvidia-smi` | NVIDIA proprietary | GPU monitoring | GPU monitoring only |
| `docker` CLI | Apache 2.0 | Container monitoring | Container monitoring only |
| `ssh` | BSD | Remote server/GPU monitoring | Remote monitoring only |
| `bats-core` | MIT | Test framework | Development/testing only |

### Runtime Network Dependencies

**None after initial setup.** Once Caddy and dnsmasq are configured, Conduit operates with zero internet dependencies. All DNS resolution is local. All TLS certificates are issued by the internal CA. All routing is to internal upstreams.

---

## 8. Threat Model (STRIDE)

### Spoofing

| Threat | Mitigation |
|---|---|
| Attacker impersonates an internal service | TLS certificates signed by internal CA. Clients trust only this CA. |
| Attacker spoofs DNS responses | TLS handshake fails if the certificate does not match the requested domain. |
| Attacker replaces the CA | CA cert hash recorded in audit log. Clients pin the CA cert in their trust store. |

### Tampering

| Threat | Mitigation |
|---|---|
| Modify traffic between proxy and upstream | Optional upstream TLS (mutual TLS for high-security). Caddy to upstream on same host or trusted network segment. |
| Modify DNS configuration | File permissions (root-owned). Regenerated from services.json on every change. |
| Modify audit records | Capsule Protocol sealing with SHA3-256 hash + Ed25519 signature + hash chain. |
| Modify services.json | File permissions (mode 600). Corrupt files detected via `jq` validation and backed up. |

### Repudiation

| Threat | Mitigation |
|---|---|
| Deny registering or deregistering a service | Every operation writes to audit.log with timestamp, username, and details. |
| Deny audit record existed | Capsule Protocol hash chain links every record. Deletion breaks the chain. |
| Deny monitoring alert occurred | Alerts written to audit.log and optionally sealed as Capsules. |

### Information Disclosure

| Threat | Mitigation |
|---|---|
| Intercept internal traffic | TLS 1.3 on all internal routes. |
| Read monitoring data | Monitoring output is structured JSON to stdout or audit log. Not exposed via network endpoint by default. |
| CA key extraction | Mode 600, managed by Caddy, never exported or logged. |
| Docker socket abuse | Read-only API queries. Monitoring user does not need Docker write access. |

### Denial of Service

| Threat | Mitigation |
|---|---|
| Flood Caddy with requests | Caddy rate limiting configuration. Internal network limits blast radius. |
| Kill dnsmasq | systemd service auto-restart. DNS failure logged and alerted. |
| Exhaust TLS certificates | Caddy manages certificate lifecycle automatically. No manual exhaustion vector. |
| Fill audit log disk | Log rotation via standard logrotate configuration. |

### Elevation of Privilege

| Threat | Mitigation |
|---|---|
| Shell injection via service name | Strict `[a-zA-Z0-9_-]` validation. No `eval` anywhere. |
| Docker socket escalation | Monitoring uses read-only API queries. Container creation/modification is not supported through Conduit. |
| SSH key abuse from monitoring | Dedicated monitoring user with restricted shell (`/bin/rbash` or ForceCommand). |
| Caddy process compromise | Caddy runs as non-root user. Uses `cap_net_bind_service` for port 443. |

---

## 9. Zero-Trust Rationale

### Why Internal TLS Matters

"We trust our LAN" is a statement that fails in practice. Internal TLS addresses five real threats:

1. **Lateral movement.** An attacker who compromises one service on the LAN can sniff traffic to all other services. TLS prevents passive observation.
2. **Insider threat.** Employees, contractors, and visitors on the LAN can capture unencrypted traffic with standard tools (Wireshark, tcpdump).
3. **Compliance mandates.** HIPAA (164.312(e)(1)), PCI DSS (Req. 4), and CMMC L2 (SC.L2-3.13.8) require encryption of sensitive data in transit, including on internal networks.
4. **Cloud habit transfer.** Teams that deploy to cloud environments (where TLS is universal) should not have to change security posture when deploying on-premises.
5. **Supply chain compromise.** Network equipment (switches, routers) can be compromised. TLS protects against man-in-the-middle attacks at the network layer.

### Zero-Trust Internal Network Model

Conduit implements zero-trust principles at the infrastructure level:

| Principle | Conduit Implementation |
|---|---|
| Verify explicitly | Every connection authenticated via TLS certificate |
| Least privilege | Services communicate only through registered routes |
| Assume breach | All traffic encrypted, all operations audit-logged |

---

## 10. Deployment Hardening Checklist

| Item | Priority | Detail |
|---|---|---|
| Restrict Docker socket access | Critical | Only the monitoring user needs read access. Use `docker` group membership, not root. |
| Restrict SSH monitoring keys | Critical | Dedicated user, restricted shell, key-based auth only. No password auth. |
| Pin CA certificate on clients | High | Distribute the CA cert to all clients at deployment. Do not rely on TOFU (trust on first use). |
| Enable Caddy rate limiting | High | Protect against internal DoS. Configure `rate_limit` directive in Caddyfile. |
| Run Caddy as non-root | High | Use `cap_net_bind_service` for port 443. Caddy handles this automatically on Linux. |
| Configure log rotation | High | Rotate `audit.log` and Caddy access logs to prevent disk exhaustion. |
| Restrict dnsmasq listener | Medium | Bind dnsmasq to the internal interface only. Do not listen on 0.0.0.0. |
| Enable Capsule Protocol sealing | Medium | Install `qp-capsule` for tamper-evident audit trails. |
| Monitor CA cert expiration | Medium | Root CA is valid for 10 years. Set a reminder for year 9. |
| Back up state directory | Medium | Back up `~/.config/qp-conduit/` to encrypted storage. Loss means loss of audit history and CA. |
| Use mutual TLS for sensitive upstreams | Low | For high-security services, configure mutual TLS between Caddy and the upstream. |
| Audit dnsmasq configuration | Low | Periodically verify `dnsmasq.conf` matches `services.json`. Run `conduit-dns --verify`. |

---

## 11. Security Evaluation Checklist

| Criterion | Status | Detail |
|---|---|---|
| Uses well-reviewed transport encryption | Yes | TLS 1.3 via Caddy (Go standard library) |
| Internal CA with Ed25519 certificates | Yes | Caddy built-in CA, 10-year root, 1-year leaf, auto-renewal |
| No deprecated crypto algorithms | Yes | No SHA-1, MD5, RSA, DES, RC4, TLS < 1.3 |
| DNS resolution is local-only | Yes | dnsmasq with no upstream forwarding in air-gap mode |
| DNS rebinding protection | Yes | dnsmasq `stop-dns-rebind` enabled |
| Input validation on all user input | Yes | Strict `[a-zA-Z0-9_-]` regex, domain suffix validation |
| No dynamic code evaluation | Yes | Zero uses of `eval` in entire codebase |
| Structured audit logging | Yes | JSONL with timestamp, user, action, status, details |
| Tamper-evident audit trail | Optional | Capsule Protocol sealing (SHA3-256 + Ed25519 + hash chain) |
| Health checks on upstreams | Yes | Active health checks with configurable interval and threshold |
| Minimal dependency footprint | Yes | 4 required dependencies (bash, jq, Caddy, dnsmasq) |
| Air-gapped operation | Yes | No network dependencies after initial setup |
| Error handling | Yes | `set -euo pipefail` + ERR trap with audit logging |
| Service deregistration preserves history | Yes | Deregistered services archived, never deleted |
| Docker socket access is read-only | Yes | Monitoring uses read-only API queries only |
| SSH monitoring uses restricted keys | Yes | Dedicated user, restricted shell, ForceCommand |
| No telemetry or phone-home | Yes | Zero external network calls at runtime |
| Open source | Yes | Apache 2.0 license |
| Test coverage | Yes | Unit, integration, and smoke tiers (bats-core) |

---

## Related Documentation

- [Architecture](./architecture.md): System overview, DNS, TLS, routing, monitoring design
- [Why QP Conduit](./why-conduit.md): Business case and competitive positioning
- [Crypto Notice](./crypto-notice.md): Cryptographic algorithm analysis
- [Compliance](./compliance/README.md): Framework mappings (HIPAA, CMMC, PCI DSS)
- [Network Guide](./network-guide.md): DNS and TLS trust configuration

---

*QP Conduit v0.1.0, Quantum Pipes Technologies, LLC*
