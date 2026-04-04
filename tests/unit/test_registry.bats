#!/usr/bin/env bats
# tests/unit/test_registry.bats
# Unit tests for lib/registry.sh

LIB_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../lib" && pwd)"

setup() {
    export HOME="$BATS_TMPDIR"
    export CONDUIT_CONFIG_DIR="$BATS_TMPDIR/test-conduit-reg-$$-$BATS_TEST_NUMBER"
    source "$LIB_DIR/registry.sh"

    # Stub _capsule_seal (avoid external dependency)
    _capsule_seal() { return 0; }
    export -f _capsule_seal

    registry_init
}

teardown() {
    rm -rf "${CONDUIT_CONFIG_DIR:-}" 2>/dev/null || true
}

# Helper: cross-platform permission check
_get_perms() {
    stat -c '%a' "$1" 2>/dev/null || stat -f '%A' "$1" 2>/dev/null
}

# ===========================================================================
# registry_init
# ===========================================================================

@test "registry_init creates services.json" {
    local path
    path="$(registry_path)"
    [ -f "$path" ]
}

@test "registry_init is idempotent" {
    registry_init
    local path
    path="$(registry_path)"
    [ -f "$path" ]
    jq empty "$path"
}

@test "registry_init creates valid JSON structure" {
    local path
    path="$(registry_path)"
    run jq -r '.version' "$path"
    [ "$output" = "1" ]
    run jq -r '.services | length' "$path"
    [ "$output" = "0" ]
}

@test "registry_init sets 600 permissions" {
    local path
    path="$(registry_path)"
    local perms
    perms="$(_get_perms "$path")"
    [ "$perms" = "600" ]
}

@test "registry_init backs up corrupt file" {
    local path
    path="$(registry_path)"
    echo "not json" > "$path"
    registry_init
    jq empty "$path"
    # Backup should exist
    local backup_count
    backup_count="$(ls "${path}.bak."* 2>/dev/null | wc -l)"
    [ "$backup_count" -ge 1 ]
}

# ===========================================================================
# registry_path
# ===========================================================================

@test "registry_path returns services.json path" {
    run registry_path
    [ "$status" -eq 0 ]
    [[ "$output" == *"/services.json" ]]
}

@test "registry_path uses CONDUIT_CONFIG_DIR" {
    run registry_path
    [[ "$output" == "$CONDUIT_CONFIG_DIR/services.json" ]]
}

# ===========================================================================
# registry_add_service: success
# ===========================================================================

@test "registry_add_service adds a service" {
    registry_add_service "hub" "127.0.0.1" "8090"
    local path
    path="$(registry_path)"
    run jq -r '.services[0].name' "$path"
    [ "$output" = "hub" ]
}

@test "registry_add_service sets host field" {
    registry_add_service "hub" "127.0.0.1" "8090"
    local path
    path="$(registry_path)"
    run jq -r '.services[0].host' "$path"
    [ "$output" = "127.0.0.1" ]
}

@test "registry_add_service sets port as number" {
    registry_add_service "hub" "127.0.0.1" "8090"
    local path
    path="$(registry_path)"
    run jq -r '.services[0].port' "$path"
    [ "$output" = "8090" ]
    # Verify it is a number, not a string
    run jq '.services[0].port | type' "$path"
    [ "$output" = '"number"' ]
}

@test "registry_add_service sets protocol default to https" {
    registry_add_service "hub" "127.0.0.1" "8090"
    local path
    path="$(registry_path)"
    run jq -r '.services[0].protocol' "$path"
    [ "$output" = "https" ]
}

@test "registry_add_service accepts custom protocol" {
    registry_add_service "hub" "127.0.0.1" "8090" "http"
    local path
    path="$(registry_path)"
    run jq -r '.services[0].protocol' "$path"
    [ "$output" = "http" ]
}

@test "registry_add_service sets health_path default" {
    registry_add_service "hub" "127.0.0.1" "8090"
    local path
    path="$(registry_path)"
    run jq -r '.services[0].health_path' "$path"
    [ "$output" = "/healthz" ]
}

