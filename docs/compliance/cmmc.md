# CMMC 2.0

The Cybersecurity Maturity Model Certification (CMMC) 2.0 is required for Department of Defense contractors handling Controlled Unclassified Information (CUI). CMMC Level 2 aligns with NIST SP 800-171 Rev. 2 (110 controls). QP Conduit provides infrastructure-level capabilities that address system/communications protection, audit, and access control requirements for internal service networking.

---

## System and Communications Protection (SC)

| Control | Requirement | How Conduit Addresses It |
|---|---|---|
| **SC.L2-3.13.8** | Implement subnetworks for publicly accessible system components | Internal DNS (dnsmasq) resolves service names within the local network only. No DNS queries leave the infrastructure. Caddy reverse proxy restricts routing to registered upstreams. All service traffic stays on the internal network. |
| **SC.L2-3.13.11** | Employ FIPS-validated cryptography | **Partial.** TLS 1.3 uses AES-256-GCM (FIPS 197 / SP 800-38D) for bulk encryption. Audit sealing uses SHA3-256 (FIPS 202) and Ed25519 (FIPS 186-5). However, Caddy's TLS implementation uses Go's `crypto/tls`, which is not FIPS 140-3 validated. See the FIPS note below. |
| **SC.L2-3.13.15** | Protect the authenticity of communications sessions | TLS 1.3 with Ed25519 leaf certificates provides server authentication for every registered service. The internal CA issues certificates with service-specific SANs. Certificate rotation via `conduit-certs.sh --rotate` enables regular renewal. |

## Audit and Accountability (AU)

| Control | Requirement | How Conduit Addresses It |
|---|---|---|
| **AU.L2-3.3.1** | Create audit records for defined events | Every command (`conduit_setup`, `service_register`, `service_deregister`, `cert_rotate`, `cert_revoke`, `dns_flush`, `dns_add`, `dns_remove`, `health_change`, `monitor_alert`) writes a structured JSON entry to `audit.log`. Error traps log failures with script name and line number. |
| **AU.L2-3.3.2** | Unique user accountability | Audit entries include the `user` field populated from the operating system username. `services.json` tracks each service's lifecycle with creation timestamps. |
| **AU.L2-3.3.4** | Alert on audit logging process failure | `set -euo pipefail` with ERR trap ensures any failure is caught and logged. Applications monitoring `audit.log` can alert on `"status": "failure"` entries. |
| **AU.L2-3.3.5** | Correlate audit review, analysis, and reporting | Structured JSON format enables programmatic parsing, correlation, and reporting. Capsule Protocol integration provides chain-based temporal ordering and tamper detection. |
| **AU.L2-3.3.8** | Protect audit information | Optional Capsule Protocol sealing provides SHA3-256 + Ed25519 tamper evidence. Hash chain verification detects modification, deletion, or insertion of records. Audit files use owner-only permissions. |

## Access Control (AC)

| Control | Requirement | How Conduit Addresses It |
|---|---|---|
| **AC.L2-3.1.12** | Monitor and control remote access sessions | `conduit-status.sh` performs active health checks on every registered service, showing health status, TLS certificate expiry, and DNS resolution. `conduit-monitor.sh` provides CPU, memory, disk, GPU, and container statistics for the infrastructure. |
| **AC.L2-3.1.13** | Employ cryptographic mechanisms to protect remote access sessions | TLS 1.3 encrypts all internal service traffic. No unencrypted fallback exists for TLS-enabled services. |

## What Conduit Provides

- TLS 1.3 encryption on all internal service traffic
- DNS isolation: internal dnsmasq, no external query leakage
- Structured audit logging of all operations
- Service-level routing isolation via Caddy reverse proxy
- Active health monitoring with configurable endpoints
- Certificate lifecycle management (issuance, rotation, inspection)
- Hardware monitoring (GPU, CPU, memory, disk, containers)
- Optional tamper-evident audit sealing (Capsule Protocol)
- Air-gap compatible operation

## Complementary Controls

The following CMMC requirements are outside Conduit's scope:

- **AC.L2-3.1.1 through 3.1.11** Access control policies: application-level authentication, authorization, MFA
- **IA** Identification and authentication: user identity management, credential policies
- **IR** Incident response: organizational procedures (Conduit provides audit evidence)
- **MP** Media protection: physical media security
- **PE** Physical protection: facility security for server infrastructure
- **PS** Personnel security: organizational workforce management
- **RA** Risk assessment: organizational risk analysis process

## FIPS Note

Caddy uses Go's `crypto/tls` library, which is not FIPS 140-2/140-3 validated. For CMMC assessments requiring FIPS-validated cryptography (SC.L2-3.13.11), compile Caddy with the BoringCrypto module or substitute a FIPS-validated TLS terminator. The audit sealing layer uses FIPS-approved algorithms (SHA3-256, Ed25519).

For classified environments (SECRET and above), no software TLS terminator qualifies. Those deployments require NSA-approved Type 1 hardware encryption devices.

---

[Back to Compliance Overview](./README.md)
