#!/usr/bin/env bats
# tests/unit/test_common.bats
# Unit tests for lib/common.sh

LIB_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../lib" && pwd)"

setup() {
    export HOME="$BATS_TMPDIR"
    export CONDUIT_CONFIG_DIR="$BATS_TMPDIR/test-conduit-$$-$BATS_TEST_NUMBER"
    source "$LIB_DIR/common.sh"
}

teardown() {
    rm -rf "${CONDUIT_CONFIG_DIR:-}" 2>/dev/null || true
}

# Helper: cross-platform permission check (GNU stat vs BSD stat)
_get_perms() {
    stat -c '%a' "$1" 2>/dev/null || stat -f '%A' "$1" 2>/dev/null
}

# ===========================================================================
# Logging: log_info
# ===========================================================================

@test "log_info writes to stderr" {
    run log_info "hello world"
    [ "$status" -eq 0 ]
    [[ "$output" == *"[INFO]"* ]]
    [[ "$output" == *"hello world"* ]]
}

@test "log_info includes message text" {
    run log_info "conduit started"
    [[ "$output" == *"conduit started"* ]]
}

@test "log_info returns success exit code" {
    run log_info "test"
    [ "$status" -eq 0 ]
}

@test "log_info handles empty message" {
    run log_info ""
    [ "$status" -eq 0 ]
    [[ "$output" == *"[INFO]"* ]]
}

@test "log_info handles multi-word message" {
    run log_info "this is a multi word message"
    [[ "$output" == *"this is a multi word message"* ]]
}

# ===========================================================================
# Logging: log_success
# ===========================================================================

@test "log_success writes OK tag" {
    run log_success "done"
    [ "$status" -eq 0 ]
    [[ "$output" == *"[OK]"* ]]
    [[ "$output" == *"done"* ]]
}

@test "log_success returns zero exit code" {
    run log_success "completed"
    [ "$status" -eq 0 ]
}

@test "log_success handles empty message" {
    run log_success ""
    [ "$status" -eq 0 ]
    [[ "$output" == *"[OK]"* ]]
}

# ===========================================================================
# Logging: log_warn
# ===========================================================================

@test "log_warn writes WARN tag" {
    run log_warn "caution"
    [ "$status" -eq 0 ]
    [[ "$output" == *"[WARN]"* ]]
    [[ "$output" == *"caution"* ]]
}

@test "log_warn returns zero exit code" {
    run log_warn "something"
    [ "$status" -eq 0 ]
}

@test "log_warn handles empty message" {
    run log_warn ""
    [ "$status" -eq 0 ]
    [[ "$output" == *"[WARN]"* ]]
}

# ===========================================================================
# Logging: log_error
# ===========================================================================

@test "log_error writes ERROR tag" {
    run log_error "something broke"
    [ "$status" -eq 0 ]
    [[ "$output" == *"[ERROR]"* ]]
    [[ "$output" == *"something broke"* ]]
}

@test "log_error returns zero exit code" {
    run log_error "failure"
    [ "$status" -eq 0 ]
}

@test "log_error handles empty message" {
    run log_error ""
    [ "$status" -eq 0 ]
    [[ "$output" == *"[ERROR]"* ]]
}

@test "log_error includes special characters in message" {
    run log_error "failed: port 443 already in use"
    [[ "$output" == *"port 443 already in use"* ]]
}

# ===========================================================================
# validate_service_name: valid names
# ===========================================================================

@test "validate_service_name accepts lowercase alpha" {
    run validate_service_name "hub"
    [ "$status" -eq 0 ]
}

@test "validate_service_name accepts uppercase alpha" {
    run validate_service_name "HUB"
    [ "$status" -eq 0 ]
}

@test "validate_service_name accepts mixed case" {
    run validate_service_name "MyService"
    [ "$status" -eq 0 ]
}

@test "validate_service_name accepts numeric" {
    run validate_service_name "service1"
    [ "$status" -eq 0 ]
}

