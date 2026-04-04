# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-04

### Added

- **Internal DNS resolution** via dnsmasq for automatic service discovery. Services register by name and resolve within the internal network without external DNS.
- **Internal TLS** with auto-generated certificates from Caddy's built-in certificate authority. All internal traffic encrypted with zero manual certificate management.
- **Service routing** via Caddy reverse proxy with health-aware load balancing. Unhealthy backends are automatically removed from rotation.
- **Server monitoring** with hardware health telemetry: CPU, memory, disk usage, GPU utilization (NVIDIA via nvidia-smi), and container inspection via Docker API.
- **Health check framework** with configurable intervals, thresholds, and timeout handling for all registered services.
- **Shared library** with modules: `common.sh` (logging, config), `dns.sh` (record management), `tls.sh` (certificate operations), `monitor.sh` (health collection), `routing.sh` (backend management).
- **Air-gap compatibility.** All features operate without internet connectivity. No external package repositories, certificate authorities, or APIs required.
- **Makefile** with targets for DNS setup, TLS provisioning, routing configuration, monitoring, and testing.
- **Documentation**: README, CONTRIBUTING, SECURITY, LICENSE, NOTICE, PATENTS.
- **GitHub configuration**: CI workflow (ShellCheck + bats), issue templates, PR template, CODEOWNERS.
