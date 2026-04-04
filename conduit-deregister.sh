#!/usr/bin/env bash
# conduit-deregister.sh
# Remove a service from QP Conduit: DNS, TLS, routing, and registry.
#
# Usage:
#   conduit-deregister.sh --name hub
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
Usage: conduit-deregister.sh [OPTIONS]

Remove a service from QP Conduit. Removes DNS entry, archives TLS
certificate, removes routing rule, and updates the registry.

Options:
  --name NAME           Service name to deregister
  -h, --help            Show this help

Examples:
  conduit-deregister.sh --name grafana
EOF
    exit 0
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
SERVICE_NAME=""

for arg in "$@"; do
    case "$arg" in
        --name=*) SERVICE_NAME="${arg#*=}" ;;
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

validate_service_name "$SERVICE_NAME"

# ---------------------------------------------------------------------------
# Deregister service
# ---------------------------------------------------------------------------
echo ""
log_info "Deregistering service: $SERVICE_NAME"

# Step 1: Remove DNS entry
log_info "Removing DNS entry..."
dns_remove_entry "$SERVICE_NAME"

# Step 2: Archive TLS certificate
log_info "Archiving TLS certificate..."
tls_revoke_cert "$SERVICE_NAME"

# Step 3: Remove routing rule
log_info "Removing routing rule..."
route_remove "$SERVICE_NAME"

# Step 4: Update service registry
log_info "Updating service registry..."
registry_remove_service "$SERVICE_NAME"

# Step 5: Regenerate Caddyfile and reload
log_info "Regenerating Caddyfile..."
route_generate_caddyfile
route_reload 2>/dev/null || log_warn "Caddy not running. Route removed from config."

# Step 6: Audit log
audit_log "service_deregister" "success" \
    "Deregistered service: ${SERVICE_NAME}" \
    "{\"name\":\"${SERVICE_NAME}\"}"

echo ""
log_success "Service '$SERVICE_NAME' deregistered."
echo ""
