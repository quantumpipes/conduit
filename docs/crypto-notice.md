---
title: "Cryptographic Notice"
description: "Cryptographic analysis of QP Conduit: Caddy internal CA, TLS 1.3, key exchange, FIPS considerations, and comparison to external CAs."
date_modified: "2026-04-04"
ai_context: |
  Cryptographic inventory for QP Conduit. Caddy internal CA (Ed25519 root,
  10-year validity), TLS 1.3 with X25519 key exchange and AES-256-GCM,
  audit sealing with SHA3-256 + Ed25519 via Capsule Protocol. FIPS
  considerations (Go crypto/tls). Comparison to Let's Encrypt and private PKI.
related:
  - ./security.md
  - ./architecture.md
---

# Cryptographic Notice

## TLS Layer (Caddy Internal CA)

Conduit delegates all TLS operations to Caddy's built-in certificate authority. Conduit does not implement any cryptographic primitives itself.

| Layer | Algorithm | Standard | Implementation |
|---|---|---|---|
| Root CA signature | Ed25519 | RFC 8032 / FIPS 186-5 | Caddy (Go `crypto/ed25519`) |
| Leaf cert signature | Ed25519 | RFC 8032 / FIPS 186-5 | Caddy (Go `crypto/ed25519`) |
| TLS key exchange | X25519 | RFC 7748 | Go `crypto/tls` |
| Bulk encryption | AES-256-GCM | FIPS 197 / SP 800-38D | Go `crypto/aes` |
| TLS version | 1.3 only | RFC 8446 | Go `crypto/tls` |

### Certificate Properties

| Property | Value |
|---|---|
| Root CA algorithm | Ed25519 |
| Root CA validity | 10 years |
| Root CA key storage | File system, mode 600, managed by Caddy |
| Leaf cert algorithm | Ed25519 |
| Leaf cert validity | 1 year (auto-renewed by Caddy) |
| Certificate format | X.509v3 |
| SAN | DNS name of the service (e.g., `core.qp.local`) |

## Audit Layer (Capsule Protocol, Optional)

When `qp-capsule` is installed, every audit entry is sealed with:

| Algorithm | Standard | Purpose |
|---|---|---|
| SHA3-256 | FIPS 202 | Content integrity hashing |
| Ed25519 | FIPS 186-5 | Non-repudiation signatures |
| Hash chain | N/A | Tamper-evident linking |

If `qp-capsule` is not installed, audit logging continues normally without cryptographic sealing. The system never blocks on Capsule availability.

## What Conduit Provides vs. What Caddy Handles

| Responsibility | Owner |
|---|---|
| CA key generation | Caddy |
| Certificate issuance | Caddy |
| Certificate renewal | Caddy (automatic) |
| TLS handshake | Caddy (Go `crypto/tls`) |
| Cipher selection | Caddy (TLS 1.3 default suite) |
| CA trust distribution | Conduit (`conduit-certs.sh --trust`) |
| Certificate rotation trigger | Conduit (`conduit-certs.sh --rotate`) |
| Certificate lifecycle tracking | Conduit (audit log) |
| DNS resolution | Conduit (dnsmasq) |

Conduit orchestrates the lifecycle. Caddy performs the cryptography.

## FIPS Considerations

Caddy's TLS is implemented in Go's standard library (`crypto/tls`). As of Go 1.24, the standard library is not FIPS 140-2/140-3 validated. However:

1. **BoringCrypto mode.** Go supports building with BoringSSL as the crypto backend (`GOEXPERIMENT=boringcrypto`). BoringSSL has FIPS 140-2 validation. Caddy can be built in this mode for FIPS-mandatory environments.

2. **Algorithm compliance.** The algorithms used (Ed25519, AES-256-GCM, X25519) are all NIST-approved and appear in FIPS standards (FIPS 186-5, FIPS 197, SP 800-38D).

3. **For strict FIPS requirements:** Build Caddy from source with `GOEXPERIMENT=boringcrypto` and verify the BoringSSL FIPS module version matches your compliance requirements.

## Comparison to External CA

| Property | Conduit (Internal CA) | Let's Encrypt | Private PKI (e.g., step-ca) |
|---|---|---|---|
| Internet required | No | Yes (ACME challenge) | No |
| Air-gap compatible | Yes | No | Yes |
| Trust model | Explicit (distribute CA cert) | Public trust (pre-installed in browsers) | Explicit (distribute CA cert) |
| Domain validation | None (you control the CA) | HTTP-01 or DNS-01 challenge | Organization-defined |
| Certificate cost | Free | Free | Free |
| Renewal | Automatic (Caddy) | Automatic (ACME) | Automatic (step-ca) |
| Root CA management | Caddy handles everything | N/A (external CA) | Manual setup required |
| Audit trail | Built-in (Conduit audit log) | ACME logs | Depends on implementation |

## Why Internal CA Is Appropriate for On-Premises

1. **No internet dependency.** Let's Encrypt requires internet access for ACME challenges. On-premises and air-gapped deployments cannot use it.

2. **No domain ownership required.** Internal domains like `.internal`, `.local`, and `.test` are not publicly resolvable. External CAs cannot issue certificates for them.

3. **Simplified trust model.** You control the CA and all clients. Trust distribution is a one-time operation per client device. No dependency on external trust chains or CRL/OCSP infrastructure.

4. **Faster issuance.** Certificates are issued locally in milliseconds, not minutes. No network round-trips to an external CA.

5. **Operational simplicity.** One tool (Caddy) handles CA management, certificate issuance, TLS termination, and renewal. No separate PKI infrastructure to maintain.

## No Deprecated Cryptography

| Algorithm | Status |
|---|---|
| SHA-1 | Not used |
| MD5 | Not used |
| RSA | Not used |
| DES / 3DES | Not used |
| RC4 | Not used |
| TLS 1.0 / 1.1 / 1.2 | Not used |

## Review Schedule

Review this notice quarterly or whenever Caddy releases a major version with cryptographic changes.

**Last reviewed:** 2026-04-04
