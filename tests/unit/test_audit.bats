#!/usr/bin/env bats
# tests/unit/test_audit.bats
# Unit tests for lib/audit.sh

LIB_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../lib" && pwd)"

setup() {
    export HOME="$BATS_TMPDIR"
    export CONDUIT_CONFIG_DIR="$BATS_TMPDIR/test-conduit-audit-$$-$BATS_TEST_NUMBER"
    source "$LIB_DIR/audit.sh"

    # Stub qp-capsule so _capsule_seal is a no-op (avoid external dependency)
    _capsule_seal() { return 0; }
    export -f _capsule_seal
}

teardown() {
    rm -rf "${CONDUIT_CONFIG_DIR:-}" 2>/dev/null || true
}

# ===========================================================================
# audit_log: file creation
# ===========================================================================

@test "audit_log creates audit.log file" {
    audit_log "test_action" "success" "test message"
    [ -f "$CONDUIT_CONFIG_DIR/audit.log" ]
}

@test "audit_log creates config dir if missing" {
    rm -rf "$CONDUIT_CONFIG_DIR"
    audit_log "test" "success" "msg"
    [ -d "$CONDUIT_CONFIG_DIR" ]
    [ -f "$CONDUIT_CONFIG_DIR/audit.log" ]
}

# ===========================================================================
# audit_log: JSON validity
# ===========================================================================

@test "audit_log writes valid JSON" {
    audit_log "test_action" "success" "test message"
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    echo "$line" | jq empty
}

@test "audit_log writes single-line JSON (JSONL)" {
    audit_log "test" "success" "msg"
    local line_count
    line_count="$(wc -l < "$CONDUIT_CONFIG_DIR/audit.log")"
    [ "$line_count" -eq 1 ]
}

# ===========================================================================
# audit_log: required fields
# ===========================================================================

@test "audit_log includes timestamp field" {
    audit_log "test" "success" "msg"
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.timestamp' <<< "$line"
    [ -n "$output" ]
    [ "$output" != "null" ]
}

@test "audit_log timestamp is ISO 8601" {
    audit_log "test" "success" "msg"
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.timestamp' <<< "$line"
    [[ "$output" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]]
}

@test "audit_log includes action field" {
    audit_log "setup_complete" "success" "msg"
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.action' <<< "$line"
    [ "$output" = "setup_complete" ]
}

@test "audit_log includes status field" {
    audit_log "test" "success" "msg"
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.status' <<< "$line"
    [ "$output" = "success" ]
}

@test "audit_log status can be failure" {
    audit_log "test" "failure" "msg"
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.status' <<< "$line"
    [ "$output" = "failure" ]
}

@test "audit_log includes message field" {
    audit_log "test" "success" "Setup completed successfully"
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.message' <<< "$line"
    [ "$output" = "Setup completed successfully" ]
}

@test "audit_log includes user field" {
    audit_log "test" "success" "msg"
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.user' <<< "$line"
    [ -n "$output" ]
    [ "$output" != "null" ]
}

@test "audit_log includes details field" {
    audit_log "test" "success" "msg" '{"key":"value"}'
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.details.key' <<< "$line"
    [ "$output" = "value" ]
}

@test "audit_log has all 6 required fields" {
    audit_log "act" "success" "msg" '{"extra":"data"}'
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    local keys
    keys="$(echo "$line" | jq -r 'keys[]' | sort | tr '\n' ',')"
    [[ "$keys" == *"action,"* ]]
    [[ "$keys" == *"details,"* ]]
    [[ "$keys" == *"message,"* ]]
    [[ "$keys" == *"status,"* ]]
    [[ "$keys" == *"timestamp,"* ]]
    [[ "$keys" == *"user"* ]]
}

# ===========================================================================
# audit_log: details handling
# ===========================================================================

@test "audit_log details is valid JSON object" {
    audit_log "test" "success" "msg" '{"port":"443","domain":"qp.local"}'
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.details.port' <<< "$line"
    [ "$output" = "443" ]
    run jq -r '.details.domain' <<< "$line"
    [ "$output" = "qp.local" ]
}

@test "audit_log handles invalid details JSON gracefully" {
    audit_log "test" "success" "msg" "not-json"
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.details' <<< "$line"
    [ "$output" = "{}" ]
}

@test "audit_log handles empty details" {
    audit_log "test" "success" "msg"
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -c '.details' <<< "$line"
    [ "$output" = "{}" ]
}

@test "audit_log handles nested details JSON" {
    audit_log "test" "success" "msg" '{"service":{"name":"hub","port":8090}}'
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.details.service.name' <<< "$line"
    [ "$output" = "hub" ]
}

