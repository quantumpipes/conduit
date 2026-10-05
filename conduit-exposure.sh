#!/usr/bin/env bash
# conduit-exposure.sh
# Fails when a running container publishes a port on every interface.
#
# Docker's "8080:8080" binds 0.0.0.0, so the service is reachable by anyone on
# the same network. A reverse proxy that forwards to host.docker.internal is
# the sharper case: on Docker Desktop that name reaches services bound to the
# host's loopback, so a proxy published on 0.0.0.0 re-exposes every 127.0.0.1
# service it routes. Publish as "127.0.0.1:8080:8080" instead.
#
# Usage:
#   conduit-exposure.sh            # exit 1 if any container is LAN-reachable
#   conduit-exposure.sh --json     # machine-readable list
#
# Copyright 2026 Quantum Pipes Technologies, LLC
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

CONDUIT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$CONDUIT_SCRIPT_DIR/lib/common.sh"

JSON=false
for arg in "$@"; do
    case "$arg" in
        --json) JSON=true ;;
        -h|--help) sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) log_error "Unknown argument: $arg"; exit 2 ;;
    esac
done

require_cmd docker

# One line per exposed binding: "<container>\t<binding>"
# A binding is exposed when its host address is unspecified (0.0.0.0, [::], ::).
exposed_bindings() {
    docker ps --format '{{.Names}}{{"\t"}}{{.Ports}}' | while IFS=$'\t' read -r name ports; do
        [[ -z "$ports" ]] && continue
        local IFS=','
        for binding in $ports; do
            binding="${binding# }"
            case "$binding" in
                0.0.0.0:*|"[::]:"*|":::"*) printf '%s\t%s\n' "$name" "$binding" ;;
            esac
        done
    done
}

if ! found="$(exposed_bindings)"; then
    log_error "Could not read container ports (is Docker running?)"
    exit 2
fi

if [[ "$JSON" == "true" ]]; then
    printf '%s\n' "$found" | jq -Rn '[inputs | select(length > 0) | split("\t") | {container: .[0], binding: .[1]}]'
    [[ -z "$found" ]] && exit 0 || exit 1
fi

if [[ -z "$found" ]]; then
    log_success "No container publishes a port beyond localhost."
    exit 0
fi

log_error "Containers reachable from the network:"
printf '%s\n' "$found" | awk -F'\t' '{printf "  %-32s %s\n", $1, $2}' >&2
log_error "Bind them to loopback in compose: \"127.0.0.1:HOST:CONTAINER\", then recreate."
exit 1
