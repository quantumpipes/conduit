#!/usr/bin/env bash
# lib/audit.sh
# Structured JSON audit log writer for Conduit operations.
# Appends one JSON object per line to the audit log.
# Sourced by conduit-* scripts. Never executed directly.
#
# Copyright 2026 Quantum Pipes Technologies, LLC
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

# ---------------------------------------------------------------------------
# audit_log ACTION STATUS [MESSAGE] [DETAILS_JSON]
#
# Writes a structured JSON line to the audit log.
#   ACTION:       e.g. "setup", "service_register", "cert_rotate", "dns_flush"
#   STATUS:       "success" or "failure"
#   MESSAGE:      human-readable description (optional)
#   DETAILS_JSON: additional JSON object to merge (optional)
#
# Output format (one line per entry, no pretty-printing):
# {"timestamp":"...","action":"...","status":"...","message":"...","user":"...","details":{...}}
# ---------------------------------------------------------------------------
audit_log() {
    local action="${1:?action required}"
    local status="${2:?status required}"
    local message="${3:-}"
    local empty_obj='{}'
    local details="${4:-$empty_obj}"

    local config_dir
    config_dir="$(ensure_config_dir)"
    local log_file="${config_dir}/audit.log"

    local timestamp
    timestamp="$(ts_iso)"
    local user
    user="$(whoami 2>/dev/null || echo 'unknown')"

    # Validate details is valid JSON, fallback to empty object
    if ! echo "$details" | jq empty 2>/dev/null; then
        details='{}'
    fi

    local entry
    entry="$(jq -cn \
        --arg ts "$timestamp" \
        --arg act "$action" \
        --arg st "$status" \
        --arg msg "$message" \
        --arg usr "$user" \
        --argjson det "$details" \
        '{"timestamp":$ts,"action":$act,"status":$st,"message":$msg,"user":$usr,"details":$det}'
    )"

    # Append atomically (single write)
    printf '%s\n' "$entry" >> "$log_file"

    # Seal as tamper-evident Capsule
    _capsule_seal "$entry"
}

# ---------------------------------------------------------------------------
# audit_read [N]
# Reads the last N entries from the audit log (default: 10).
# ---------------------------------------------------------------------------
audit_read() {
    local count="${1:-10}"
    local config_dir
    config_dir="$(ensure_config_dir)"
    local log_file="${config_dir}/audit.log"

    if [[ ! -f "$log_file" ]]; then
        echo '[]'
        return 0
    fi

    tail -n "$count" "$log_file" | jq -s '.'
}

# ---------------------------------------------------------------------------
# audit_trap_handler
# Intended to be used as: trap 'audit_trap_handler "script_name"' ERR
# Logs a failure entry when an ERR trap fires.
# ---------------------------------------------------------------------------
audit_trap_handler() {
    local script_name="${1:-unknown}"
    local line="${BASH_LINENO[0]:-unknown}"
    audit_log "${script_name}_error" "failure" \
        "ERR trap fired at line $line" \
        "{\"line\":\"$line\",\"script\":\"$script_name\"}"
}

# ---------------------------------------------------------------------------
# _ensure_capsule
# Checks if qp-capsule CLI is available. Auto-installs via pip if needed.
# Returns 0 if available, 1 otherwise.
# ---------------------------------------------------------------------------
_ensure_capsule() {
    if command -v qp-capsule &>/dev/null; then
        return 0
    fi

    # Do not auto-install from PyPI (supply chain risk, air-gap violation).
    # Pre-install qp-capsule in the Docker image or on the host.
    log_warn "qp-capsule not found. Install with: pip install qp-capsule"
    return 1
}

# ---------------------------------------------------------------------------
# _capsule_seal ENTRY_JSON
# Seals an audit entry as a tamper-evident Capsule (if qp-capsule is available).
# Silently skips if qp-capsule is not installed.
# ---------------------------------------------------------------------------
_capsule_seal() {
    local entry="${1:-}"
    if [[ -z "$entry" ]]; then
        return 0
    fi

    if ! command -v qp-capsule &>/dev/null; then
        return 0
    fi

    local config_dir
    config_dir="$(ensure_config_dir)"
    local db_file="${config_dir}/capsules.db"

    echo "$entry" | qp-capsule seal --db "$db_file" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# audit_verify
# Verifies the integrity of the Capsule audit chain.
# Returns 0 if all Capsules are valid, 1 if tampered or unavailable.
# ---------------------------------------------------------------------------
audit_verify() {
    if ! command -v qp-capsule &>/dev/null; then
        log_error "qp-capsule CLI not installed. Cannot verify audit chain."
        log_info "Install with: pip install qp-capsule"
        return 1
    fi

    local config_dir
    config_dir="$(ensure_config_dir)"
    local db_file="${config_dir}/capsules.db"

    if [[ ! -f "$db_file" ]]; then
        log_warn "No capsules database found at $db_file"
        return 1
    fi

    qp-capsule verify --db "$db_file"
}
