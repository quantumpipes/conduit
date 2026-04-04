---
title: "QP Conduit Developer Guide"
description: "Developer guide for contributing to QP Conduit. Covers prerequisites, project structure, testing, adding commands and modules, Docker and native workflows, and code style."
date_modified: "2026-04-04"
ai_context: |
  Developer guide for QP Conduit contributors. Prerequisites: bash 4+, jq,
  bats-core, Node 22+, Python 3.14. Testing with bats (unit, integration,
  smoke) and npm test (UI). Docker workflow via make dev/refresh. Native
  workflow with uvicorn + npm run dev. Code conventions: shellcheck,
  set -euo pipefail, no eval, quoted variables.
related:
  - ./COMMANDS.md
  - ./ADMIN-UI.md
  - ./architecture.md
---

# Developer Guide

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| `bash` | 4.0+ | Shell scripts |
| `jq` | 1.6+ | JSON processing |
| `bats-core` | 1.10+ | Shell test framework |
| `node` | 22+ | Admin dashboard |
| `npm` | 10+ | Package management |
| `python` | 3.14+ | Admin API server |
| `pip` | Latest | Python dependency management |
| `shellcheck` | 0.9+ | Shell script linter |
| `docker` | 24+ | Container-based development |

Install bats-core from your package manager or from source:

```bash
# macOS
brew install bats-core

# Ubuntu/Debian
sudo apt install bats

# From source
git clone https://github.com/bats-core/bats-core.git
cd bats-core && sudo ./install.sh /usr/local
```

## Project Structure

```
conduit/
  conduit-preflight.sh      Pre-flight checks (sourced by all commands)
  conduit-setup.sh           Initialize Conduit
  conduit-register.sh        Register a service
  conduit-deregister.sh      Deregister a service
  conduit-status.sh          Show service health status
  conduit-monitor.sh         Show hardware stats
  conduit-certs.sh           Manage TLS certificates
  conduit-dns.sh             Manage DNS entries
  server.py                  FastAPI admin API server
  Makefile                   Build and run automation
  Dockerfile                 Multi-stage Docker build (Node + Python)
  docker-compose.yml         Docker Compose for the dashboard
  requirements.txt           Python dependencies
  .env.conduit.example       Environment variable template
  lib/
    common.sh                Logging, validation, config defaults
    audit.sh                 Structured JSONL audit log + Capsule sealing
    registry.sh              Service registry CRUD (jq-based JSON)
    dns.sh                   dnsmasq configuration and management
    tls.sh                   TLS certificate lifecycle (Caddy CA)
    routing.sh               Caddy reverse proxy route management
  templates/
    Caddyfile.service.tpl    Per-service Caddyfile template
  ui/
    src/
      app.tsx                Root component with lazy-loaded views
      stores/app-store.ts    Zustand global state (view, filters, sidebar)
      lib/types.ts           TypeScript interfaces for all data models
      components/
        layout/              App shell, sidebar, header
        views/
          dashboard/         Global health overview
          services/          Service list and management
          dns/               DNS entry management
          tls/               Certificate management
          servers/           Server monitoring
          routing/           Proxy route management
  tests/
    unit/                    bats unit tests
    integration/             bats integration tests
    smoke/                   End-to-end smoke tests
  docs/                      Documentation
  examples/                  Deployment examples
```

## Running Tests

```bash
# All tests (unit + integration)
make test

# Unit tests only
make test-unit

# Integration tests only
make test-integration

# Smoke tests (requires a running Conduit instance)
make test-smoke

# Admin UI tests
make test-ui

# All tests + UI type-check
make check
```

