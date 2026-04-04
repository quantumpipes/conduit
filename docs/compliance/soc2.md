# SOC 2 Type II

SOC 2 Type II reports evaluate the design and operating effectiveness of controls relevant to the Trust Services Criteria (TSC). QP Conduit provides infrastructure-level capabilities that support the Security and Availability categories, specifically logical access, encryption in transit, system monitoring, and change management for internal service networking.

---

## Common Criteria (CC) Mappings

### CC6: Logical and Physical Access Controls

| Criterion | Requirement | How Conduit Addresses It |
|---|---|---|
| **CC6.1** | Logical access security | Each registered service receives its own DNS entry, TLS certificate (Ed25519 CA, X25519 key exchange, AES-256-GCM), and Caddy routing rule. `services.json` maintains the authoritative registry of all services. Access is granted via `conduit-register.sh` and revoked via `conduit-deregister.sh`. |
| **CC6.6** | Restrict access through managed access points | Caddy reverse proxy is the sole ingress point for all registered services. Internal DNS (dnsmasq) resolves service names to local addresses only. No DNS queries leave the infrastructure. All service traffic routes through TLS-terminated Caddy. |
| **CC6.7** | Restrict transmission of data to authorized parties | TLS 1.3 encrypts all traffic between clients and the Caddy reverse proxy. Caddy forwards to registered upstream hosts only. No wildcard routing or open proxying. |

### CC7: System Operations

| Criterion | Requirement | How Conduit Addresses It |
|---|---|---|
| **CC7.1** | Detect and monitor for security events | `audit.log` records all operations as structured JSON (JSONL): service registration, deregistration, certificate rotation, DNS changes, and health check results. Error traps log failures with script name and line number. |
| **CC7.2** | Monitor system components for anomalies | `conduit-status.sh` performs active health checks on every registered service, reporting health status, TLS certificate expiry, and DNS resolution. `conduit-monitor.sh` provides CPU, memory, disk, GPU utilization, and Docker container statistics. Health state transitions generate audit entries. |
| **CC7.3** | Evaluate detected events | Structured JSON audit format enables programmatic parsing, filtering, and alerting. Capsule Protocol integration provides tamper-evident chain verification for event correlation. |
| **CC7.4** | Respond to identified events | `conduit-deregister.sh` removes routing, DNS, and certificates for a service immediately. Certificate rotation via `conduit-certs.sh --rotate` enables rapid response to compromised certificates. Both actions create audit records. |

### CC8: Change Management

| Criterion | Requirement | How Conduit Addresses It |
|---|---|---|
| **CC8.1** | Authorize, design, develop, configure, test, and implement changes | Every service registration and deregistration is logged with the operator's username, timestamp, and full service details. `conduit-certs.sh --inspect` allows review before rotation. Service state changes in `services.json` provide a complete history of active and inactive services. |

## What Conduit Provides

- TLS 1.3 encryption on all internal service traffic
- Managed access control point (Caddy reverse proxy)
- DNS isolation (dnsmasq, no external queries)
- Structured audit logging of all operations
- Optional tamper-evident audit sealing (Capsule Protocol)
- Active health monitoring with DNS and TLS expiry checks
- Hardware and container monitoring (CPU, memory, disk, GPU, Docker)
- Certificate lifecycle management (issuance, rotation, inspection)
- Service registry with full lifecycle tracking (active/inactive)

## Complementary Controls

The following SOC 2 requirements are outside Conduit's scope:

- **CC1** Control environment: organizational governance and oversight
- **CC2** Communication and information: organizational policies and procedures
- **CC3** Risk assessment: organizational risk management process
- **CC4** Monitoring activities: management oversight and review
- **CC5** Control activities: organizational policies and enforcement
- **CC6.4/CC6.5** Physical access controls: facility security
- **CC9** Risk mitigation: organizational risk treatment decisions
- User identity management, MFA, and role-based access: application-level (QP Core)
- Backup and disaster recovery: infrastructure-level
- Vulnerability management and patching: operating system level

---

[Back to Compliance Overview](./README.md)
