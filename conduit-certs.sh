#!/usr/bin/env bash
# conduit-certs.sh
# Manage TLS certificates for QP Conduit services.
#
# Usage:
#   conduit-certs.sh                    List all certificates
#   conduit-certs.sh --rotate hub       Reissue certificate for hub
#   conduit-certs.sh --inspect hub      Show certificate details
#   conduit-certs.sh --trust            Install CA in system trust store
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
Usage: conduit-certs.sh [OPTIONS]

Manage TLS certificates for registered services.

Options:
  --rotate NAME         Revoke and reissue certificate for a service
  --inspect NAME        Show detailed certificate information
  --trust               Install the internal CA in the system trust store
  -h, --help            Show this help

With no options, lists all certificates and their expiry dates.
EOF
    exit 0
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
ACTION="list"
TARGET_NAME=""

for arg in "$@"; do
    case "$arg" in
        --rotate=*) ACTION="rotate"; TARGET_NAME="${arg#*=}" ;;
        --inspect=*) ACTION="inspect"; TARGET_NAME="${arg#*=}" ;;
        --trust) ACTION="trust" ;;
        --help|-h) usage ;;
        *)
            log_error "Unknown option: $arg"
            usage
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------
case "$ACTION" in
    list)
        echo ""
        echo "=== TLS Certificates ==="
        echo ""
        tls_list_certs
        echo ""
        ;;

    rotate)
        if [[ -z "$TARGET_NAME" ]]; then
            log_error "Service name required for --rotate"
            exit 1
        fi
        validate_service_name "$TARGET_NAME"

        echo ""
        log_info "Rotating certificate for: $TARGET_NAME"

        # Revoke old cert
        tls_revoke_cert "$TARGET_NAME"

        # Issue new cert
        tls_issue_cert "$TARGET_NAME"

        # Regenerate routes and reload
        route_generate_caddyfile
        route_reload 2>/dev/null || log_warn "Caddy not running. Restart to use new certificate."

        audit_log "cert_rotate" "success" \
            "Certificate rotated for service: ${TARGET_NAME}" \
            "{\"name\":\"${TARGET_NAME}\"}"

        log_success "Certificate rotated for '$TARGET_NAME'"
        echo ""
        ;;

    inspect)
        if [[ -z "$TARGET_NAME" ]]; then
            log_error "Service name required for --inspect"
            exit 1
        fi
        validate_service_name "$TARGET_NAME"

        certs_dir="${CONDUIT_CERTS_DIR:-$(ensure_config_dir)/certs}"
        cert_file="${certs_dir}/${TARGET_NAME}/cert.pem"

        if [[ ! -f "$cert_file" ]]; then
            log_error "No certificate found for service '$TARGET_NAME'"
            exit 1
        fi

        echo ""
        echo "=== Certificate: $TARGET_NAME ==="
        echo ""
        openssl x509 -in "$cert_file" -text -noout
        echo ""
        ;;

    trust)
        echo ""
        log_info "Installing internal CA into system trust store..."
        tls_trust_ca
        echo ""
        ;;
esac
