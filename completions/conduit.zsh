#compdef conduit-register.sh conduit-deregister.sh conduit-certs.sh conduit-dns.sh conduit-monitor.sh conduit-status.sh conduit-setup.sh
# Zsh completion for QP Conduit scripts.
# Copy this file to a directory in your $fpath (e.g., ~/.zsh/completions/_conduit)
# and run: autoload -Uz compinit && compinit
#
# Copyright 2026 Quantum Pipes Technologies, LLC
# SPDX-License-Identifier: Apache-2.0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_conduit_config_dir() {
    local dir="${CONDUIT_CONFIG_DIR:-}"
    if [[ -z "$dir" ]]; then
        local app="${CONDUIT_APP_NAME:-qp-conduit}"
        dir="$HOME/.config/${app}"
    fi
    echo "$dir"
}

# Return active service names from services.json.
_conduit_service_names() {
    local config_dir="$(_conduit_config_dir)"
    local services_file="${config_dir}/services.json"
    if [[ -f "$services_file" ]] && (( $+commands[jq] )); then
        jq -r '.[] | select(.status == "active") | .name' "$services_file" 2>/dev/null
    fi
}

# ---------------------------------------------------------------------------
# conduit-register.sh
# ---------------------------------------------------------------------------
_conduit-register.sh() {
    _arguments -s \
        '--name=[Service name]:name:' \
        '--host=[Upstream host IP or hostname]:host:_hosts' \
        '--port=[Upstream port number]:port:' \
        '--health=[Health check endpoint]:path:(/healthz /health /api/health /api/tags /status)' \
        '--protocol=[Protocol]:protocol:(http https)' \
        '--no-tls[Skip TLS certificate issuance]' \
        '(-h --help)'{-h,--help}'[Show help]'
}

# ---------------------------------------------------------------------------
# conduit-deregister.sh
# ---------------------------------------------------------------------------
_conduit-deregister.sh() {
    local services
    services=("${(@f)$(_conduit_service_names)}")
    _arguments -s \
        "--name=[Service name to deregister]:name:(${services[*]})" \
        '(-h --help)'{-h,--help}'[Show help]'
}

# ---------------------------------------------------------------------------
# conduit-certs.sh
# ---------------------------------------------------------------------------
_conduit-certs.sh() {
    local services
    services=("${(@f)$(_conduit_service_names)}")
    _arguments -s \
        "--rotate=[Revoke and reissue certificate]:name:(${services[*]})" \
        "--inspect=[Show certificate details]:name:(${services[*]})" \
        '--trust[Install internal CA in system trust store]' \
        '(-h --help)'{-h,--help}'[Show help]'
}

# ---------------------------------------------------------------------------
# conduit-dns.sh
# ---------------------------------------------------------------------------
_conduit-dns.sh() {
    local services
    services=("${(@f)$(_conduit_service_names)}")
    _arguments -s \
        '--flush[Clear dnsmasq DNS cache]' \
        "--resolve=[Test DNS resolution for a service]:name:(${services[*]})" \
        '(-h --help)'{-h,--help}'[Show help]'
}

# ---------------------------------------------------------------------------
# conduit-monitor.sh
# ---------------------------------------------------------------------------
_conduit-monitor.sh() {
    _arguments -s \
        '--server=[Monitor remote server via SSH]:ssh_host:_hosts' \
        '(-h --help)'{-h,--help}'[Show help]'
}

# ---------------------------------------------------------------------------
# conduit-status.sh
# ---------------------------------------------------------------------------
_conduit-status.sh() {
    _arguments -s \
        '(-h --help)'{-h,--help}'[Show help]'
}

# ---------------------------------------------------------------------------
# conduit-setup.sh
# ---------------------------------------------------------------------------
_conduit-setup.sh() {
    _arguments -s \
        '(-h --help)'{-h,--help}'[Show help]'
}

# ---------------------------------------------------------------------------
# make (conduit targets)
# ---------------------------------------------------------------------------
# This function can be chained into an existing make completion.
# Usage: add _conduit_make_targets to your make completion or call it directly.
_conduit_make_targets() {
    local targets=(
        'conduit-setup:Initialize Conduit (dnsmasq, Caddy, internal CA)'
        'conduit-register:Register a service (NAME=hub HOST=127.0.0.1:8090)'
        'conduit-deregister:Remove a service (NAME=grafana)'
        'conduit-status:Show all services with health, TLS, and DNS status'
        'conduit-monitor:Show hardware stats (GPU, CPU, memory, disk)'
        'conduit-monitor-containers:Show Docker container health'
        'conduit-certs:List all TLS certificates with expiry dates'
        'conduit-certs-rotate:Rotate a certificate (NAME=grafana)'
        'conduit-certs-inspect:Inspect a certificate (NAME=grafana)'
        'conduit-certs-trust:Install internal CA in system trust store'
        'conduit-dns:List all DNS entries'
        'conduit-dns-flush:Flush DNS cache'
        'conduit-dns-resolve:Test DNS resolution (DOMAIN=hub.qp.local)'
        'conduit-verify:Verify Capsule audit chain integrity'
        'dev:Start Conduit dashboard in Docker (http://localhost:9999)'
        'go:Start Conduit in Docker (background)'
        'stop:Stop Conduit containers'
        'logs:Tail Conduit container logs'
        'refresh:Rebuild and restart the app container'
        'ui:Start admin dashboard natively (dev mode, port 5173)'
        'ui-build:Build admin dashboard for production'
        'ui-install:Install admin dashboard dependencies'
        'ui-typecheck:Type-check admin dashboard'
        'test:Run all tests (requires bats-core)'
        'test-unit:Run unit tests only'
        'test-integration:Run integration tests only'
        'test-smoke:Run smoke tests'
        'test-ui:Run admin dashboard tests'
        'check:Run all tests + type-check UI'
        'help:Show help'
    )
    _describe 'make target' targets
}