Tests use [bats-core](https://github.com/bats-core/bats-core) for shell scripts. Each test file lives in `tests/unit/` or `tests/integration/` and follows the naming convention `test_<module>.bats`.

## Adding a New Command

1. Create `conduit-<name>.sh` in the project root
2. Add the shebang and copyright header:
   ```bash
   #!/usr/bin/env bash
   # conduit-<name>.sh
   # One-line description.
   #
   # Copyright 2026 Quantum Pipes Technologies, LLC
   # SPDX-License-Identifier: Apache-2.0
   ```
3. Add `set -euo pipefail` immediately after the header
4. Source `conduit-preflight.sh`:
   ```bash
   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   source "$SCRIPT_DIR/conduit-preflight.sh"
   ```
5. Add a `usage()` function with `--help|-h` handling
6. Parse arguments with a `for arg in "$@"` loop and `case` matching
7. Validate all inputs using `validate_service_name`, `_validate_port`, etc.
8. Write an `audit_log` entry at the end of each operation
9. Add a Make target in `Makefile`
10. Add the script to `docker-compose.yml` volumes
11. Add the script to `Dockerfile` COPY
12. Write unit tests in `tests/unit/test_<name>.bats`
13. Add an API endpoint in `server.py` (if applicable)
14. Document the command in `docs/COMMANDS.md`

## Adding a New Lib Module

1. Create `lib/<name>.sh`
2. Add the standard header with `set -euo pipefail`
3. Source `common.sh`:
   ```bash
   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   source "$SCRIPT_DIR/common.sh"
   ```
4. Add the source line to `conduit-preflight.sh` (order matters; place after dependencies)
5. Prefix internal functions with `_` (e.g., `_helper_func`)
6. Write unit tests in `tests/unit/test_<name>.bats`
7. Document the module in the architecture docs

## Adding a New UI View

1. Create `ui/src/components/views/<name>/<name>-view.tsx`
2. Add the view type to `ui/src/stores/app-store.ts` (`View` type union)
3. Add a lazy import in `ui/src/app.tsx` and add it to the `views` object
4. Add the navigation entry in the sidebar component
5. Add any new API types to `ui/src/lib/types.ts`
6. Create an API module in `ui/src/lib/api/` if the view needs new endpoints
7. Run `make ui-typecheck` to verify

## Docker Development Workflow

The recommended development workflow uses Docker:

```bash
# Start the dashboard (builds UI + starts server)
make dev

# Rebuild after code changes
make refresh

# Stop
make stop

# View logs
make logs
```

The Docker Compose setup:

- Builds the React UI in a Node 22 Alpine stage
- Runs the FastAPI server with Python 3.14 and uvicorn
- Mounts shell scripts and lib/ as volumes for live reloading
- Mounts the config directory for access to services.json and audit.log
- Mounts the Docker socket for container monitoring
- Exposes port 9999

## Native Development Workflow

For faster iteration without Docker:

```bash
# Install UI dependencies
make ui-install

# Start UI dev server (port 5173, with HMR)
make ui

# In another terminal: start the API server
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 9999 --reload

# Build the UI for production
make ui-build
```

The Vite dev server proxies `/api/*` requests to the FastAPI server automatically.

## Code Style

### Shell Scripts

- Every script starts with `set -euo pipefail`
- No `eval` anywhere. This is enforced.
- Quote all variable expansions: `"$var"`, not `$var`
- Use `local` for all function-scoped variables
- Validate all user input with strict regexes (`^[a-zA-Z0-9_-]+$`)
- Use `jq` for all JSON manipulation (no sed/awk on JSON)
- Write structured JSON audit entries for state-changing operations
- Run `shellcheck` on all `.sh` files before committing

### Python

- Type hints on all function signatures
- Use `subprocess.run` with `capture_output=True` and `timeout`
- Never use `shell=True` in subprocess calls
- Use `Path` objects for file paths

### TypeScript

- Strict mode enabled
- All data types defined in `ui/src/lib/types.ts`
- Zustand for global state
- Lazy-loaded views for code splitting
- Semantic color tokens from the theme (no hardcoded colors)

## Commit Conventions

Use conventional commit prefixes with scope:

```
feat(conduit): add GPU temperature alerting
fix(dns): handle empty hosts file on first run
test(registry): add tests for duplicate service detection
docs(guide): add certificate rotation section
polish(ui): improve service table responsiveness
chore(docker): update Node base image to 22.5
```

Scopes: `conduit`, `dns`, `tls`, `routing`, `registry`, `audit`, `monitor`, `ui`, `docker`, `docs`

---

## Related Documentation

- [Commands Reference](./COMMANDS.md): What each script does
- [Admin UI](./ADMIN-UI.md): Dashboard architecture
- [API Reference](./API.md): REST API documentation
- [Architecture](./architecture.md): System design
