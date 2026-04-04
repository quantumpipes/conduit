---
title: "Compliance Overview"
description: "Compliance index for QP Conduit covering HIPAA, CMMC, PCI DSS, SOC 2, and NIST 800-53 framework mappings."
date_modified: "2026-04-04"
ai_context: |
  Compliance overview for QP Conduit. Index of framework mappings for
  HIPAA, CMMC L2, PCI DSS 4.0, SOC 2, and NIST 800-53. Distinguishes
  controls Conduit provides from controls requiring complementary solutions.
related:
  - ../security.md
  - ../CRYPTO-NOTICE.md
  - ../architecture.md
---

# Compliance Overview

QP Conduit provides infrastructure-level controls that support compliance with multiple regulatory frameworks. This directory contains framework-specific mappings.

## What Conduit Provides

| Control Area | Conduit Capability |
|---|---|
| Encryption in transit | TLS 1.3 on all internal routes (Ed25519, AES-256-GCM) |
| Audit logging | Structured JSONL with timestamp, user, action, status, details |
| Tamper-evident audit | Optional Capsule Protocol sealing (SHA3-256 + Ed25519 + hash chain) |
| Access accountability | Every registration, deregistration, and configuration change is logged |
| Certificate management | Internal CA with automatic issuance and renewal |
| Air-gap operation | Zero internet dependencies after initial setup |
| Service health monitoring | Active health checks with configurable intervals |

## What Requires Complementary Controls

| Control Area | What You Need |
|---|---|
| Authentication | Application-level authentication (QP Core handles this) |
| Authorization | Role-based access control at the application layer |
| Data at rest encryption | Database encryption, disk encryption (LUKS, FileVault) |
| Network segmentation | Firewall rules, VLANs, QP Tunnel for external access |
| Intrusion detection | Host-based IDS (OSSEC, Wazuh) or network IDS |
| Vulnerability scanning | Regular scanning of Caddy, dnsmasq, and OS packages |
| Incident response | Organizational IR plan and procedures |
| Physical security | Facility access controls (not a software concern) |

## Cryptographic Posture

| Algorithm | Standard | Usage |
|---|---|---|
| Ed25519 | FIPS 186-5 | CA and leaf certificate signatures |
| X25519 | RFC 7748 | TLS 1.3 key exchange |
| AES-256-GCM | FIPS 197 / SP 800-38D | TLS 1.3 bulk encryption |
| SHA3-256 | FIPS 202 | Audit entry hashing (Capsule Protocol) |
| TLS 1.3 | RFC 8446 | Transport encryption |

No deprecated algorithms: no SHA-1, MD5, RSA, DES, 3DES, RC4, or TLS < 1.3.

## Framework Mappings

- [HIPAA Security Rule](./hipaa.md): 45 CFR 164.312 technical and administrative safeguards
- [CMMC 2.0](./cmmc.md): Level 2 practices (NIST SP 800-171)
- [SOC 2 Type II](./soc2.md): Trust Services Criteria (CC6, CC7, CC8)
- [FedRAMP](./fedramp.md): NIST SP 800-53 Rev. 5 (SC, AU, CM families)
- [ISO 27001:2022](./iso27001.md): Annex A technological and organizational controls

## Related Documentation

- [Security Evaluation](../security.md): Full threat model and hardening checklist
- [Crypto Notice](../CRYPTO-NOTICE.md): Cryptographic analysis
- [Architecture](../architecture.md): System design