@test "validate_service_name accepts all digits" {
    run validate_service_name "12345"
    [ "$status" -eq 0 ]
}

@test "validate_service_name accepts hyphens" {
    run validate_service_name "my-service"
    [ "$status" -eq 0 ]
}

@test "validate_service_name accepts underscores" {
    run validate_service_name "my_service"
    [ "$status" -eq 0 ]
}

@test "validate_service_name accepts hyphens and underscores combined" {
    run validate_service_name "my-svc_2"
    [ "$status" -eq 0 ]
}

@test "validate_service_name accepts single character" {
    run validate_service_name "a"
    [ "$status" -eq 0 ]
}

@test "validate_service_name accepts single digit" {
    run validate_service_name "1"
    [ "$status" -eq 0 ]
}

# ===========================================================================
# validate_service_name: invalid names
# ===========================================================================

@test "validate_service_name rejects empty string" {
    run validate_service_name ""
    [ "$status" -eq 1 ]
    [[ "$output" == *"must not be empty"* ]]
}

@test "validate_service_name rejects spaces" {
    run validate_service_name "has space"
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects dots" {
    run validate_service_name "has.dot"
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects forward slashes" {
    run validate_service_name "a/b"
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects backslashes" {
    run validate_service_name 'a\b'
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects at sign" {
    run validate_service_name "user@host"
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects colon" {
    run validate_service_name "host:port"
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects semicolons" {
    run validate_service_name 'svc;echo'
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects pipe" {
    run validate_service_name 'svc|cat'
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects ampersand" {
    run validate_service_name 'svc&'
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects exclamation mark" {
    run validate_service_name 'svc!'
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects dollar sign" {
    run validate_service_name '$HOME'
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects path traversal" {
    run validate_service_name "../../etc/passwd"
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects equals sign" {
    run validate_service_name "key=val"
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects parentheses" {
    run validate_service_name "svc()"
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects curly braces" {
    run validate_service_name "svc{}"
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects square brackets" {
    run validate_service_name "svc[0]"
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects tilde" {
    run validate_service_name "~root"
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects hash" {
    run validate_service_name "#comment"
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects percent" {
    run validate_service_name "100%"
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects caret" {
    run validate_service_name "svc^2"
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects tab character" {
    run validate_service_name $'svc\ttab'
    [ "$status" -eq 1 ]
}

@test "validate_service_name rejects newline" {
    run validate_service_name $'svc\nnewline'
    [ "$status" -eq 1 ]
}

# ===========================================================================
# require_cmd
# ===========================================================================

@test "require_cmd succeeds for existing command" {
    run require_cmd bash
    [ "$status" -eq 0 ]
}

@test "require_cmd succeeds for multiple existing commands" {
    run require_cmd bash ls
    [ "$status" -eq 0 ]
}

@test "require_cmd fails for missing command" {
    run require_cmd nonexistent_cmd_xyz_123
    [ "$status" -eq 1 ]
    [[ "$output" == *"nonexistent_cmd_xyz_123"* ]]
}

@test "require_cmd fails if any command in list is missing" {
    run require_cmd bash nonexistent_cmd_xyz_123
    [ "$status" -eq 1 ]
}

@test "require_cmd error message includes command name" {
    run require_cmd some_missing_tool
    [[ "$output" == *"some_missing_tool"* ]]
}

# ===========================================================================
# require_env
# ===========================================================================

@test "require_env succeeds when variable is set" {
    export TEST_VAR_CONDUIT="value"
    run require_env TEST_VAR_CONDUIT
    [ "$status" -eq 0 ]
    unset TEST_VAR_CONDUIT
}

@test "require_env succeeds for multiple set variables" {
    export TEST_A="val1"
    export TEST_B="val2"
    run require_env TEST_A TEST_B
    [ "$status" -eq 0 ]
    unset TEST_A TEST_B
}

