#!/usr/bin/env bats
# tests/integration/test_service_lifecycle.bats
# Integration tests for the full service register/deregister lifecycle.
# Operates at the registry + DNS + routing level (no Caddy/dnsmasq required).

LIB_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../lib" && pwd)"

setup() {
    export HOME="$BATS_TMPDIR"
    export CONDUIT_CONFIG_DIR="$BATS_TMPDIR/test-lifecycle-$$-$BATS_TEST_NUMBER"
    export CONDUIT_DOMAIN="qp.local"
    export CONDUIT_ADMIN_PORT="2019"
    source "$LIB_DIR/common.sh"
    source "$LIB_DIR/registry.sh"
    source "$LIB_DIR/audit.sh"
    source "$LIB_DIR/dns.sh"
    source "$LIB_DIR/routing.sh"

    # Stub _capsule_seal
    _capsule_seal() { return 0; }
    export -f _capsule_seal

    apply_defaults
    ensure_config_dir >/dev/null
    registry_init
}

teardown() {
    rm -rf "${CONDUIT_CONFIG_DIR:-}" 2>/dev/null || true
}

# ===========================================================================
# Full register lifecycle
# ===========================================================================

@test "register creates registry entry" {
    registry_add_service "hub" "127.0.0.1" "8090"
    run registry_get_service "hub"
    [ "$status" -eq 0 ]
    [[ "$output" == *"active"* ]]
}

@test "register creates DNS entry" {
    dns_add_entry "hub" "127.0.0.1"
    local hosts_file="$CONDUIT_CONFIG_DIR/conduit-hosts"
    run grep "hub.qp.local" "$hosts_file"
    [ "$status" -eq 0 ]
}

@test "register creates routing entry" {
    route_add "hub" "127.0.0.1:8090"
    [ -f "$CONDUIT_CONFIG_DIR/routes/hub.caddy" ]
}

@test "register creates all three resources" {
    registry_add_service "hub" "127.0.0.1" "8090"
    dns_add_entry "hub" "127.0.0.1"
    route_add "hub" "127.0.0.1:8090"
    audit_log "service_register" "success" "Registered hub"

    # Registry
    run registry_get_service "hub"
    [ "$status" -eq 0 ]

    # DNS
    local hosts_file="$CONDUIT_CONFIG_DIR/conduit-hosts"
    run grep "hub.qp.local" "$hosts_file"
    [ "$status" -eq 0 ]

    # Route
    [ -f "$CONDUIT_CONFIG_DIR/routes/hub.caddy" ]
}

# ===========================================================================
# Status shows registered service
# ===========================================================================

@test "status shows registered service count" {
    registry_add_service "hub" "127.0.0.1" "8090"
    run registry_service_count
    [ "$output" = "1" ]
}

@test "status reflects correct service data" {
    registry_add_service "hub" "127.0.0.1" "8090" "https" "/healthz"
    run registry_get_service "hub"
    local host
    host="$(echo "$output" | jq -r '.host')"
    [ "$host" = "127.0.0.1" ]
    local port
    port="$(echo "$output" | jq -r '.port')"
    [ "$port" = "8090" ]
}

# ===========================================================================
# Deregister removes all entries
# ===========================================================================

@test "deregister marks service inactive" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_remove_service "hub"
    run registry_get_service "hub"
    [ "$status" -eq 1 ]
}

@test "deregister removes DNS entry" {
    dns_add_entry "hub" "127.0.0.1"
    dns_remove_entry "hub"
    local hosts_file="$CONDUIT_CONFIG_DIR/conduit-hosts"
    run grep "hub.qp.local" "$hosts_file"
    [ "$status" -ne 0 ]
}

@test "deregister removes route" {
    route_add "hub" "127.0.0.1:8090"
    route_remove "hub"
    [ ! -f "$CONDUIT_CONFIG_DIR/routes/hub.caddy" ]
}

@test "deregister removes all three resources" {
    # Register
    registry_add_service "hub" "127.0.0.1" "8090"
    dns_add_entry "hub" "127.0.0.1"
    route_add "hub" "127.0.0.1:8090"

    # Deregister
    dns_remove_entry "hub"
    route_remove "hub"
    registry_remove_service "hub"

    # Verify all removed
    run registry_get_service "hub"
    [ "$status" -eq 1 ]
    local hosts_file="$CONDUIT_CONFIG_DIR/conduit-hosts"
    run grep "hub.qp.local" "$hosts_file"
    [ "$status" -ne 0 ]
    [ ! -f "$CONDUIT_CONFIG_DIR/routes/hub.caddy" ]
}

