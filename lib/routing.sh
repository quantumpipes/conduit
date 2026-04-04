#!/usr/bin/env bash
# lib/routing.sh
# Caddy reverse proxy route management for QP Conduit.
# Sourced by conduit-* scripts. Never executed directly.
#
# Copyright 2026 Quantum Pipes Technologies, LLC
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

# ---------------------------------------------------------------------------
# _routes_dir
# Returns the path to the per-service Caddyfile snippets directory.
# ---------------------------------------------------------------------------
_routes_dir() {
    local dir
    dir="$(ensure_config_dir)"
    local routes_dir="${dir}/routes"
    if [[ ! -d "$routes_dir" ]]; then
        mkdir -p "$routes_dir"
        chmod 700 "$routes_dir"
    fi
    printf '%s' "$routes_dir"
}

# ---------------------------------------------------------------------------
# route_add SERVICE_NAME UPSTREAM [TLS_CERT_PATH]
# Generates a Caddyfile block for the service and writes it to routes/.
# ---------------------------------------------------------------------------
route_add() {
    local name="${1:?service name required}"
    local upstream="${2:?upstream required}"
    local tls_cert_path="${3:-}"
    local domain="${name}.${CONDUIT_DOMAIN:-qp.local}"
    local routes_dir
    routes_dir="$(_routes_dir)"
    local route_file="${routes_dir}/${name}.caddy"

    if ! validate_service_name "$name"; then
        return 1
    fi

    local tls_block="tls internal"
    if [[ -n "$tls_cert_path" ]]; then
        local cert_dir
        cert_dir="$(dirname "$tls_cert_path")"
        tls_block="tls ${cert_dir}/cert.pem ${cert_dir}/key.pem"
    fi

    cat > "$route_file" <<CADDYBLOCK
${domain} {
    ${tls_block}

    reverse_proxy ${upstream} {
        header_up X-Forwarded-Proto {scheme}
        header_up X-Real-IP {remote_host}
        health_uri /healthz
        health_interval 30s
        health_timeout 5s
    }

    log {
        output file ${CONDUIT_CONFIG_DIR:-$HOME/.config/qp-conduit}/logs/${name}.access.log
        format json
    }
}
CADDYBLOCK

    chmod 600 "$route_file"
    log_info "Route added for $domain -> $upstream"
}

# ---------------------------------------------------------------------------
# route_remove SERVICE_NAME
# Removes the Caddyfile block for a service.
# ---------------------------------------------------------------------------
route_remove() {
    local name="${1:?service name required}"
    local routes_dir
    routes_dir="$(_routes_dir)"
    local route_file="${routes_dir}/${name}.caddy"

    if [[ ! -f "$route_file" ]]; then
        log_warn "No route found for service '$name'"
        return 0
    fi

    rm -f "$route_file"
    log_info "Route removed for service '$name'"
}

# ---------------------------------------------------------------------------
# route_list
# Lists all active routes.
# ---------------------------------------------------------------------------
route_list() {
    local routes_dir
    routes_dir="$(_routes_dir)"

    if [[ ! -d "$routes_dir" ]] || [[ -z "$(ls -A "$routes_dir" 2>/dev/null)" ]]; then
        echo "(no routes)"
        return 0
    fi

    printf '%-30s %s\n' "SERVICE" "ROUTE FILE"
    printf '%-30s %s\n' "-------" "----------"
    for route_file in "$routes_dir"/*.caddy; do
        if [[ -f "$route_file" ]]; then
            local svc_name
            svc_name="$(basename "$route_file" .caddy)"
            printf '%-30s %s\n' "$svc_name" "$route_file"
        fi
    done
}

# ---------------------------------------------------------------------------
# route_reload
# Reloads Caddy configuration via admin API.
# ---------------------------------------------------------------------------
route_reload() {
    local admin_port="${CONDUIT_ADMIN_PORT:-2019}"
    local config_dir
    config_dir="$(ensure_config_dir)"
    local caddyfile="${CONDUIT_CADDYFILE:-${config_dir}/Caddyfile}"

    if [[ ! -f "$caddyfile" ]]; then
        log_error "Caddyfile not found at $caddyfile"
        return 1
    fi

    # Validate config before reloading
    if ! caddy validate --config "$caddyfile" --adapter caddyfile 2>/dev/null; then
        log_error "Caddyfile validation failed. Not reloading."
        return 1
    fi

    # Reload via admin API
    if curl -sf "http://localhost:${admin_port}/load" \
        -H "Content-Type: text/caddyfile" \
        --data-binary @"$caddyfile" >/dev/null 2>&1; then
        log_success "Caddy configuration reloaded"
    else
        log_error "Failed to reload Caddy. Is it running?"
        return 1
    fi
}

# ---------------------------------------------------------------------------
# route_generate_caddyfile
# Assembles the main Caddyfile from global config and per-service routes.
# ---------------------------------------------------------------------------
route_generate_caddyfile() {
    local config_dir
    config_dir="$(ensure_config_dir)"
    local caddyfile="${CONDUIT_CADDYFILE:-${config_dir}/Caddyfile}"
    local routes_dir
    routes_dir="$(_routes_dir)"
    local logs_dir="${config_dir}/logs"

    mkdir -p "$logs_dir"

    # Write global config
    cat > "$caddyfile" <<CADDYFILE_GLOBAL
# QP Conduit Caddyfile
# Auto-generated. Do not edit manually.
{
    admin localhost:${CONDUIT_ADMIN_PORT:-2019}
    local_certs
    auto_https disable_redirects
}

CADDYFILE_GLOBAL

    # Append per-service routes
    if [[ -d "$routes_dir" ]]; then
        for route_file in "$routes_dir"/*.caddy; do
            if [[ -f "$route_file" ]]; then
                cat "$route_file" >> "$caddyfile"
                printf '\n' >> "$caddyfile"
            fi
        done
    fi

    chmod 600 "$caddyfile"
    log_info "Caddyfile generated at $caddyfile"
}
