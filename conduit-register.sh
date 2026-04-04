#!/usr/bin/env bash
# conduit-register.sh
# Register a service with QP Conduit: DNS, TLS, routing, and registry.
#
# Usage:
#   conduit-register.sh --name hub --host 127.0.0.1 --port 8090
#   conduit-register.sh --name grafana --host 10.0.1.5 --port 3000 --health /api/health --no-tls
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
Usage: conduit-register.sh [OPTIONS]

Register a service with QP Conduit. Creates DNS entry, issues TLS
certificate, adds Caddy reverse proxy route, and updates the registry.

Options:
  --name NAME           Service name (alphanumeric, hyphen, underscore)
  --host HOST           Upstream host IP or hostname
  --port PORT           Upstream port number
  --health PATH         Health check endpoint (default: /healthz)
  --protocol PROTO      Protocol: http or https (default: https)
  --no-tls              Skip TLS certificate issuance
  -h, --help            Show this help

Examples:
  conduit-register.sh --name hub --host 127.0.0.1 --port 8090
  conduit-register.sh --name grafana --host 10.0.1.5 --port 3000 --health /api/health
EOF
    exit 0
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
SERVICE_NAME=""
SERVICE_HOST=""
SERVICE_PORT=""
HEALTH_PATH="/healthz"
PROTOCOL="https"
NO_TLS=false

for arg in "$@"; do
    case "$arg" in
        --name=*) SERVICE_NAME="${arg#*=}" ;;
        --host=*) SERVICE_HOST="${arg#*=}" ;;
        --port=*) SERVICE_PORT="${arg#*=}" ;;
        --health=*) HEALTH_PATH="${arg#*=}" ;;
        --protocol=*) PROTOCOL="${arg#*=}" ;;
        --no-tls) NO_TLS=true ;;
        --help|-h) usage ;;
        *)
            log_error "Unknown option: $arg"
            usage
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Validate inputs
# ---------------------------------------------------------------------------
if [[ -z "$SERVICE_NAME" ]]; then
    log_error "Service name is required (--name)"
    usage
fi

if [[ -z "$SERVICE_HOST" ]]; then
    log_error "Service host is required (--host)"
    usage
fi

if [[ -z "$SERVICE_PORT" ]]; then
    log_error "Service port is required (--port)"
    usage
fi

validate_service_name "$SERVICE_NAME"

# ---------------------------------------------------------------------------
# Register service
# ---------------------------------------------------------------------------
echo ""
log_info "Registering service: $SERVICE_NAME"
echo "  Host:     $SERVICE_HOST"
echo "  Port:     $SERVICE_PORT"
echo "  Health:   $HEALTH_PATH"
echo "  Protocol: $PROTOCOL"
echo "  TLS:      $(if [[ "$NO_TLS" == "true" ]]; then echo "disabled"; else echo "enabled"; fi)"
echo ""

# Step 1: Add DNS entry
log_info "Adding DNS entry..."
dns_add_entry "$SERVICE_NAME" "$SERVICE_HOST"

# Step 2: Issue TLS certificate (unless --no-tls)
tls_cert_path=""
if [[ "$NO_TLS" == "false" ]]; then
    log_info "Issuing TLS certificate..."
    tls_issue_cert "$SERVICE_NAME"
    tls_cert_path="${CONDUIT_CERTS_DIR:-$(ensure_config_dir)/certs}/${SERVICE_NAME}/cert.pem"
fi

# Step 3: Add routing rule
log_info "Adding routing rule..."
route_add "$SERVICE_NAME" "${SERVICE_HOST}:${SERVICE_PORT}" "$tls_cert_path"

# Step 4: Update service registry
log_info "Updating service registry..."
registry_add_service "$SERVICE_NAME" "$SERVICE_HOST" "$SERVICE_PORT" "$PROTOCOL" "$HEALTH_PATH"

# Step 5: Regenerate Caddyfile and reload
log_info "Regenerating Caddyfile..."
route_generate_caddyfile
route_reload 2>/dev/null || log_warn "Caddy not running. Start it to activate this route."

# Step 6: Audit log
audit_log "service_register" "success" \
    "Registered service: ${SERVICE_NAME} (${SERVICE_HOST}:${SERVICE_PORT})" \
    "{\"name\":\"${SERVICE_NAME}\",\"host\":\"${SERVICE_HOST}\",\"port\":\"${SERVICE_PORT}\",\"protocol\":\"${PROTOCOL}\",\"health_path\":\"${HEALTH_PATH}\",\"tls\":$(if [[ "$NO_TLS" == "true" ]]; then echo "false"; else echo "true"; fi)}"

echo ""
log_success "Service '$SERVICE_NAME' registered."
echo "  URL: https://${SERVICE_NAME}.${CONDUIT_DOMAIN}"
echo ""