# ===========================================================================
# Re-register after deregister
# ===========================================================================

@test "re-register after deregister works" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_remove_service "hub"
    run registry_add_service "hub" "127.0.0.1" "8091"
    [ "$status" -eq 0 ]
    run registry_get_service "hub"
    [ "$status" -eq 0 ]
    local port
    port="$(echo "$output" | jq -r '.port')"
    [ "$port" = "8091" ]
}

@test "re-register preserves deregistered entry history" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_remove_service "hub"
    registry_add_service "hub" "127.0.0.1" "8091"
    run registry_list_services --all
    local total
    total="$(echo "$output" | jq 'length')"
    [ "$total" -eq 2 ]
}

# ===========================================================================
# Multiple services register independently
# ===========================================================================

@test "multiple services registered independently" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_add_service "grafana" "10.0.1.5" "3000"
    registry_add_service "prometheus" "10.0.1.5" "9090"
    run registry_service_count
    [ "$output" = "3" ]
}

@test "removing one service does not affect others" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_add_service "grafana" "10.0.1.5" "3000"
    registry_add_service "prometheus" "10.0.1.5" "9090"
    registry_remove_service "grafana"
    run registry_service_count
    [ "$output" = "2" ]
    run registry_get_service "hub"
    [ "$status" -eq 0 ]
    run registry_get_service "prometheus"
    [ "$status" -eq 0 ]
}

@test "DNS entries for multiple services are independent" {
    dns_add_entry "hub" "127.0.0.1"
    dns_add_entry "grafana" "10.0.1.5"
    dns_remove_entry "hub"
    local hosts_file="$CONDUIT_CONFIG_DIR/conduit-hosts"
    run grep "grafana.qp.local" "$hosts_file"
    [ "$status" -eq 0 ]
}

@test "routes for multiple services are independent" {
    route_add "hub" "127.0.0.1:8090"
    route_add "grafana" "10.0.1.5:3000"
    route_remove "hub"
    [ ! -f "$CONDUIT_CONFIG_DIR/routes/hub.caddy" ]
    [ -f "$CONDUIT_CONFIG_DIR/routes/grafana.caddy" ]
}

# ===========================================================================
# Full lifecycle with audit trail
# ===========================================================================

@test "full lifecycle: register, verify, deregister, verify inactive" {
    registry_add_service "hub" "127.0.0.1" "8090"
    audit_log "service_register" "success" "Registered hub"

    run registry_get_service "hub"
    [ "$status" -eq 0 ]
    [[ "$output" == *"active"* ]]

    registry_remove_service "hub"
    audit_log "service_deregister" "success" "Deregistered hub"

    run registry_get_service "hub"
    [ "$status" -eq 1 ]

    run audit_read 10
    [ "$status" -eq 0 ]
    [[ "$output" == *"service_register"* ]]
    [[ "$output" == *"service_deregister"* ]]
}

@test "Caddyfile reflects current active routes" {
    route_add "hub" "127.0.0.1:8090"
    route_add "grafana" "10.0.1.5:3000"
    route_generate_caddyfile
    local caddyfile="$CONDUIT_CONFIG_DIR/Caddyfile"
    run grep "hub.qp.local" "$caddyfile"
    [ "$status" -eq 0 ]
    run grep "grafana.qp.local" "$caddyfile"
    [ "$status" -eq 0 ]

    route_remove "hub"
    route_generate_caddyfile
    run grep "hub.qp.local" "$caddyfile"
    [ "$status" -ne 0 ]
    run grep "grafana.qp.local" "$caddyfile"
    [ "$status" -eq 0 ]
}

@test "health update persists through Caddyfile regeneration" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_update_health "hub" "healthy" "$(ts_iso)"
    route_add "hub" "127.0.0.1:8090"
    route_generate_caddyfile

    local path
    path="$(registry_path)"
    run jq -r '.services[0].health_status' "$path"
    [ "$output" = "healthy" ]
}