@test "registry_add_service accepts custom health_path" {
    registry_add_service "grafana" "10.0.1.5" "3000" "https" "/api/health"
    local path
    path="$(registry_path)"
    run jq -r '.services[0].health_path' "$path"
    [ "$output" = "/api/health" ]
}

@test "registry_add_service sets status to active" {
    registry_add_service "hub" "127.0.0.1" "8090"
    local path
    path="$(registry_path)"
    run jq -r '.services[0].status' "$path"
    [ "$output" = "active" ]
}

@test "registry_add_service sets health_status to unknown" {
    registry_add_service "hub" "127.0.0.1" "8090"
    local path
    path="$(registry_path)"
    run jq -r '.services[0].health_status' "$path"
    [ "$output" = "unknown" ]
}

@test "registry_add_service sets registered_at timestamp" {
    registry_add_service "hub" "127.0.0.1" "8090"
    local path
    path="$(registry_path)"
    run jq -r '.services[0].registered_at' "$path"
    [[ "$output" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]]
}

@test "registry_add_service sets deregistered_at to null" {
    registry_add_service "hub" "127.0.0.1" "8090"
    local path
    path="$(registry_path)"
    run jq -r '.services[0].deregistered_at' "$path"
    [ "$output" = "null" ]
}

@test "registry_add_service sets last_health_check to null" {
    registry_add_service "hub" "127.0.0.1" "8090"
    local path
    path="$(registry_path)"
    run jq -r '.services[0].last_health_check' "$path"
    [ "$output" = "null" ]
}

@test "registry_add_service includes all required fields" {
    registry_add_service "hub" "127.0.0.1" "8090" "https" "/healthz"
    local path
    path="$(registry_path)"
    local keys
    keys="$(jq -r '.services[0] | keys[]' "$path" | sort | tr '\n' ',')"
    [[ "$keys" == *"name,"* ]]
    [[ "$keys" == *"host,"* ]]
    [[ "$keys" == *"port,"* ]]
    [[ "$keys" == *"protocol,"* ]]
    [[ "$keys" == *"health_path,"* ]]
    [[ "$keys" == *"status,"* ]]
    [[ "$keys" == *"health_status,"* ]]
    [[ "$keys" == *"registered_at,"* ]]
}

# ===========================================================================
# registry_add_service: validation
# ===========================================================================

@test "registry_add_service rejects duplicate active name" {
    registry_add_service "hub" "127.0.0.1" "8090"
    run registry_add_service "hub" "10.0.1.1" "8091"
    [ "$status" -eq 1 ]
    [[ "$output" == *"already exists"* ]]
}

@test "registry_add_service rejects invalid name" {
    run registry_add_service "bad name" "127.0.0.1" "8090"
    [ "$status" -eq 1 ]
}

@test "registry_add_service rejects empty name" {
    run registry_add_service "" "127.0.0.1" "8090"
    [ "$status" -eq 1 ]
}

@test "registry_add_service rejects invalid port: zero" {
    run registry_add_service "hub" "127.0.0.1" "0"
    [ "$status" -eq 1 ]
}

@test "registry_add_service rejects invalid port: negative" {
    run registry_add_service "hub" "127.0.0.1" "-1"
    [ "$status" -eq 1 ]
}

@test "registry_add_service rejects invalid port: too high" {
    run registry_add_service "hub" "127.0.0.1" "70000"
    [ "$status" -eq 1 ]
}

@test "registry_add_service rejects invalid port: non-numeric" {
    run registry_add_service "hub" "127.0.0.1" "abc"
    [ "$status" -eq 1 ]
}

@test "registry_add_service accepts port 1" {
    run registry_add_service "hub" "127.0.0.1" "1"
    [ "$status" -eq 0 ]
}

@test "registry_add_service accepts port 65535" {
    run registry_add_service "hub" "127.0.0.1" "65535"
    [ "$status" -eq 0 ]
}

@test "registry_add_service allows re-adding after deregister" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_remove_service "hub"
    run registry_add_service "hub" "127.0.0.1" "8091"
    [ "$status" -eq 0 ]
}

# ===========================================================================
# registry_remove_service
# ===========================================================================

@test "registry_remove_service marks service as inactive" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_remove_service "hub"
    local path
    path="$(registry_path)"
    run jq -r '.services[0].status' "$path"
    [ "$output" = "inactive" ]
}

