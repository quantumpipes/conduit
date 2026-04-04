# Deployment Examples

Real-world deployment scenarios for QP Conduit. Each example includes prerequisites, setup steps, and operational procedures.

| Example | Scenario | Key Features |
|---|---|---|
| [Home Lab GPU](./home-lab-gpu.md) | Researcher with GPU servers and a NUC | GPU monitoring, Ollama, Grafana, trust on mobile |
| [Healthcare Clinic](./healthcare-clinic.md) | Air-gapped clinic with EHR and AI diagnostics | HIPAA compliance, audit trail, staff onboarding |
| [Defense Installation](./defense-installation.md) | Classified environment with STIG-hardened servers | Air-gap, Capsule sealing, CMMC, 90-day cert rotation |

## Prerequisites for All Examples

- Bash 4.0+, jq, Caddy 2.10+, dnsmasq
- QP Conduit repository cloned or extracted
- Network connectivity between the gateway host and all service hosts

## Documentation

- [Guide](../docs/GUIDE.md): Getting started walkthrough
- [Deployment](../docs/DEPLOYMENT.md): Full deployment guide
- [Network Guide](../docs/NETWORK-GUIDE.md): DNS and TLS trust configuration
