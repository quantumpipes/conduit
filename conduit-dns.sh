#!/usr/bin/env bash
# conduit-dns.sh
# Manage DNS entries for QP Conduit services.
#
# Usage:
#   conduit-dns.sh                      List all DNS entries
#   conduit-dns.sh --flush              Clear DNS cache
#   conduit-dns.sh --resolve hub        Test resolution for a service
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
Usage: conduit-dns.sh [OPTIONS]

Manage DNS entries for registered services.

Options:
  --flush               Clear dnsmasq DNS cache
  --resolve NAME        Test DNS resolution for a service
  -h, --help            Show this help

With no options, lists all DNS entries.
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
        --flush) ACTION="flush" ;;
        --resolve=*) ACTION="resolve"; TARGET_NAME="${arg#*=}" ;;
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
        echo "=== DNS Entries ==="
        echo ""
        dns_list_entries
        echo ""
        ;;

    flush)
        echo ""
        log_info "Flushing DNS cache..."
        dns_flush

        audit_log "dns_flush" "success" "DNS cache flushed"

        echo ""
        ;;

    resolve)
        if [[ -z "$TARGET_NAME" ]]; then
            log_error "Service name required for --resolve"
            exit 1
        fi
        validate_service_name "$TARGET_NAME"

        fqdn="${TARGET_NAME}.${CONDUIT_DOMAIN}"
        echo ""
        echo "Resolving: $fqdn"
        echo ""

        # Try host command first, then getent, then dig
        if command -v host &>/dev/null; then
            host "$fqdn" 127.0.0.1 2>&1 || echo "(resolution failed via host)"
        elif command -v getent &>/dev/null; then
            getent hosts "$fqdn" 2>&1 || echo "(resolution failed via getent)"
        elif command -v dig &>/dev/null; then
            dig +short "$fqdn" @127.0.0.1 2>&1 || echo "(resolution failed via dig)"
        else
            log_error "No DNS resolution tool found (host, getent, dig)"
            exit 1
        fi
        echo ""
        ;;
esac
