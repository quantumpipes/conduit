#!/usr/bin/env bash
# Bash completion for QP Conduit scripts.
# Source this file or copy it to /etc/bash_completion.d/conduit
#
# Copyright 2026 Quantum Pipes Technologies, LLC
# SPDX-License-Identifier: Apache-2.0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Resolve the Conduit config directory without sourcing any Conduit scripts.
_conduit_config_dir() {
    local dir="${CONDUIT_CONFIG_DIR:-}"
    if [[ -z "$dir" ]]; then
        local app="${CONDUIT_APP_NAME:-qp-conduit}"
        dir="$HOME/.config/${app}"
    fi
    printf '%s' "$dir"
}

# List service names from services.json (active only).
_conduit_service_names() {
    local config_dir
    config_dir="$(_conduit_config_dir)"
    local services_file="${config_dir}/services.json"
    if [[ -f "$services_file" ]] && command -v jq &>/dev/null; then
        jq -r '.[] | select(.status == "active") | .name' "$services_file" 2>/dev/null
    fi
}

# ---------------------------------------------------------------------------
# conduit-register.sh
# ---------------------------------------------------------------------------
_conduit_register() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"

    case "$prev" in
        --name|--host|--port)
            # Free-form values; no completion.
            COMPREPLY=()
            return ;;
        --health)
            COMPREPLY=( $(compgen -W "/healthz /health /api/health /api/tags /status" -- "$cur") )
            return ;;
        --protocol)
            COMPREPLY=( $(compgen -W "http https" -- "$cur") )
            return ;;
    esac

    if [[ "$cur" == --protocol=* ]]; then
        local prefix="--protocol="
        local protocols="http https"
        COMPREPLY=()
        local p
        for p in $protocols; do
            if [[ "${prefix}${p}" == "${cur}"* ]]; then
                COMPREPLY+=("${prefix}${p}")
            fi
        done
        return
    fi

    local opts="--name= --host= --port= --health= --protocol= --no-tls --help"
    COMPREPLY=( $(compgen -W "$opts" -- "$cur") )
    local i
    for i in "${!COMPREPLY[@]}"; do
        if [[ "${COMPREPLY[$i]}" == *= ]]; then
            compopt -o nospace 2>/dev/null
        fi
    done
}
complete -F _conduit_register conduit-register.sh

# ---------------------------------------------------------------------------
# conduit-deregister.sh
# ---------------------------------------------------------------------------
_conduit_deregister() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"

    if [[ "$prev" == "--name" ]] || [[ "$cur" == --name=* ]]; then
        local names
        names="$(_conduit_service_names)"
        if [[ "$cur" == --name=* ]]; then
            local prefix="--name="
            local partial="${cur#*=}"
            COMPREPLY=()
            local n
            for n in $names; do
                if [[ "$n" == "${partial}"* ]]; then
                    COMPREPLY+=("${prefix}${n}")
                fi
            done
            compopt -o nospace 2>/dev/null
        else
            COMPREPLY=( $(compgen -W "$names" -- "$cur") )
        fi
        return
    fi

    local opts="--name= --help"
    COMPREPLY=( $(compgen -W "$opts" -- "$cur") )
    local i
    for i in "${!COMPREPLY[@]}"; do
        if [[ "${COMPREPLY[$i]}" == *= ]]; then
            compopt -o nospace 2>/dev/null
        fi
    done
}
complete -F _conduit_deregister conduit-deregister.sh

# ---------------------------------------------------------------------------
# conduit-certs.sh
# ---------------------------------------------------------------------------
_conduit_certs() {
    local cur="${COMP_WORDS[COMP_CWORD]}"

    if [[ "$cur" == --rotate=* ]] || [[ "$cur" == --inspect=* ]]; then
        local prefix="${cur%%=*}="
        local partial="${cur#*=}"
        local names
        names="$(_conduit_service_names)"
        COMPREPLY=()
        local n
        for n in $names; do
            if [[ "$n" == "${partial}"* ]]; then
                COMPREPLY+=("${prefix}${n}")
            fi
        done
        compopt -o nospace 2>/dev/null
        return
    fi

    local opts="--rotate= --inspect= --trust --help"
    COMPREPLY=( $(compgen -W "$opts" -- "$cur") )
    local i
    for i in "${!COMPREPLY[@]}"; do
        if [[ "${COMPREPLY[$i]}" == *= ]]; then
            compopt -o nospace 2>/dev/null
        fi
    done
}
complete -F _conduit_certs conduit-certs.sh

# ---------------------------------------------------------------------------
# conduit-dns.sh
# ---------------------------------------------------------------------------
_conduit_dns() {
    local cur="${COMP_WORDS[COMP_CWORD]}"

    if [[ "$cur" == --resolve=* ]]; then
        local prefix="--resolve="
        local partial="${cur#*=}"
        local names
        names="$(_conduit_service_names)"
        COMPREPLY=()
        local n
        for n in $names; do
            if [[ "$n" == "${partial}"* ]]; then
                COMPREPLY+=("${prefix}${n}")
            fi
        done
        compopt -o nospace 2>/dev/null
        return
    fi

    local opts="--flush --resolve= --help"
    COMPREPLY=( $(compgen -W "$opts" -- "$cur") )
    local i
    for i in "${!COMPREPLY[@]}"; do
        if [[ "${COMPREPLY[$i]}" == *= ]]; then
            compopt -o nospace 2>/dev/null
        fi
    done
}
complete -F _conduit_dns conduit-dns.sh

# ---------------------------------------------------------------------------
# conduit-monitor.sh
# ---------------------------------------------------------------------------
_conduit_monitor() {
    local cur="${COMP_WORDS[COMP_CWORD]}"

    local opts="--server= --help"
    COMPREPLY=( $(compgen -W "$opts" -- "$cur") )
    local i
    for i in "${!COMPREPLY[@]}"; do
        if [[ "${COMPREPLY[$i]}" == *= ]]; then
            compopt -o nospace 2>/dev/null
        fi
    done
}
complete -F _conduit_monitor conduit-monitor.sh

# ---------------------------------------------------------------------------
# conduit-status.sh
# ---------------------------------------------------------------------------
_conduit_status() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    COMPREPLY=( $(compgen -W "--help" -- "$cur") )
}
complete -F _conduit_status conduit-status.sh

# ---------------------------------------------------------------------------
# conduit-setup.sh
# ---------------------------------------------------------------------------
_conduit_setup() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    COMPREPLY=( $(compgen -W "--help" -- "$cur") )
}
complete -F _conduit_setup conduit-setup.sh

# ---------------------------------------------------------------------------
# make (conduit targets)
# ---------------------------------------------------------------------------
_conduit_make_targets() {
    local targets=(
        conduit-setup
        conduit-register
        conduit-deregister
        conduit-status
        conduit-monitor
        conduit-monitor-containers
        conduit-certs
        conduit-certs-rotate
        conduit-certs-inspect
        conduit-certs-trust
        conduit-dns
        conduit-dns-flush
        conduit-dns-resolve
        conduit-verify
        dev
        go
        stop
        logs
        refresh
        ui
        ui-build
        ui-install
        ui-typecheck
        test
        test-unit
        test-integration
        test-smoke
        test-ui
        check
        help
    )
    local cur="${COMP_WORDS[COMP_CWORD]}"
    COMPREPLY=( $(compgen -W "${targets[*]}" -- "$cur") )
}

# Only register make completion if no other make completion is active.
# Users can call _conduit_make_targets manually or chain it.
if ! complete -p make &>/dev/null; then
    complete -F _conduit_make_targets make
fi