@test "registry_remove_service sets deregistered_at timestamp" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_remove_service "hub"
    local path
    path="$(registry_path)"
    run jq -r '.services[0].deregistered_at' "$path"
    [[ "$output" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]]
}

@test "registry_remove_service fails for nonexistent service" {
    run registry_remove_service "nonexistent"
    [ "$status" -eq 1 ]
    [[ "$output" == *"No active service"* ]]
}

@test "registry_remove_service preserves entry (does not delete)" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_remove_service "hub"
    local path
    path="$(registry_path)"
    run jq '.services | length' "$path"
    [ "$output" = "1" ]
}

@test "registry_remove_service rejects invalid name" {
    run registry_remove_service "bad name"
    [ "$status" -eq 1 ]
}

@test "registry_remove_service fails for already-inactive service" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_remove_service "hub"
    run registry_remove_service "hub"
    [ "$status" -eq 1 ]
}

# ===========================================================================
# registry_get_service
# ===========================================================================

@test "registry_get_service returns active service" {
    registry_add_service "hub" "127.0.0.1" "8090"
    run registry_get_service "hub"
    [ "$status" -eq 0 ]
    [[ "$output" == *"hub"* ]]
}

@test "registry_get_service returns valid JSON" {
    registry_add_service "hub" "127.0.0.1" "8090"
    run registry_get_service "hub"
    echo "$output" | jq empty
}

@test "registry_get_service returns correct fields" {
    registry_add_service "hub" "127.0.0.1" "8090" "https" "/healthz"
    run registry_get_service "hub"
    local name
    name="$(echo "$output" | jq -r '.name')"
    [ "$name" = "hub" ]
    local host
    host="$(echo "$output" | jq -r '.host')"
    [ "$host" = "127.0.0.1" ]
}

@test "registry_get_service fails for nonexistent service" {
    run registry_get_service "nonexistent"
    [ "$status" -eq 1 ]
}

@test "registry_get_service fails for inactive service" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_remove_service "hub"
    run registry_get_service "hub"
    [ "$status" -eq 1 ]
}

# ===========================================================================
# registry_list_services
# ===========================================================================

@test "registry_list_services returns empty array when none" {
    run registry_list_services
    [ "$status" -eq 0 ]
    local count
    count="$(echo "$output" | jq 'length')"
    [ "$count" -eq 0 ]
}

@test "registry_list_services returns active services only" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_add_service "grafana" "10.0.1.5" "3000"
    registry_remove_service "hub"
    run registry_list_services
    [ "$status" -eq 0 ]
    local count
    count="$(echo "$output" | jq 'length')"
    [ "$count" -eq 1 ]
    local name
    name="$(echo "$output" | jq -r '.[0].name')"
    [ "$name" = "grafana" ]
}

@test "registry_list_services returns all services with --all" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_add_service "grafana" "10.0.1.5" "3000"
    registry_remove_service "hub"
    run registry_list_services --all
    [ "$status" -eq 0 ]
    local count
    count="$(echo "$output" | jq 'length')"
    [ "$count" -eq 2 ]
}

@test "registry_list_services returns valid JSON array" {
    registry_add_service "hub" "127.0.0.1" "8090"
    run registry_list_services
    echo "$output" | jq empty
}

@test "registry_list_services returns multiple active services" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_add_service "grafana" "10.0.1.5" "3000"
    registry_add_service "prometheus" "10.0.1.5" "9090"
    run registry_list_services
    local count
    count="$(echo "$output" | jq 'length')"
    [ "$count" -eq 3 ]
}

# ===========================================================================
# registry_update_health
# ===========================================================================

@test "registry_update_health updates health_status" {
    registry_add_service "hub" "127.0.0.1" "8090"
    local now
    now="$(ts_iso)"
    registry_update_health "hub" "healthy" "$now"
    local path
    path="$(registry_path)"
    run jq -r '.services[0].health_status' "$path"
    [ "$output" = "healthy" ]
}

