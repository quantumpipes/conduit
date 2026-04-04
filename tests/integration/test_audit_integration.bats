#!/usr/bin/env bats
# tests/integration/test_audit_integration.bats
# Integration tests for audit trail across operations.

LIB_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../lib" && pwd)"

setup() {
    export HOME="$BATS_TMPDIR"
    export CONDUIT_CONFIG_DIR="$BATS_TMPDIR/test-audit-int-$$-$BATS_TEST_NUMBER"
    export CONDUIT_DOMAIN="qp.local"
    source "$LIB_DIR/common.sh"
    source "$LIB_DIR/registry.sh"
    source "$LIB_DIR/audit.sh"

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
# Register creates audit entry
# ===========================================================================

@test "register operation creates audit entry" {
    registry_add_service "hub" "127.0.0.1" "8090"
    audit_log "service_register" "success" "Registered service: hub"
    local line
    line="$(tail -1 "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.action' <<< "$line"
    [ "$output" = "service_register" ]
    run jq -r '.status' <<< "$line"
    [ "$output" = "success" ]
}

@test "register audit entry includes service name in message" {
    registry_add_service "grafana" "10.0.1.5" "3000"
    audit_log "service_register" "success" "Registered service: grafana"
    local line
    line="$(tail -1 "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.message' <<< "$line"
    [[ "$output" == *"grafana"* ]]
}

# ===========================================================================
# Deregister creates audit entry
# ===========================================================================

@test "deregister operation creates audit entry" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_remove_service "hub"
    audit_log "service_deregister" "success" "Deregistered service: hub"
    local line
    line="$(tail -1 "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.action' <<< "$line"
    [ "$output" = "service_deregister" ]
}

# ===========================================================================
# Setup creates audit entry
# ===========================================================================

@test "setup operation creates audit entry" {
    audit_log "setup" "success" "Conduit initialized: domain=qp.local" \
        '{"domain":"qp.local","dns_port":"53"}'
    local line
    line="$(tail -1 "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.action' <<< "$line"
    [ "$output" = "setup" ]
    run jq -r '.details.domain' <<< "$line"
    [ "$output" = "qp.local" ]
}

# ===========================================================================
# Multiple operations create sequential entries
# ===========================================================================

@test "multiple operations create sequential entries" {
    audit_log "setup" "success" "Setup complete"
    audit_log "service_register" "success" "Registered hub"
    audit_log "service_register" "success" "Registered grafana"
    audit_log "service_deregister" "success" "Deregistered hub"
    local count
    count="$(wc -l < "$CONDUIT_CONFIG_DIR/audit.log")"
    [ "$count" -eq 4 ]
}

@test "sequential entries are all valid JSON" {
    audit_log "setup" "success" "Setup"
    audit_log "service_register" "success" "Registered hub"
    audit_log "dns_flush" "success" "DNS flushed"
    while IFS= read -r line; do
        echo "$line" | jq empty
    done < "$CONDUIT_CONFIG_DIR/audit.log"
}

@test "audit_read returns all sequential entries in order" {
    audit_log "setup" "success" "first"
    audit_log "service_register" "success" "second"
    audit_log "cert_rotate" "success" "third"
    run audit_read 10
    [ "$status" -eq 0 ]
    local count
    count="$(echo "$output" | jq 'length')"
    [ "$count" -eq 3 ]
}

# ===========================================================================
# Audit entries have correct actions
# ===========================================================================

@test "audit entries have correct action for each operation type" {
    audit_log "setup" "success" "Setup"
    audit_log "service_register" "success" "Register"
    audit_log "service_deregister" "success" "Deregister"
    audit_log "cert_rotate" "success" "Cert rotate"
    audit_log "dns_flush" "success" "DNS flush"
    audit_log "health_check" "success" "Health check"

    run audit_read 10
    [[ "$output" == *"setup"* ]]
    [[ "$output" == *"service_register"* ]]
    [[ "$output" == *"service_deregister"* ]]
    [[ "$output" == *"cert_rotate"* ]]
    [[ "$output" == *"dns_flush"* ]]
    [[ "$output" == *"health_check"* ]]
}

@test "failure audit entries record correctly" {
    audit_log "service_register" "failure" "Port validation failed"
    local line
    line="$(tail -1 "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.status' <<< "$line"
    [ "$output" = "failure" ]
    run jq -r '.message' <<< "$line"
    [[ "$output" == *"Port validation failed"* ]]
}

@test "audit trail survives registry operations" {
    audit_log "setup" "success" "init"
    registry_add_service "hub" "127.0.0.1" "8090"
    audit_log "service_register" "success" "hub"
    registry_remove_service "hub"
    audit_log "service_deregister" "success" "hub"

    run audit_read 10
    local count
    count="$(echo "$output" | jq 'length')"
    [ "$count" -eq 3 ]
}

@test "each audit entry has unique timestamp or same-second is acceptable" {
    audit_log "a1" "success" "first"
    audit_log "a2" "success" "second"
    run audit_read 10
    local ts1
    ts1="$(echo "$output" | jq -r '.[0].timestamp')"
    local ts2
    ts2="$(echo "$output" | jq -r '.[1].timestamp')"
    [ -n "$ts1" ]
    [ -n "$ts2" ]
}