@test "require_env fails when variable is unset" {
    unset MISSING_VAR_XYZ 2>/dev/null || true
    run require_env MISSING_VAR_XYZ
    [ "$status" -eq 1 ]
    [[ "$output" == *"MISSING_VAR_XYZ"* ]]
}

@test "require_env fails when variable is empty" {
    export EMPTY_VAR=""
    run require_env EMPTY_VAR
    [ "$status" -eq 1 ]
    unset EMPTY_VAR
}

@test "require_env fails if any variable is missing" {
    export PRESENT_VAR="ok"
    unset ABSENT_VAR 2>/dev/null || true
    run require_env PRESENT_VAR ABSENT_VAR
    [ "$status" -eq 1 ]
    unset PRESENT_VAR
}

@test "require_env error message includes variable name" {
    unset MY_MISSING_VAR 2>/dev/null || true
    run require_env MY_MISSING_VAR
    [[ "$output" == *"MY_MISSING_VAR"* ]]
}

# ===========================================================================
# set_safe_umask
# ===========================================================================

@test "set_safe_umask sets umask to 077" {
    set_safe_umask
    result="$(umask)"
    [ "$result" = "0077" ]
}

@test "set_safe_umask is idempotent" {
    set_safe_umask
    set_safe_umask
    result="$(umask)"
    [ "$result" = "0077" ]
}

@test "files created after set_safe_umask have 600 permissions" {
    set_safe_umask
    mkdir -p "$CONDUIT_CONFIG_DIR"
    local testfile="$CONDUIT_CONFIG_DIR/umask_test"
    touch "$testfile"
    local perms
    perms="$(_get_perms "$testfile")"
    [ "$perms" = "600" ]
}

# ===========================================================================
# mask_token
# ===========================================================================

@test "mask_token masks long token showing last 4 chars" {
    run mask_token "abcdefghijklmnop"
    [ "$status" -eq 0 ]
    [[ "$output" == *"mnop" ]]
    [[ "$output" != *"abcdef"* ]]
}

@test "mask_token output length matches input length for long tokens" {
    local token="abcdefghijklmnop"
    run mask_token "$token"
    [ "${#output}" -eq "${#token}" ]
}

@test "mask_token masks 8-char token" {
    run mask_token "abcd1234"
    [[ "$output" == "****1234" ]]
}

@test "mask_token masks short token (3 chars) entirely" {
    run mask_token "abc"
    [ "$output" = "****" ]
}

@test "mask_token masks 4-char token entirely" {
    run mask_token "abcd"
    [ "$output" = "****" ]
}

@test "mask_token handles empty string" {
    run mask_token ""
    [ "$status" -eq 0 ]
    [ "$output" = "****" ]
}

@test "mask_token with 5 chars shows last 4" {
    run mask_token "abcde"
    [ "$output" = "*bcde" ]
}

@test "mask_token with 1 char masks entirely" {
    run mask_token "x"
    [ "$output" = "****" ]
}

@test "mask_token with 64-char token (API key length)" {
    local token="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    run mask_token "$token"
    [[ "$output" == *"cdef" ]]
    [[ "$output" != *"01234567"* ]]
    [ "${#output}" -eq 64 ]
}

# ===========================================================================
# ensure_config_dir
# ===========================================================================

@test "ensure_config_dir creates directory" {
    run ensure_config_dir
    [ "$status" -eq 0 ]
    [ -d "$CONDUIT_CONFIG_DIR" ]
}

@test "ensure_config_dir returns directory path" {
    run ensure_config_dir
    [ "$status" -eq 0 ]
    [[ "$output" == "$CONDUIT_CONFIG_DIR" ]]
}

@test "ensure_config_dir is idempotent" {
    ensure_config_dir >/dev/null
    run ensure_config_dir
    [ "$status" -eq 0 ]
    [ -d "$CONDUIT_CONFIG_DIR" ]
}

@test "ensure_config_dir sets 700 permissions" {
    ensure_config_dir >/dev/null
    local perms
    perms="$(_get_perms "$CONDUIT_CONFIG_DIR")"
    [ "$perms" = "700" ]
}

