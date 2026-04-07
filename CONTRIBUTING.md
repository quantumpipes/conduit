# Contributing to QP Conduit

Thank you for your interest in contributing. QP Conduit is open source under the Apache 2.0 license and welcomes contributions from the community.

## Repository Structure

```
conduit/
  conduit-*.sh           8 CLI commands (setup, register, deregister, status, monitor, certs, dns, logs)
  lib/                   Shared shell modules (common, registry, audit, dns, tls, routing)
  server.py              FastAPI admin API (wraps shell commands, serves UI)
  ui/                    React 19 + TypeScript admin dashboard
  tests/                 bats-core unit, integration, and smoke tests
  docs/                  Architecture, security, compliance, guides
  conformance/           Audit log golden test vectors
  examples/              Deployment walkthroughs
```

## Types of Contributions

**Shell scripts.** Bug fixes, new commands, lib module improvements. Must pass shellcheck and bats tests.

**Admin UI.** React components, new views, design system updates. Must pass vitest and typecheck.

**API server.** New endpoints, performance, validation. Must match shell command behavior.

**Documentation.** Guides, examples, compliance mappings. Must be verified against code.

## Getting Started

```bash
# Clone and enter the repo
git clone https://github.com/quantumpipes/conduit.git
cd conduit

# Start the full stack in Docker
make dev

# Or start just the admin UI with hot reload
make ui
```

## Running Tests

```bash
# Shell tests (bats-core)
make test              # All tests
make test-unit         # Unit tests only
make test-integration  # Integration tests only
make test-smoke        # Smoke tests (requires running Conduit)

# Admin UI tests (vitest + React Testing Library)
make test-ui           # 225 tests, 97%+ coverage

# Type-check the UI
make ui-typecheck

# Everything
make check
```

## Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-change`)
3. Make your changes
4. Run the relevant test suite (`make test` and/or `make test-ui`)
5. Commit with a [conventional commit](https://www.conventionalcommits.org/) message
6. Open a pull request

Keep PRs focused on a single change. Include tests for new functionality. Update documentation if behavior changes.

## Code Standards

### Shell Scripts

- `set -euo pipefail` at the top of every script
- `local` for all function variables
- Quote all variable expansions: `"$var"` not `$var`
- Validate inputs with strict regexes (`^[a-zA-Z0-9_-]+$`)
- Never use `eval`
- Use `jq` for JSON (no sed/awk on JSON)
- Run `shellcheck` on all `.sh` files

### Python (server.py)

- Type hints on all function signatures
- `subprocess.run` with `capture_output=True` and `timeout`
- Never `shell=True`
- `Path` objects for file paths

### TypeScript (Admin UI)

- Strict mode enabled
- All data types in `ui/src/lib/types.ts`
- Semantic color tokens from theme (no hardcoded hex)
- Tests colocated with source (`*.test.tsx` next to `*.tsx`)
- AAA pattern (Arrange, Act, Assert)

## Architecture Principles

- **Air-gap compatible.** No features requiring internet connectivity.
- **Health-aware.** Every routed service has a health check.
- **Secure by default.** Internal TLS everywhere, strict input validation.
- **Observable.** All state changes logged as structured JSON.

## Security

Report vulnerabilities via [SECURITY.md](./SECURITY.md), not public issues.

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

Copyright 2026 Quantum Pipes Technologies, LLC.
