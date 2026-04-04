#!/usr/bin/env bash
# conduit-status.sh
# Display registered services with health status, DNS, and TLS info.
# Usage: conduit-status.sh
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
for arg in "$@"; do
    case "$arg" in
        --help|-h)
            cat <<EOF
Usage: conduit-status.sh

Show all registered services with health status, DNS resolution,
TLS certificate expiry, and upstream connectivity.
EOF
            exit 0
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo "  QP Conduit Status"
echo "========================================"
echo ""
echo "Domain: ${CONDUIT_DOMAIN}"
echo "Config: ${CONDUIT_CONFIG_DIR}"
echo ""

# ---------------------------------------------------------------------------
# Service count
# ---------------------------------------------------------------------------
service_count="$(registry_service_count)"
echo "Active services: $service_count"
echo ""

if (( service_count == 0 )); then
    echo "No services registered. Use conduit-register.sh to add one."
    exit 0
fi

# ---------------------------------------------------------------------------
# Service table with health checks
# ---------------------------------------------------------------------------
printf '%-16s %-20s %-8s %-10s %-12s %s\n' "NAME" "UPSTREAM" "PORT" "HEALTH" "TLS EXPIRY" "DNS"
printf '%-16s %-20s %-8s %-10s %-12s %s\n' "----" "--------" "----" "------" "----------" "---"

registry_list_services | jq -c '.[]' | while IFS= read -r service; do
    name="$(echo "$service" | jq -r '.name')"
    host="$(echo "$service" | jq -r '.host')"
    port="$(echo "$service" | jq -r '.port')"
    health_path="$(echo "$service" | jq -r '.health_path')"
    protocol="$(echo "$service" | jq -r '.protocol')"

    # Health check: attempt HTTP GET to health endpoint
    health_status="unknown"
    if curl -sf --max-time 3 "${protocol}://${host}:${port}${health_path}" >/dev/null 2>&1; then
        health_status="healthy"
        registry_update_health "$name" "healthy" "$(ts_iso)" 2>/dev/null || true
    elif curl -sf --max-time 3 "http://${host}:${port}${health_path}" >/dev/null 2>&1; then
        health_status="healthy"
        registry_update_health "$name" "healthy" "$(ts_iso)" 2>/dev/null || true
    else
        health_status="down"
        registry_update_health "$name" "down" "$(ts_iso)" 2>/dev/null || true
    fi

    # TLS certificate expiry
    tls_expiry="n/a"
    certs_dir="${CONDUIT_CERTS_DIR:-$(ensure_config_dir)/certs}"
    cert_file="${certs_dir}/${name}/cert.pem"
    if [[ -f "$cert_file" ]]; then
        tls_expiry="$(openssl x509 -enddate -noout -in "$cert_file" 2>/dev/null | cut -d= -f2 | cut -c1-12 || echo "error")"
    fi

    # DNS resolution check
    fqdn="${name}.${CONDUIT_DOMAIN}"
    dns_check="fail"
    if host "$fqdn" 127.0.0.1 >/dev/null 2>&1; then
        dns_check="ok"
    elif getent hosts "$fqdn" >/dev/null 2>&1; then
        dns_check="ok"
    fi

    printf '%-16s %-20s %-8s %-10s %-12s %s\n' "$name" "$host" "$port" "$health_status" "$tls_expiry" "$dns_check"
done

echo ""

# ---------------------------------------------------------------------------
# Inactive services summary
# ---------------------------------------------------------------------------
inactive_count="$(registry_list_services --all | jq '[.[] | select(.status == "inactive")] | length')"
if (( inactive_count > 0 )); then
    echo "Inactive services: $inactive_count (deregistered)"
fi

# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------
audit_log "health_check" "success" \
    "Status check completed for $service_count services" \
    "{\"service_count\":$service_count}"