@test "ensure_config_dir uses CONDUIT_CONFIG_DIR env var" {
    local custom_dir="$BATS_TMPDIR/custom-conduit-$$"
    export CONDUIT_CONFIG_DIR="$custom_dir"
    run ensure_config_dir
    [ -d "$custom_dir" ]
    rm -rf "$custom_dir"
}

# ===========================================================================
# apply_defaults
# ===========================================================================

@test "apply_defaults sets CONDUIT_APP_NAME" {
    unset CONDUIT_APP_NAME 2>/dev/null || true
    apply_defaults
    [ "$CONDUIT_APP_NAME" = "qp-conduit" ]
}

@test "apply_defaults sets CONDUIT_DOMAIN" {
    unset CONDUIT_DOMAIN 2>/dev/null || true
    apply_defaults
    [ "$CONDUIT_DOMAIN" = "qp.local" ]
}

@test "apply_defaults sets CONDUIT_DNS_PORT" {
    unset CONDUIT_DNS_PORT 2>/dev/null || true
    apply_defaults
    [ "$CONDUIT_DNS_PORT" = "53" ]
}

@test "apply_defaults sets CONDUIT_PROXY_PORT" {
    unset CONDUIT_PROXY_PORT 2>/dev/null || true
    apply_defaults
    [ "$CONDUIT_PROXY_PORT" = "443" ]
}

@test "apply_defaults sets CONDUIT_ADMIN_PORT" {
    unset CONDUIT_ADMIN_PORT 2>/dev/null || true
    apply_defaults
    [ "$CONDUIT_ADMIN_PORT" = "2019" ]
}

@test "apply_defaults sets CONDUIT_UPSTREAM_DNS" {
    unset CONDUIT_UPSTREAM_DNS 2>/dev/null || true
    apply_defaults
    [ "$CONDUIT_UPSTREAM_DNS" = "1.1.1.1" ]
}

@test "apply_defaults does not override existing CONDUIT_DOMAIN" {
    export CONDUIT_DOMAIN="custom.test"
    apply_defaults
    [ "$CONDUIT_DOMAIN" = "custom.test" ]
}

@test "apply_defaults does not override existing CONDUIT_DNS_PORT" {
    export CONDUIT_DNS_PORT="5353"
    apply_defaults
    [ "$CONDUIT_DNS_PORT" = "5353" ]
}

@test "apply_defaults does not override existing CONDUIT_PROXY_PORT" {
    export CONDUIT_PROXY_PORT="8443"
    apply_defaults
    [ "$CONDUIT_PROXY_PORT" = "8443" ]
}

@test "apply_defaults does not override existing CONDUIT_UPSTREAM_DNS" {
    export CONDUIT_UPSTREAM_DNS="8.8.8.8"
    apply_defaults
    [ "$CONDUIT_UPSTREAM_DNS" = "8.8.8.8" ]
}

@test "apply_defaults sets CONDUIT_CADDYFILE" {
    unset CONDUIT_CADDYFILE 2>/dev/null || true
    apply_defaults
    [[ "$CONDUIT_CADDYFILE" == *"Caddyfile"* ]]
}

@test "apply_defaults sets CONDUIT_DNSMASQ_CONF" {
    unset CONDUIT_DNSMASQ_CONF 2>/dev/null || true
    apply_defaults
    [[ "$CONDUIT_DNSMASQ_CONF" == *"dnsmasq.conf"* ]]
}

@test "apply_defaults sets CONDUIT_CERTS_DIR" {
    unset CONDUIT_CERTS_DIR 2>/dev/null || true
    apply_defaults
    [[ "$CONDUIT_CERTS_DIR" == *"certs"* ]]
}

# ===========================================================================
# ts_iso
# ===========================================================================

@test "ts_iso returns ISO 8601 format" {
    run ts_iso
    [ "$status" -eq 0 ]
    [[ "$output" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]]
}

@test "ts_iso returns UTC timestamp" {
    run ts_iso
    [[ "$output" == *"Z" ]]
}