@test "registry_update_health updates last_health_check timestamp" {
    registry_add_service "hub" "127.0.0.1" "8090"
    local now
    now="$(ts_iso)"
    registry_update_health "hub" "healthy" "$now"
    local path
    path="$(registry_path)"
    run jq -r '.services[0].last_health_check' "$path"
    [ "$output" = "$now" ]
}

@test "registry_update_health can set status to down" {
    registry_add_service "hub" "127.0.0.1" "8090"
    local now
    now="$(ts_iso)"
    registry_update_health "hub" "down" "$now"
    local path
    path="$(registry_path)"
    run jq -r '.services[0].health_status' "$path"
    [ "$output" = "down" ]
}

@test "registry_update_health updates only target service" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_add_service "grafana" "10.0.1.5" "3000"
    local now
    now="$(ts_iso)"
    registry_update_health "hub" "healthy" "$now"
    local path
    path="$(registry_path)"
    run jq -r '.services[1].health_status' "$path"
    [ "$output" = "unknown" ]
}

# ===========================================================================
# registry_service_count
# ===========================================================================

@test "registry_service_count returns zero for empty registry" {
    run registry_service_count
    [ "$status" -eq 0 ]
    [ "$output" = "0" ]
}

@test "registry_service_count counts active services only" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_add_service "grafana" "10.0.1.5" "3000"
    registry_remove_service "hub"
    run registry_service_count
    [ "$output" = "1" ]
}

@test "registry_service_count returns correct count for multiple" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_add_service "grafana" "10.0.1.5" "3000"
    registry_add_service "prometheus" "10.0.1.5" "9090"
    run registry_service_count
    [ "$output" = "3" ]
}

# ===========================================================================
# Atomic file operations
# ===========================================================================

@test "registry file remains valid JSON after add" {
    registry_add_service "hub" "127.0.0.1" "8090"
    local path
    path="$(registry_path)"
    jq empty "$path"
}

@test "registry file remains valid JSON after remove" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_remove_service "hub"
    local path
    path="$(registry_path)"
    jq empty "$path"
}

@test "registry file remains valid JSON after health update" {
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_update_health "hub" "healthy" "$(ts_iso)"
    local path
    path="$(registry_path)"
    jq empty "$path"
}

@test "no temporary files left after add" {
    registry_add_service "hub" "127.0.0.1" "8090"
    local tmp_count
    tmp_count="$(find "$CONDUIT_CONFIG_DIR" -name 'services.json.tmp.*' 2>/dev/null | wc -l | tr -d ' ')"
    [ "$tmp_count" = "0" ]
}

# ===========================================================================
# _validate_port
# ===========================================================================

@test "_validate_port accepts port 80" {
    run _validate_port 80
    [ "$status" -eq 0 ]
}

@test "_validate_port accepts port 443" {
    run _validate_port 443
    [ "$status" -eq 0 ]
}

@test "_validate_port accepts port 8080" {
    run _validate_port 8080
    [ "$status" -eq 0 ]
}

@test "_validate_port rejects port 0" {
    run _validate_port 0
    [ "$status" -eq 1 ]
}

@test "_validate_port rejects port 65536" {
    run _validate_port 65536
    [ "$status" -eq 1 ]
}

@test "_validate_port rejects non-numeric" {
    run _validate_port "abc"
    [ "$status" -eq 1 ]
}

@test "_validate_port rejects empty" {
    run _validate_port ""
    [ "$status" -eq 1 ]
}

# ===========================================================================
# _validate_ip
# ===========================================================================

@test "_validate_ip accepts 127.0.0.1" {
    run _validate_ip "127.0.0.1"
    [ "$status" -eq 0 ]
}

@test "_validate_ip accepts 10.0.1.5" {
    run _validate_ip "10.0.1.5"
    [ "$status" -eq 0 ]
}

@test "_validate_ip accepts 255.255.255.255" {
    run _validate_ip "255.255.255.255"
    [ "$status" -eq 0 ]
}

@test "_validate_ip rejects 256.0.0.1" {
    run _validate_ip "256.0.0.1"
    [ "$status" -eq 1 ]
}

@test "_validate_ip rejects text" {
    run _validate_ip "localhost"
    [ "$status" -eq 1 ]
}

@test "_validate_ip rejects empty" {
    run _validate_ip ""
    [ "$status" -eq 1 ]
}
