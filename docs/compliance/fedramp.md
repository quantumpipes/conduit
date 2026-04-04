# FedRAMP (NIST SP 800-53 Rev. 5)

The Federal Risk and Authorization Management Program (FedRAMP) standardizes security assessment for cloud services used by federal agencies. FedRAMP controls are drawn from NIST SP 800-53 Rev. 5. QP Conduit provides infrastructure-level capabilities that address controls in the System and Communications Protection (SC), Audit (AU), and Configuration Management (CM) families for internal service networking.

---

## System and Communications Protection (SC)

| Control | Title | Baseline | How Conduit Addresses It |
|---|---|---|---|
| **SC-8** | Transmission Confidentiality and Integrity | Moderate | TLS 1.3 encrypts all traffic between clients and the Caddy reverse proxy. Every registered service receives a TLS certificate from the internal Ed25519 CA. No plaintext HTTP routes exist unless explicitly opted out with `--no-tls`. |
| **SC-8(1)** | Cryptographic Protection (Transmission) | Moderate | TLS 1.3 with X25519 key exchange and AES-256-GCM bulk encryption. Leaf certificates signed by an internal Ed25519 CA. Certificate SANs include the service FQDN (`<name>.<domain>`). |
| **SC-12** | Cryptographic Key Establishment and Management | Moderate | `conduit-certs.sh --rotate` handles certificate rotation with audit logging. The internal CA issues per-service certificates at registration time. `conduit-certs.sh --inspect` provides certificate details for review. `conduit-certs.sh --trust` installs the CA in the system trust store. |
| **SC-13** | Cryptographic Protection | Low | TLS 1.3 uses AES-256-GCM (FIPS 197 / SP 800-38D). Audit sealing uses SHA3-256 (FIPS 202) and Ed25519 (FIPS 186-5). However, Caddy's TLS implementation uses Go's `crypto/tls`, which is not FIPS 140-3 validated. See the FIPS note below. |

## Audit and Accountability (AU)

| Control | Title | Baseline | How Conduit Addresses It |
|---|---|---|---|
| **AU-2** | Event Logging | Low | All operations are logged: `conduit_setup`, `service_register`, `service_deregister`, `cert_rotate`, `cert_revoke`, `dns_flush`, `dns_add`, `dns_remove`, `health_change`, `monitor_alert`, and error traps. Each entry includes timestamp, action, status, message, user, and details. |
| **AU-3** | Content of Audit Records | Low | Structured JSON format with ISO 8601 timestamp, action name, success/failure status, descriptive message, operating user, and action-specific detail fields (service name, host, port, protocol, health path). |
| **AU-6** | Audit Review, Analysis, and Reporting | Low | JSONL format enables programmatic parsing and correlation. Capsule Protocol integration provides chain-based temporal ordering and tamper detection. |
| **AU-9** | Protection of Audit Information | Low | Audit files use owner-only permissions. Optional Capsule Protocol sealing provides SHA3-256 + Ed25519 tamper evidence with hash chain verification. |
| **AU-9(3)** | Cryptographic Protection of Audit Information | High | Capsule Protocol seals each audit event with SHA3-256 (FIPS 202) integrity hash + Ed25519 (FIPS 186-5) digital signature. Chain verification detects modification, deletion, or insertion. |
| **AU-11** | Audit Record Retention | Low | `audit.log` uses append-only JSONL format. Deregistered services are marked inactive, never deleted. `capsules.db` provides SQLite-backed persistent storage for sealed records. Retention period is configurable at the deployment level. |

## Configuration Management (CM)

| Control | Title | Baseline | How Conduit Addresses It |
|---|---|---|---|
| **CM-3** | Configuration Change Control | Moderate | Every service registration and deregistration creates an audit entry with the operator's username, timestamp, and full service details. Certificate rotations are logged. DNS cache flushes are logged. `services.json` provides the authoritative service state. |
| **CM-6** | Configuration Settings | Low | `services.json` and the generated Caddyfile maintain the authoritative routing configuration. All state lives in documented, structured files under the Conduit config directory. |

## Air-Gapped Operation

QP Conduit is designed for air-gapped federal environments:

- Zero runtime internet dependencies after initial setup
- No telemetry, analytics, or license server
- No phone-home or update checks
- Internal DNS (dnsmasq) resolves locally, never queries external servers
- All certificates issued by the local CA (no ACME, no Let's Encrypt)
- State stored in local files (`services.json`, `audit.log`, Caddyfile)

## What Conduit Provides

- TLS 1.3 encryption on all internal service traffic
- Internal DNS with no external query leakage
- Structured audit logging with optional cryptographic sealing
- Certificate lifecycle management (issuance, rotation, trust)
- Active health monitoring for registered services
- Hardware and container monitoring
- Air-gap compatible operation
- Configuration state tracking with full audit trail

## Complementary Controls

The following FedRAMP control families are outside Conduit's scope:

- **AC-2 through AC-16** Account management, separation of duties, least privilege: application-level
- **AT** Awareness and training: organizational
- **CA** Assessment, authorization, and monitoring: organizational
- **CP** Contingency planning: infrastructure-level backup and recovery
- **IA** Identification and authentication: user identity management, MFA
- **IR** Incident response: organizational procedures (Conduit provides audit evidence)
- **PE** Physical and environmental protection: facility security

## FIPS Note

Caddy uses Go's `crypto/tls` library, which is not FIPS 140-2/140-3 validated. For FedRAMP Moderate and High baselines requiring FIPS-validated encryption (SC-13), compile Caddy with the BoringCrypto module or substitute a FIPS-validated TLS terminator. The audit sealing layer uses FIPS-approved algorithms.

The infrastructure must run on FedRAMP-authorized hardware to satisfy the authorization boundary requirements.

---

[Back to Compliance Overview](./README.md)
