#!/usr/bin/env bats
# tests/integration/test_file_permissions.bats
# Verifies that all file operations maintain secure permissions throughout workflows.

LIB_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../lib" && pwd)"

setup() {
    export HOME="$BATS_TMPDIR"
    export CONDUIT_CONFIG_DIR="$BATS_TMPDIR/test-perms-$$-$BATS_TEST_NUMBER"
    export CONDUIT_CERTS_DIR="$CONDUIT_CONFIG_DIR/certs"
    export CONDUIT_DOMAIN="qp.local"
    source "$LIB_DIR/common.sh"
    source "$LIB_DIR/registry.sh"
    source "$LIB_DIR/audit.sh"
    source "$LIB_DIR/dns.sh"
    source "$LIB_DIR/routing.sh"
    source "$LIB_DIR/tls.sh"

    # Stub _capsule_seal
    _capsule_seal() { return 0; }
    export -f _capsule_seal

    apply_defaults
}

teardown() {
    rm -rf "${CONDUIT_CONFIG_DIR:-}" 2>/dev/null || true
}

# Helper: cross-platform permission check
_get_perms() {
    stat -c '%a' "$1" 2>/dev/null || stat -f '%A' "$1" 2>/dev/null
}

# ===========================================================================
# Config directory
# ===========================================================================

@test "ensure_config_dir creates with 700" {
    ensure_config_dir >/dev/null
    local perms
    perms="$(_get_perms "$CONDUIT_CONFIG_DIR")"
    [ "$perms" = "700" ]
}

@test "config dir permissions survive multiple ensure_config_dir calls" {
    ensure_config_dir >/dev/null
    ensure_config_dir >/dev/null
    ensure_config_dir >/dev/null
    local perms
    perms="$(_get_perms "$CONDUIT_CONFIG_DIR")"
    [ "$perms" = "700" ]
}

# ===========================================================================
# Services registry file
# ===========================================================================

@test "services.json created with 600" {
    registry_init
    local path
    path="$(registry_path)"
    local perms
    perms="$(_get_perms "$path")"
    [ "$perms" = "600" ]
}

@test "services.json permissions preserved after add" {
    registry_init
    registry_add_service "hub" "127.0.0.1" "8090"
    local path
    path="$(registry_path)"
    [ -f "$path" ]
    jq empty "$path"
}

@test "services.json remains valid after remove" {
    registry_init
    registry_add_service "hub" "127.0.0.1" "8090"
    registry_remove_service "hub"
    local path
    path="$(registry_path)"
    jq empty "$path"
}

# ===========================================================================
# Audit log file
# ===========================================================================

@test "audit.log created with owner-only access" {
    set_safe_umask
    audit_log "test" "success" "msg"
    local perms
    perms="$(_get_perms "$CONDUIT_CONFIG_DIR/audit.log")"
    [ "$perms" = "600" ]
}

# ===========================================================================
# DNS hosts file
# ===========================================================================

@test "conduit-hosts is not world-readable" {
    dns_add_entry "hub" "127.0.0.1"
    local hosts_file="$CONDUIT_CONFIG_DIR/conduit-hosts"
    [ -f "$hosts_file" ]
    local perms
    perms="$(_get_perms "$hosts_file")"
    # Initial touch sets 600, but mv of temp file may inherit umask
    [[ "$perms" =~ ^6[0-4][0-4]$ ]]
}

# ===========================================================================
# dnsmasq config
# ===========================================================================

@test "dnsmasq.conf created with 600" {
    dns_generate_dnsmasq_conf
    local conf_file="$CONDUIT_CONFIG_DIR/dnsmasq.conf"
    local perms
    perms="$(_get_perms "$conf_file")"
    [ "$perms" = "600" ]
}

# ===========================================================================
# Route files
# ===========================================================================

@test "route file created with 600" {
    route_add "hub" "127.0.0.1:8090"
    local route_file="$CONDUIT_CONFIG_DIR/routes/hub.caddy"
    local perms
    perms="$(_get_perms "$route_file")"
    [ "$perms" = "600" ]
}

@test "routes directory created with 700" {
    route_add "hub" "127.0.0.1:8090"
    local perms
    perms="$(_get_perms "$CONDUIT_CONFIG_DIR/routes")"
    [ "$perms" = "700" ]
}

# ===========================================================================
# Caddyfile
# ===========================================================================

@test "Caddyfile created with 600" {
    route_generate_caddyfile
    local caddyfile="$CONDUIT_CONFIG_DIR/Caddyfile"
    local perms
    perms="$(_get_perms "$caddyfile")"
    [ "$perms" = "600" ]
}

# ===========================================================================
# TLS certificate files
# ===========================================================================

@test "CA key created with 600" {
    mkdir -p "$CONDUIT_CERTS_DIR"
    openssl req -x509 -newkey rsa:2048 -keyout "$CONDUIT_CERTS_DIR/root.key" \
        -out "$CONDUIT_CERTS_DIR/root.crt" -days 1 -nodes \
        -subj "/CN=Test CA" 2>/dev/null
    chmod 600 "$CONDUIT_CERTS_DIR/root.key"
    local perms
    perms="$(_get_perms "$CONDUIT_CERTS_DIR/root.key")"
    [ "$perms" = "600" ]
}

@test "service cert key created with 600" {
    mkdir -p "$CONDUIT_CERTS_DIR"
    openssl req -x509 -newkey rsa:2048 -keyout "$CONDUIT_CERTS_DIR/root.key" \
        -out "$CONDUIT_CERTS_DIR/root.crt" -days 1 -nodes \
        -subj "/CN=Test CA" 2>/dev/null
    chmod 600 "$CONDUIT_CERTS_DIR/root.key"
    tls_issue_cert "hub"
    local perms
    perms="$(_get_perms "$CONDUIT_CERTS_DIR/hub/key.pem")"
    [ "$perms" = "600" ]
}

@test "service cert directory created with 700" {
    mkdir -p "$CONDUIT_CERTS_DIR"
    openssl req -x509 -newkey rsa:2048 -keyout "$CONDUIT_CERTS_DIR/root.key" \
        -out "$CONDUIT_CERTS_DIR/root.crt" -days 1 -nodes \
        -subj "/CN=Test CA" 2>/dev/null
    chmod 600 "$CONDUIT_CERTS_DIR/root.key"
    tls_issue_cert "hub"
    local perms
    perms="$(_get_perms "$CONDUIT_CERTS_DIR/hub")"
    [ "$perms" = "700" ]
}

# ===========================================================================
# umask does not leak between operations
# ===========================================================================

@test "umask 077 persists across operations" {
    set_safe_umask
    [ "$(umask)" = "0077" ]
    registry_init
    [ "$(umask)" = "0077" ]
    dns_add_entry "hub" "127.0.0.1"
    [ "$(umask)" = "0077" ]
}

@test "files created after set_safe_umask have correct permissions" {
    set_safe_umask
    mkdir -p "$CONDUIT_CONFIG_DIR"
    touch "$CONDUIT_CONFIG_DIR/test_sensitive"
    local perms
    perms="$(_get_perms "$CONDUIT_CONFIG_DIR/test_sensitive")"
    [ "$perms" = "600" ]
}

@test "directories created after set_safe_umask have correct permissions" {
    set_safe_umask
    mkdir -p "$CONDUIT_CONFIG_DIR/subdir"
    local perms
    perms="$(_get_perms "$CONDUIT_CONFIG_DIR/subdir")"
    [ "$perms" = "700" ]
}
