#!/usr/bin/env bash
# lib/common.sh
# Common utilities for QP Conduit automation scripts.
# Sourced by all conduit-* scripts. Never executed directly.
#
# Copyright 2026 Quantum Pipes Technologies, LLC
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

# ---------------------------------------------------------------------------
# Colors (disabled when stdout is not a terminal)
# ---------------------------------------------------------------------------
if [[ -t 1 ]]; then
    _C_RED='\033[0;31m'
    _C_GREEN='\033[0;32m'
    _C_YELLOW='\033[0;33m'
    _C_CYAN='\033[0;36m'
    _C_NC='\033[0m'
else
    _C_RED=''
    _C_GREEN=''
    _C_YELLOW=''
    _C_CYAN=''
    _C_NC=''
fi

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

log_info() {
    printf '%b[INFO]%b %s\n' "$_C_CYAN" "$_C_NC" "$*" >&2
}

log_warn() {
    printf '%b[WARN]%b %s\n' "$_C_YELLOW" "$_C_NC" "$*" >&2
}

log_error() {
    printf '%b[ERROR]%b %s\n' "$_C_RED" "$_C_NC" "$*" >&2
}

log_success() {
    printf '%b[OK]%b %s\n' "$_C_GREEN" "$_C_NC" "$*" >&2
}

# ---------------------------------------------------------------------------
# require_cmd CMD [CMD ...]
# Exits with error if any command is not found on PATH.
# ---------------------------------------------------------------------------
require_cmd() {
    local cmd
    for cmd in "$@"; do
        if ! command -v "$cmd" &>/dev/null; then
            log_error "Required command not found: $cmd"
            return 1
        fi
    done
}

# ---------------------------------------------------------------------------
# require_env VAR [VAR ...]
# Exits with error if any environment variable is unset or empty.
# ---------------------------------------------------------------------------
require_env() {
    local var
    for var in "$@"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable not set: $var"
            return 1
        fi
    done
}

# ---------------------------------------------------------------------------
# validate_service_name NAME
# Returns 0 if NAME matches ^[a-zA-Z0-9_-]+$, 1 otherwise.
# ---------------------------------------------------------------------------
validate_service_name() {
    local name="${1:-}"
    if [[ -z "$name" ]]; then
        log_error "Service name must not be empty"
        return 1
    fi
    if [[ ! "$name" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        log_error "Invalid service name '$name': only alphanumeric, hyphen, underscore allowed"
        return 1
    fi
    return 0
}

# ---------------------------------------------------------------------------
# set_safe_umask
# Sets umask 077 so generated configs/certs are owner-only.
# ---------------------------------------------------------------------------
set_safe_umask() {
    umask 077
}

# ---------------------------------------------------------------------------
# mask_token VALUE
# Replaces all but the last 4 characters with asterisks.
# Used to safely log sensitive values like API tokens.
# ---------------------------------------------------------------------------
mask_token() {
    local val="${1:-}"
    local len=${#val}
    if (( len <= 4 )); then
        printf '%s' '****'
    else
        local masked_len=$(( len - 4 ))
        printf '%*s' "$masked_len" '' | tr ' ' '*'
        printf '%s' "${val: -4}"
    fi
}

# ---------------------------------------------------------------------------
# ensure_config_dir
# Creates CONDUIT_CONFIG_DIR with safe permissions if it does not exist.
# ---------------------------------------------------------------------------
ensure_config_dir() {
    local dir="${CONDUIT_CONFIG_DIR:-$HOME/.config/qp-conduit}"
    if [[ ! -d "$dir" ]]; then
        mkdir -p "$dir"
        chmod 700 "$dir"
    fi
    printf '%s' "$dir"
}

# ---------------------------------------------------------------------------
# load_env
# Sources .env.conduit from the project root if it exists.
# ---------------------------------------------------------------------------
load_env() {
    local env_file="${CONDUIT_ENV_FILE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env.conduit}"
    if [[ -f "$env_file" ]]; then
        # shellcheck disable=SC1090
        source "$env_file"
    fi
}

# ---------------------------------------------------------------------------
# Default config values (can be overridden by .env.conduit or environment)
# ---------------------------------------------------------------------------
apply_defaults() {
    export CONDUIT_APP_NAME="${CONDUIT_APP_NAME:-qp-conduit}"
    export CONDUIT_DOMAIN="${CONDUIT_DOMAIN:-qp.local}"
    export CONDUIT_CONFIG_DIR="${CONDUIT_CONFIG_DIR:-$HOME/.config/${CONDUIT_APP_NAME}}"
    export CONDUIT_DNS_PORT="${CONDUIT_DNS_PORT:-53}"
    export CONDUIT_PROXY_PORT="${CONDUIT_PROXY_PORT:-443}"
    export CONDUIT_ADMIN_PORT="${CONDUIT_ADMIN_PORT:-2019}"
    export CONDUIT_UPSTREAM_DNS="${CONDUIT_UPSTREAM_DNS:-1.1.1.1}"
    export CONDUIT_CADDY_DATA="${CONDUIT_CADDY_DATA:-${CONDUIT_CONFIG_DIR}/caddy-data}"
    export CONDUIT_CADDY_CONFIG="${CONDUIT_CADDY_CONFIG:-${CONDUIT_CONFIG_DIR}/caddy-config}"
    export CONDUIT_CADDYFILE="${CONDUIT_CADDYFILE:-${CONDUIT_CONFIG_DIR}/Caddyfile}"
    export CONDUIT_DNSMASQ_CONF="${CONDUIT_DNSMASQ_CONF:-${CONDUIT_CONFIG_DIR}/dnsmasq.conf}"
    export CONDUIT_CERTS_DIR="${CONDUIT_CERTS_DIR:-${CONDUIT_CONFIG_DIR}/certs}"
}

# ---------------------------------------------------------------------------
# ts_iso
# Prints the current UTC timestamp in ISO 8601 format.
# ---------------------------------------------------------------------------
ts_iso() {
    date -u '+%Y-%m-%dT%H:%M:%SZ'
}
