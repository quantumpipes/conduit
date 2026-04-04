#!/usr/bin/env bash
# conduit-setup.sh
# Initialize QP Conduit: DNS, TLS, service routing, and monitoring.
#
# Sets up dnsmasq for internal DNS resolution, initializes Caddy with
# an internal CA for TLS, creates the services registry, and generates
# the initial audit log entry.
#
# Copyright 2026 Quantum Pipes Technologies, LLC
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/conduit-preflight.sh"

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
usage() {
    cat <<EOF
Usage: conduit-setup.sh [OPTIONS]

Initialize QP Conduit on the local network. Configures dnsmasq for DNS,
Caddy for TLS and reverse proxying, and creates the service registry.

Options:
  --domain DOMAIN       Base domain (default: qp.local)
  --dns-port PORT       DNS listen port (default: 53)
  --proxy-port PORT     HTTPS proxy port (default: 443)
  --upstream-dns IP     Upstream DNS server (default: 1.1.1.1)
  --skip-dns            Skip dnsmasq configuration
  --skip-tls            Skip TLS CA initialization
  -h, --help            Show this help

Environment:
  CONDUIT_DOMAIN        Base domain (alternative to --domain)
  CONDUIT_DNS_PORT      DNS port (alternative to --dns-port)
  CONDUIT_PROXY_PORT    Proxy port (alternative to --proxy-port)
  CONDUIT_UPSTREAM_DNS  Upstream DNS (alternative to --upstream-dns)
EOF
    exit 0
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
SKIP_DNS=false
SKIP_TLS=false

for arg in "$@"; do
    case "$arg" in
        --domain=*) CONDUIT_DOMAIN="${arg#*=}" ;;
        --dns-port=*) CONDUIT_DNS_PORT="${arg#*=}" ;;
        --proxy-port=*) CONDUIT_PROXY_PORT="${arg#*=}" ;;
        --upstream-dns=*) CONDUIT_UPSTREAM_DNS="${arg#*=}" ;;
        --skip-dns) SKIP_DNS=true ;;
        --skip-tls) SKIP_TLS=true ;;
        --help|-h) usage ;;
        *)
            log_error "Unknown option: $arg"
            usage
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
log_info "Starting QP Conduit setup..."
log_info "Domain: ${CONDUIT_DOMAIN}"

# ---------------------------------------------------------------------------
# Step 1: Ensure config directory
# ---------------------------------------------------------------------------
log_info "Creating configuration directory..."
config_dir="$(ensure_config_dir)"
mkdir -p "${config_dir}/logs"
mkdir -p "${config_dir}/routes"
log_success "Config directory: $config_dir"

# ---------------------------------------------------------------------------
# Step 2: Initialize service registry
# ---------------------------------------------------------------------------
log_info "Initializing service registry..."
registry_init
log_success "Service registry ready"

# ---------------------------------------------------------------------------
# Step 3: Configure dnsmasq
# ---------------------------------------------------------------------------
if [[ "$SKIP_DNS" == "false" ]]; then
    log_info "Configuring dnsmasq..."
    require_cmd dnsmasq

    # Create the hosts file
    hosts_file="${config_dir}/conduit-hosts"
    if [[ ! -f "$hosts_file" ]]; then
        touch "$hosts_file"
        chmod 600 "$hosts_file"
    fi

    # Generate dnsmasq config
    dns_generate_dnsmasq_conf
    log_success "dnsmasq configured"
else
    log_info "Skipping dnsmasq configuration (--skip-dns)"
fi

# ---------------------------------------------------------------------------
# Step 4: Initialize TLS CA
# ---------------------------------------------------------------------------
if [[ "$SKIP_TLS" == "false" ]]; then
    log_info "Initializing internal TLS CA..."
    require_cmd caddy
    require_cmd openssl

    tls_ensure_ca
    log_success "TLS CA ready"
else
    log_info "Skipping TLS initialization (--skip-tls)"
fi

# ---------------------------------------------------------------------------
# Step 5: Generate initial Caddyfile
# ---------------------------------------------------------------------------
log_info "Generating Caddyfile..."
route_generate_caddyfile
log_success "Caddyfile ready"

# ---------------------------------------------------------------------------
# Step 6: Audit log
# ---------------------------------------------------------------------------
audit_log "setup" "success" \
    "Conduit initialized: domain=${CONDUIT_DOMAIN}, dns_port=${CONDUIT_DNS_PORT}, proxy_port=${CONDUIT_PROXY_PORT}" \
    "{\"domain\":\"${CONDUIT_DOMAIN}\",\"dns_port\":\"${CONDUIT_DNS_PORT}\",\"proxy_port\":\"${CONDUIT_PROXY_PORT}\",\"skip_dns\":${SKIP_DNS},\"skip_tls\":${SKIP_TLS}}"

echo ""
log_success "QP Conduit setup complete."
echo ""
echo "Next steps:"
echo "  1. Start dnsmasq:  dnsmasq -C ${CONDUIT_DNSMASQ_CONF}"
echo "  2. Start Caddy:    caddy run --config ${CONDUIT_CADDYFILE}"
echo "  3. Register a service: conduit-register.sh --name hub --host 127.0.0.1 --port 8090"
echo ""
