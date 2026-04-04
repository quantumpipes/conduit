#!/usr/bin/env bash
# lib/registry.sh
# Service registry CRUD backed by services.json (jq-based, no database).
# Sourced by conduit-* scripts. Never executed directly.
#
# Copyright 2026 Quantum Pipes Technologies, LLC
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

# ---------------------------------------------------------------------------
# registry_path
# Returns the path to services.json (creates config dir if needed).
# ---------------------------------------------------------------------------
registry_path() {
    local dir
    dir="$(ensure_config_dir)"
    printf '%s/services.json' "$dir"
}

# ---------------------------------------------------------------------------
# registry_init
# Creates services.json with empty structure if it does not exist.
# Idempotent: does nothing if the file already exists and is valid JSON.
# ---------------------------------------------------------------------------
registry_init() {
    local path
    path="$(registry_path)"
    if [[ -f "$path" ]]; then
        if jq empty "$path" 2>/dev/null; then
            return 0
        fi
        log_warn "Corrupt services.json detected, backing up and reinitializing"
        mv "$path" "${path}.bak.$(date +%s)"
    fi
    set_safe_umask
    cat > "$path" <<'REGISTRY_JSON'
{
  "version": 1,
  "services": []
}
REGISTRY_JSON
    chmod 600 "$path"
    log_info "Initialized service registry at $path"
}

# ---------------------------------------------------------------------------
# _validate_ip IP
# Returns 0 if IP is a valid IPv4 address, 1 otherwise.
# ---------------------------------------------------------------------------
_validate_ip() {
    local ip="${1:-}"
    if [[ ! "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        return 1
    fi
    local IFS='.'
    # shellcheck disable=SC2086
    set -- $ip
    (( $1 <= 255 && $2 <= 255 && $3 <= 255 && $4 <= 255 ))
}

# ---------------------------------------------------------------------------
# _validate_port PORT
# Returns 0 if PORT is a valid port number (1-65535), 1 otherwise.
# ---------------------------------------------------------------------------
_validate_port() {
    local port="${1:-}"
    if [[ ! "$port" =~ ^[0-9]+$ ]]; then
        return 1
    fi
    (( port >= 1 && port <= 65535 ))
}

# ---------------------------------------------------------------------------
# registry_add_service NAME HOST PORT PROTOCOL HEALTH_PATH
# Adds a service entry. Fails if a service with the same name already exists.
# ---------------------------------------------------------------------------
registry_add_service() {
    local name="${1:?name required}"
    local host="${2:?host required}"
    local port="${3:?port required}"
    local protocol="${4:-https}"
    local health_path="${5:-/healthz}"
    local path
    path="$(registry_path)"

    if ! validate_service_name "$name"; then
        return 1
    fi

    if ! _validate_port "$port"; then
        log_error "Invalid port: $port"
        return 1
    fi

    # Check for duplicate name (active services only)
    local existing
    existing="$(jq -r --arg n "$name" '.services[] | select(.name == $n and .status == "active") | .name' "$path")"
    if [[ -n "$existing" ]]; then
        log_error "Service '$name' already exists and is active"
        return 1
    fi

    local now
    now="$(ts_iso)"
    local tmp="${path}.tmp.$$"
    jq --arg n "$name" --arg h "$host" --arg p "$port" \
       --arg proto "$protocol" --arg hp "$health_path" --arg ts "$now" \
       '.services += [{
         "name": $n,
         "host": $h,
         "port": ($p | tonumber),
         "protocol": $proto,
         "health_path": $hp,
         "status": "active",
         "health_status": "unknown",
         "last_health_check": null,
         "registered_at": $ts,
         "deregistered_at": null
       }]' \
       "$path" > "$tmp"
    mv "$tmp" "$path"
    log_info "Service added: $name ($host:$port)"
}

# ---------------------------------------------------------------------------
# registry_remove_service NAME
# Marks a service as deregistered (sets status=inactive, deregistered_at=now).
# Does NOT delete the entry; that would lose audit history.
# ---------------------------------------------------------------------------
registry_remove_service() {
    local name="${1:?name required}"
    local path
    path="$(registry_path)"

    if ! validate_service_name "$name"; then
        return 1
    fi

    local existing
    existing="$(jq -r --arg n "$name" '.services[] | select(.name == $n and .status == "active") | .name' "$path")"
    if [[ -z "$existing" ]]; then
        log_error "No active service named '$name' found"
        return 1
    fi

    local now
    now="$(ts_iso)"
    local tmp="${path}.tmp.$$"
    jq --arg n "$name" --arg ts "$now" \
       '(.services[] | select(.name == $n and .status == "active")) |= (.status = "inactive" | .deregistered_at = $ts)' \
       "$path" > "$tmp"
    mv "$tmp" "$path"
    log_info "Service deregistered: $name"
}

# ---------------------------------------------------------------------------
# registry_get_service NAME
# Outputs the JSON object for an active service, or returns 1 if not found.
# ---------------------------------------------------------------------------
registry_get_service() {
    local name="${1:?name required}"
    local path
    path="$(registry_path)"
    local result
    result="$(jq -r --arg n "$name" '.services[] | select(.name == $n and .status == "active")' "$path")"
    if [[ -z "$result" ]]; then
        return 1
    fi
    printf '%s\n' "$result"
}

# ---------------------------------------------------------------------------
# registry_list_services [--all]
# Lists active services (or all services with --all). Outputs JSON array.
# ---------------------------------------------------------------------------
registry_list_services() {
    local path
    path="$(registry_path)"
    if [[ "${1:-}" == "--all" ]]; then
        jq '.services' "$path"
    else
        jq '[.services[] | select(.status == "active")]' "$path"
    fi
}

# ---------------------------------------------------------------------------
# registry_update_health NAME STATUS LAST_CHECK
# Updates the health status and last check timestamp for a service.
# ---------------------------------------------------------------------------
registry_update_health() {
    local name="${1:?name required}"
    local health_status="${2:?status required}"
    local last_check="${3:?last_check required}"
    local path
    path="$(registry_path)"

    local tmp="${path}.tmp.$$"
    jq --arg n "$name" --arg hs "$health_status" --arg lc "$last_check" \
       '(.services[] | select(.name == $n and .status == "active")) |= (.health_status = $hs | .last_health_check = $lc)' \
       "$path" > "$tmp"
    mv "$tmp" "$path"
}

# ---------------------------------------------------------------------------
# registry_service_count
# Returns the number of active services.
# ---------------------------------------------------------------------------
registry_service_count() {
    local path
    path="$(registry_path)"
    jq '[.services[] | select(.status == "active")] | length' "$path"
}
