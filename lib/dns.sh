#!/usr/bin/env bash
# lib/dns.sh
# DNS management via dnsmasq for QP Conduit.
# Sourced by conduit-* scripts. Never executed directly.
#
# Copyright 2026 Quantum Pipes Technologies, LLC
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

# ---------------------------------------------------------------------------
# _dns_hosts_file
# Returns the path to the Conduit hosts file used by dnsmasq.
# ---------------------------------------------------------------------------
_dns_hosts_file() {
    local dir
    dir="$(ensure_config_dir)"
    printf '%s/conduit-hosts' "$dir"
}

# ---------------------------------------------------------------------------
# dns_add_entry NAME IP
# Adds a DNS entry mapping NAME.CONDUIT_DOMAIN to IP.
# ---------------------------------------------------------------------------
dns_add_entry() {
    local name="${1:?name required}"
    local ip="${2:?ip required}"

    if ! validate_service_name "$name"; then
        return 1
    fi

    local fqdn="${name}.${CONDUIT_DOMAIN:-qp.local}"
    local hosts_file
    hosts_file="$(_dns_hosts_file)"

    # Create hosts file if it does not exist
    if [[ ! -f "$hosts_file" ]]; then
        touch "$hosts_file"
        chmod 600 "$hosts_file"
    fi

    # Remove existing entry for this name (if any)
    local tmp="${hosts_file}.tmp.$$"
    if [[ -f "$hosts_file" ]]; then
        grep -v "^[0-9.]* ${fqdn}$" "$hosts_file" > "$tmp" 2>/dev/null || true
    else
        touch "$tmp"
    fi

    # Append new entry
    printf '%s %s\n' "$ip" "$fqdn" >> "$tmp"
    mv "$tmp" "$hosts_file"
    log_info "DNS entry added: $fqdn -> $ip"
}

# ---------------------------------------------------------------------------
# dns_remove_entry NAME
# Removes the DNS entry for NAME.CONDUIT_DOMAIN.
# ---------------------------------------------------------------------------
dns_remove_entry() {
    local name="${1:?name required}"
    local fqdn="${name}.${CONDUIT_DOMAIN:-qp.local}"
    local hosts_file
    hosts_file="$(_dns_hosts_file)"

    if [[ ! -f "$hosts_file" ]]; then
        log_warn "No hosts file found, nothing to remove"
        return 0
    fi

    local tmp="${hosts_file}.tmp.$$"
    grep -v "^[0-9.]* ${fqdn}$" "$hosts_file" > "$tmp" 2>/dev/null || true
    mv "$tmp" "$hosts_file"
    log_info "DNS entry removed: $fqdn"
}

# ---------------------------------------------------------------------------
# dns_list_entries
# Lists all DNS entries managed by Conduit.
# ---------------------------------------------------------------------------
dns_list_entries() {
    local hosts_file
    hosts_file="$(_dns_hosts_file)"

    if [[ ! -f "$hosts_file" ]] || [[ ! -s "$hosts_file" ]]; then
        echo "(no entries)"
        return 0
    fi

    printf '%-40s %s\n' "HOSTNAME" "IP"
    printf '%-40s %s\n' "--------" "--"
    while IFS=' ' read -r ip hostname; do
        if [[ -n "$ip" && -n "$hostname" ]]; then
            printf '%-40s %s\n' "$hostname" "$ip"
        fi
    done < "$hosts_file"
}

# ---------------------------------------------------------------------------
# dns_flush
# Clears the dnsmasq cache by sending SIGHUP.
# ---------------------------------------------------------------------------
dns_flush() {
    if ! command -v dnsmasq &>/dev/null; then
        log_warn "dnsmasq not found, cannot flush DNS cache"
        return 1
    fi

    local pid
    pid="$(pgrep dnsmasq 2>/dev/null || true)"
    if [[ -z "$pid" ]]; then
        log_warn "dnsmasq is not running"
        return 1
    fi

    kill -HUP "$pid" 2>/dev/null
    log_success "DNS cache flushed"
}

# ---------------------------------------------------------------------------
# dns_reload
# Signals dnsmasq to reload its configuration.
# ---------------------------------------------------------------------------
dns_reload() {
    if ! command -v dnsmasq &>/dev/null; then
        log_warn "dnsmasq not found, cannot reload"
        return 1
    fi

    local pid
    pid="$(pgrep dnsmasq 2>/dev/null || true)"
    if [[ -z "$pid" ]]; then
        log_warn "dnsmasq is not running, cannot reload"
        return 1
    fi

    kill -HUP "$pid" 2>/dev/null
    log_success "dnsmasq reloaded"
}

# ---------------------------------------------------------------------------
# dns_generate_dnsmasq_conf
# Generates the dnsmasq configuration file for Conduit.
# ---------------------------------------------------------------------------
dns_generate_dnsmasq_conf() {
    local config_dir
    config_dir="$(ensure_config_dir)"
    local conf_file="${CONDUIT_DNSMASQ_CONF:-${config_dir}/dnsmasq.conf}"
    local hosts_file
    hosts_file="$(_dns_hosts_file)"

    cat > "$conf_file" <<DNSMASQ_CONF
# QP Conduit dnsmasq configuration
# Auto-generated. Do not edit manually.

# Listen on localhost only
listen-address=127.0.0.1
port=${CONDUIT_DNS_PORT:-53}

# Upstream DNS server
server=${CONDUIT_UPSTREAM_DNS:-1.1.1.1}

# Conduit-managed hosts
addn-hosts=${hosts_file}

# Logging
log-queries
log-facility=${config_dir}/dnsmasq.log

# Security: reject private addresses from upstream
bogus-priv
no-resolv
DNSMASQ_CONF

    chmod 600 "$conf_file"
    log_info "dnsmasq config generated at $conf_file"
}
