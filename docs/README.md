# Documentation

## Getting Started

| Document | Audience | Description |
|---|---|---|
| [Why Conduit](./why-conduit.md) | Decision-Makers, Architects | The case for on-premises infrastructure mesh |
| [Guide](./guide.md) | Operators, DevOps | End-to-end walkthrough: setup, register, monitor |

## Architecture and Security

| Document | Audience | Description |
|---|---|---|
| [Architecture](./architecture.md) | Developers, Auditors | Component model, data flow, trust boundaries |
| [Security Evaluation](./security.md) | CISOs, Security Teams | Threat model, cryptographic guarantees, hardening |
| [Crypto Notice](./crypto-notice.md) | Security Engineers | Algorithm inventory, key management, post-quantum stance |
| [Network Guide](./network-guide.md) | Network Engineers | DNS, TLS trust, split-horizon, air-gap configuration |

## Operations

| Document | Audience | Description |
|---|---|---|
| [Commands](./commands.md) | Operators | Reference for all 8 CLI scripts |
| [Deployment](./deployment.md) | DevOps, SREs | Docker, air-gap, multi-server, and production deployment |
| [API Reference](./api.md) | Developers | REST endpoints served by `server.py` |

## Admin Dashboard

| Document | Audience | Description |
|---|---|---|
| [Admin UI](./admin-ui.md) | Developers, Operators | React SPA: URL routing, blank slate, views, testing, design system |
| [Development](./development.md) | Contributors | Prerequisites, project structure, testing, code style |

## Compliance

| Document | Framework | Controls |
|---|---|---|
| [Compliance Overview](./compliance/) | All | Summary and methodology |
| [HIPAA](./compliance/hipaa.md) | HIPAA | Transmission security, access control, audit |
| [CMMC 2.0](./compliance/cmmc.md) | CMMC | Network architecture, encrypted sessions, logging |
| [FedRAMP](./compliance/fedramp.md) | FedRAMP | Transmission confidentiality, key management |
| [SOC 2](./compliance/soc2.md) | SOC 2 | Logical access, network security, monitoring |
| [ISO 27001](./compliance/iso27001.md) | ISO 27001 | Network security, web filtering, cryptography |
