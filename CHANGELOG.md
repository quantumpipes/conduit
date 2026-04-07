# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-07

### Added

- **URL routing.** Each view has a dedicated URL (`/`, `/services`, `/dns`, `/tls`, `/servers`, `/routing`). Deep links, bookmarks, and browser back/forward all work. History API integration in the Zustand store with popstate listener.
- **Blank slate experience.** Interactive SVG topology visualization with animated data packets, 5 capability cards, principles strip, and step-by-step getting started flow. Shown when no services, certs, DNS, or servers are registered.
- **Rich per-view empty states.** Each view (Services, DNS, TLS, Servers, Routing) shows a section-colored empty state with icon, feature pills, CLI command, and navigation action via the shared `ViewBlankSlate` component.
- **Test suite.** 225 tests across 17 files covering stores, API client, formatters, all shared components, and all 6 views. 97.3% statement coverage, 97.2% line coverage. Vitest + React Testing Library + happy-dom.
- **Docker-based UI development.** `make ui` runs Vite inside a Node 24 container with mounted source for hot reload. No local Node.js required.

### Changed

- **Node 22 to Node 24 LTS** in Dockerfile and Makefile `ui` target.
- **Python dependencies updated:** FastAPI 0.115.12 to 0.135.3, Uvicorn 0.34.3 to 0.44.0, Pydantic 2.11.4 to 2.12.5. Pydantic 2.12.5 ships prebuilt `pydantic-core` wheels for Python 3.14 (the prior version required Rust compilation).
- **Documentation restructured.** All doc filenames renamed from UPPERCASE to lowercase kebab-case. Cross-references updated across all 17 docs. New `docs/README.md` index following the capsule pattern.
- **TLS API paths fixed.** Frontend was calling `/api/tls/certs` but server endpoint is `/api/tls`. Aligned all TLS API paths.
- **TLS page title.** "TLS TlsCerts" corrected to "TLS Certificates".
- **`@vitest/coverage-v8`** added as devDependency for coverage reporting.

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