# ===========================================================================
# audit_log: appending (JSONL format)
# ===========================================================================

@test "audit_log appends multiple entries" {
    audit_log "action1" "success" "first"
    audit_log "action2" "failure" "second"
    local count
    count="$(wc -l < "$CONDUIT_CONFIG_DIR/audit.log")"
    [ "$count" -eq 2 ]
}

@test "audit_log appends three entries sequentially" {
    audit_log "a1" "success" "one"
    audit_log "a2" "success" "two"
    audit_log "a3" "success" "three"
    local count
    count="$(wc -l < "$CONDUIT_CONFIG_DIR/audit.log")"
    [ "$count" -eq 3 ]
}

@test "audit_log each line is valid JSON after multiple writes" {
    audit_log "a1" "success" "one"
    audit_log "a2" "failure" "two"
    while IFS= read -r line; do
        echo "$line" | jq empty
    done < "$CONDUIT_CONFIG_DIR/audit.log"
}

# ===========================================================================
# audit_log: action parameter matches
# ===========================================================================

@test "audit_log action matches setup" {
    audit_log "setup" "success" "msg"
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.action' <<< "$line"
    [ "$output" = "setup" ]
}

@test "audit_log action matches service_register" {
    audit_log "service_register" "success" "msg"
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.action' <<< "$line"
    [ "$output" = "service_register" ]
}

@test "audit_log action matches cert_rotate" {
    audit_log "cert_rotate" "success" "msg"
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.action' <<< "$line"
    [ "$output" = "cert_rotate" ]
}

@test "audit_log action matches dns_flush" {
    audit_log "dns_flush" "success" "msg"
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.action' <<< "$line"
    [ "$output" = "dns_flush" ]
}

# ===========================================================================
# audit_read
# ===========================================================================

@test "audit_read returns empty array when no log exists" {
    run audit_read
    [ "$status" -eq 0 ]
    [ "$output" = "[]" ]
}

@test "audit_read returns empty array for missing file" {
    rm -f "$CONDUIT_CONFIG_DIR/audit.log" 2>/dev/null || true
    run audit_read 5
    [ "$status" -eq 0 ]
    [ "$output" = "[]" ]
}

@test "audit_read returns last N entries" {
    audit_log "a1" "success" "first"
    audit_log "a2" "success" "second"
    audit_log "a3" "success" "third"
    run audit_read 2
    [ "$status" -eq 0 ]
    local count
    count="$(echo "$output" | jq 'length')"
    [ "$count" -eq 2 ]
}

@test "audit_read returns all entries when N exceeds total" {
    audit_log "a1" "success" "first"
    audit_log "a2" "success" "second"
    run audit_read 100
    [ "$status" -eq 0 ]
    local count
    count="$(echo "$output" | jq 'length')"
    [ "$count" -eq 2 ]
}

@test "audit_read defaults to 10 entries" {
    for i in $(seq 1 15); do
        audit_log "a$i" "success" "msg $i"
    done
    run audit_read
    [ "$status" -eq 0 ]
    local count
    count="$(echo "$output" | jq 'length')"
    [ "$count" -eq 10 ]
}

@test "audit_read returns valid JSON array" {
    audit_log "a1" "success" "first"
    run audit_read
    echo "$output" | jq empty
}

@test "audit_read handles empty file" {
    mkdir -p "$CONDUIT_CONFIG_DIR"
    touch "$CONDUIT_CONFIG_DIR/audit.log"
    run audit_read
    [ "$status" -eq 0 ]
}

# ===========================================================================
# audit_trap_handler
# ===========================================================================

@test "audit_trap_handler logs failure entry" {
    audit_trap_handler "test_script"
    [ -f "$CONDUIT_CONFIG_DIR/audit.log" ]
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.status' <<< "$line"
    [ "$output" = "failure" ]
}

@test "audit_trap_handler action includes script name" {
    audit_trap_handler "conduit-setup"
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.action' <<< "$line"
    [ "$output" = "conduit-setup_error" ]
}

@test "audit_trap_handler message includes line number" {
    audit_trap_handler "test_script"
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.message' <<< "$line"
    [[ "$output" == *"line"* ]]
}

@test "audit_trap_handler details includes script field" {
    audit_trap_handler "conduit-register"
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.details.script' <<< "$line"
    [ "$output" = "conduit-register" ]
}

@test "audit_trap_handler details includes line field" {
    audit_trap_handler "test"
    local line
    line="$(cat "$CONDUIT_CONFIG_DIR/audit.log")"
    run jq -r '.details.line' <<< "$line"
    [ -n "$output" ]
    [ "$output" != "null" ]
}
