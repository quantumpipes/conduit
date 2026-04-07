# QP Conduit - Makefile
# Internal infrastructure for on-premises AI deployments.
# https://github.com/quantumpipes/conduit
#
# Override CONDUIT_APP_NAME to rebrand for your project.
# Include this Makefile in your own: include path/to/conduit/Makefile

SHELL := /bin/bash
.DEFAULT_GOAL := help

CONDUIT_DIR := $(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))
UI_DIR := $(CONDUIT_DIR)/ui

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------
.PHONY: help
help: ## Show this help
	@echo ""
	@echo "  QP Conduit - On-Premises Infrastructure"
	@echo "  ========================================"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-26s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
.PHONY: conduit-setup
conduit-setup: ## Initialize Conduit (dnsmasq, Caddy, internal CA)
	@bash $(CONDUIT_DIR)/conduit-setup.sh

# ---------------------------------------------------------------------------
# Service Management
# ---------------------------------------------------------------------------
.PHONY: conduit-register
conduit-register: ## Register a service (NAME=grafana HOST=10.0.1.50:3000)
	@bash $(CONDUIT_DIR)/conduit-register.sh --name $(NAME) --host $(HOST) \
		$(if $(HEALTH),--health $(HEALTH),) \
		$(if $(NO_TLS),--no-tls,)

.PHONY: conduit-deregister
conduit-deregister: ## Remove a service (NAME=grafana)
	@bash $(CONDUIT_DIR)/conduit-deregister.sh --name $(NAME)

.PHONY: conduit-status
conduit-status: ## Show all services with health, TLS, and DNS status
	@bash $(CONDUIT_DIR)/conduit-status.sh

# ---------------------------------------------------------------------------
# Monitoring
# ---------------------------------------------------------------------------
.PHONY: conduit-monitor
conduit-monitor: ## Show hardware stats (GPU, CPU, memory, disk)
	@bash $(CONDUIT_DIR)/conduit-monitor.sh $(if $(SERVER),--server $(SERVER),)

.PHONY: conduit-monitor-containers
conduit-monitor-containers: ## Show Docker container health
	@bash $(CONDUIT_DIR)/conduit-monitor.sh --containers

# ---------------------------------------------------------------------------
# Certificates
# ---------------------------------------------------------------------------
.PHONY: conduit-certs
conduit-certs: ## List all TLS certificates with expiry dates
	@bash $(CONDUIT_DIR)/conduit-certs.sh

.PHONY: conduit-certs-rotate
conduit-certs-rotate: ## Rotate a certificate (NAME=grafana)
	@bash $(CONDUIT_DIR)/conduit-certs.sh --rotate $(NAME)

.PHONY: conduit-certs-inspect
conduit-certs-inspect: ## Inspect a certificate (NAME=grafana)
	@bash $(CONDUIT_DIR)/conduit-certs.sh --inspect $(NAME)

.PHONY: conduit-certs-trust
conduit-certs-trust: ## Install internal CA in system trust store
	@bash $(CONDUIT_DIR)/conduit-certs.sh --trust

# ---------------------------------------------------------------------------
# DNS
# ---------------------------------------------------------------------------
.PHONY: conduit-dns
conduit-dns: ## List all DNS entries
	@bash $(CONDUIT_DIR)/conduit-dns.sh

.PHONY: conduit-dns-flush
conduit-dns-flush: ## Flush DNS cache
	@bash $(CONDUIT_DIR)/conduit-dns.sh --flush

.PHONY: conduit-dns-resolve
conduit-dns-resolve: ## Test DNS resolution (DOMAIN=grafana.internal)
	@bash $(CONDUIT_DIR)/conduit-dns.sh --resolve $(DOMAIN)

# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------
.PHONY: conduit-verify
conduit-verify: ## Verify Capsule audit chain integrity
	@bash -c 'source $(CONDUIT_DIR)/conduit-preflight.sh && qp-capsule verify'

# ---------------------------------------------------------------------------
# Docker (recommended)
# ---------------------------------------------------------------------------
.PHONY: dev
dev: ## Start Conduit dashboard in Docker (http://localhost:9999)
	@docker compose -f $(CONDUIT_DIR)/docker-compose.yml up --build -d
	@docker compose -f $(CONDUIT_DIR)/docker-compose.yml logs -f

.PHONY: go
go: ## Start Conduit in Docker (background)
	@docker compose -f $(CONDUIT_DIR)/docker-compose.yml up --build -d

.PHONY: stop
stop: ## Stop Conduit containers
	@docker compose -f $(CONDUIT_DIR)/docker-compose.yml down

.PHONY: logs
logs: ## Tail Conduit container logs
	@docker compose -f $(CONDUIT_DIR)/docker-compose.yml logs -f

.PHONY: refresh
refresh: ## Rebuild and restart the app container
	@docker compose -f $(CONDUIT_DIR)/docker-compose.yml up --build -d app

# ---------------------------------------------------------------------------
# Admin UI (native, for development)
# ---------------------------------------------------------------------------
.PHONY: ui
ui: ## Start the admin dashboard via Docker (dev mode, port 5173)
	@docker run --rm -it \
		-v $(UI_DIR):/ui \
		-w /ui \
		-p 127.0.0.1:5173:5173 \
		--add-host=host.docker.internal:host-gateway \
		node:24-alpine \
		sh -c "npm install && npm run dev -- --host 0.0.0.0"

.PHONY: ui-build
ui-build: ## Build the admin dashboard for production
	@cd $(UI_DIR) && npm run build

.PHONY: ui-install
ui-install: ## Install admin dashboard dependencies
	@cd $(UI_DIR) && npm install

.PHONY: ui-typecheck
ui-typecheck: ## Type-check the admin dashboard
	@cd $(UI_DIR) && npm run typecheck

# ---------------------------------------------------------------------------
# Testing
# ---------------------------------------------------------------------------
.PHONY: test
test: ## Run all tests (requires bats-core)
	@bats $(CONDUIT_DIR)/tests/unit/ $(CONDUIT_DIR)/tests/integration/

.PHONY: test-unit
test-unit: ## Run unit tests only
	@bats $(CONDUIT_DIR)/tests/unit/

.PHONY: test-integration
test-integration: ## Run integration tests only
	@bats $(CONDUIT_DIR)/tests/integration/

.PHONY: test-smoke
test-smoke: ## Run smoke tests
	@bash $(CONDUIT_DIR)/tests/smoke/test_standalone.sh

.PHONY: test-ui
test-ui: ## Run admin dashboard tests
	@cd $(UI_DIR) && npm test

.PHONY: check
check: test ui-typecheck ## Run all tests + type-check UI
