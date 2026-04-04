# HIPAA Security Rule

The HIPAA Security Rule (45 CFR Part 164, Subparts A and C) establishes standards for protecting electronic Protected Health Information (ePHI). QP Conduit provides infrastructure-level capabilities that support technical safeguards for transmission security, access control, and audit controls.

HIPAA has no formal certification. Compliance is demonstrated through risk analysis, attestation, and audit readiness.

---

## Technical Safeguards (164.312)

| Standard | Specification | How Conduit Addresses It |
|---|---|---|
| **164.312(e)(1)** | Transmission security | All internal service traffic is encrypted with TLS 1.3 (X25519 key exchange, AES-256-GCM bulk encryption). Caddy reverse proxy terminates TLS for every registered service. No plaintext HTTP routes exist unless explicitly opted out with `--no-tls`. |
| **164.312(e)(2)(i)** | Integrity controls | TLS 1.3 provides authenticated encryption (AES-256-GCM). Leaf certificates are signed by an internal Ed25519 CA. Certificate rotation via `conduit-certs.sh --rotate` reissues without downtime. |
| **164.312(a)(1)** | Access control | Each service receives its own DNS entry, TLS certificate, and routing rule. Services are isolated at the routing layer: Caddy forwards traffic only to the registered upstream host and port. `conduit-deregister.sh` removes access immediately. |
| **164.312(a)(2)(i)** | Unique user identification | `services.json` maintains the authoritative registry of all services (active and inactive) with creation timestamps, health paths, and protocol settings. Every mutation is attributed to the operating user in the audit log. |
| **164.312(b)** | Audit controls | Every operation writes a structured JSON entry to `audit.log` with timestamp, action, status, message, user, and details. Optional Capsule Protocol sealing provides tamper-evident cryptographic proof of audit integrity (SHA3-256 + Ed25519 + hash chain). |
| **164.312(c)(1)** | Integrity | Capsule Protocol integration seals audit records with SHA3-256 + Ed25519 signatures. Hash chain verification detects any modification, deletion, or insertion of records. |

## Administrative Safeguards (164.308)

| Standard | Specification | How Conduit Addresses It |
|---|---|---|
| **164.308(a)(1)(ii)(D)** | Information system activity review | `audit.log` provides structured records of all Conduit operations: service registration, deregistration, certificate rotation, DNS changes, and health check results. `conduit-status.sh` shows live health, TLS expiry, and DNS resolution per service. |
| **164.308(a)(1)** | Security management process | All configuration mutations (register, deregister, cert rotate, DNS flush) produce audit entries. Error traps log failures with script name and line number. |
| **164.308(a)(4)** | Information access management | Service access is explicit: `conduit-register.sh` grants routing, `conduit-deregister.sh` revokes it. No implicit trust. No wildcard routing. Deregistered services are marked inactive (never deleted). |

## What Conduit Provides

- TLS 1.3 encryption on all internal service traffic (Ed25519 CA, X25519 key exchange, AES-256-GCM)
- Service-level routing isolation via Caddy reverse proxy
- Internal DNS (dnsmasq) with no external query leakage
- Structured audit logging of all operations with user attribution
- Optional tamper-evident audit sealing (Capsule Protocol)
- Certificate lifecycle management: issuance, rotation, inspection, trust store installation
- Active health monitoring for every registered service
- Air-gap compatible operation with zero internet dependencies

## Complementary Controls

The following HIPAA requirements are outside Conduit's scope and must be addressed by the deployment environment:

- **164.312(d)** Person or entity authentication: user identity verification, MFA (QP Core handles this)
- **164.308(a)(3)** Workforce security: organizational HR and access policies
- **164.308(a)(6)** Security incident procedures: organizational response process (Conduit provides audit evidence for investigation)
- **164.310** Physical safeguards: facility security for server infrastructure
- **164.314** Business associate agreements: contractual obligations
- **Data at rest encryption:** LUKS, FileVault, or database-level encryption
- **FIPS encryption:** Caddy uses Go's `crypto/tls` library, which is not FIPS 140-3 validated. For environments requiring FIPS-validated encryption, use Caddy compiled with the BoringCrypto module or substitute a FIPS-validated TLS terminator.

---

[Back to Compliance Overview](./README.md)
