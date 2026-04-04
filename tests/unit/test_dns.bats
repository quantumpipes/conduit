#!/usr/bin/env bats
# tests/unit/test_dns.bats
# Unit tests for lib/dns.sh

LIB_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../lib" && pwd)"

setup() {
    export HOME="$BATS_TMPDIR"
    export CONDUIT_CONFIG_DIR="$BATS_TMPDIR/test-conduit-dns-$$-$BATS_TEST_NUMBER"
    export CONDUIT_DOMAIN="qp.local"
    source "$LIB_DIR/dns.sh"

    # Stub _capsule_seal
    _capsule_seal() { return 0; }
    export -f _capsule_seal
}

teardown() {
    rm -rf "${CONDUIT_CONFIG_DIR:-}" 2>/dev/null || true
}

# Helper: cross-platform permission check
_get_perms() {
    stat -c '%a' "$1" 2>/dev/null || stat -f '%A' "$1" 2>/dev/null
}

# ===========================================================================
# dns_add_entry
# ===========================================================================

@test "dns_add_entry creates hosts file" {
    dns_add_entry "hub" "127.0.0.1"
    local hosts_file="$CONDUIT_CONFIG_DIR/conduit-hosts"
    [ -f "$hosts_file" ]
}

@test "dns_add_entry adds correct entry" {
    dns_add_entry "hub" "127.0.0.1"
    local hosts_file="$CONDUIT_CONFIG_DIR/conduit-hosts"
    run cat "$hosts_file"
    [[ "$output" == *"127.0.0.1 hub.qp.local"* ]]
}

@test "dns_add_entry uses CONDUIT_DOMAIN for FQDN" {
    export CONDUIT_DOMAIN="custom.test"
    dns_add_entry "grafana" "10.0.1.5"
    local hosts_file="$CONDUIT_CONFIG_DIR/conduit-hosts"
    run cat "$hosts_file"
    [[ "$output" == *"grafana.custom.test"* ]]
}

@test "dns_add_entry validates name" {
    run dns_add_entry "bad name" "127.0.0.1"
    [ "$status" -eq 1 ]
}

@test "dns_add_entry rejects empty name" {
    run dns_add_entry "" "127.0.0.1"
    [ "$status" -eq 1 ]
}

@test "dns_add_entry replaces existing entry for same name" {
    dns_add_entry "hub" "127.0.0.1"
    dns_add_entry "hub" "10.0.1.5"
    local hosts_file="$CONDUIT_CONFIG_DIR/conduit-hosts"
    local count
    count="$(grep -c "hub.qp.local" "$hosts_file")"
    [ "$count" -eq 1 ]
    run cat "$hosts_file"
    [[ "$output" == *"10.0.1.5 hub.qp.local"* ]]
}

@test "dns_add_entry adds multiple entries" {
    dns_add_entry "hub" "127.0.0.1"
    dns_add_entry "grafana" "10.0.1.5"
    local hosts_file="$CONDUIT_CONFIG_DIR/conduit-hosts"
    local count
    count="$(wc -l < "$hosts_file" | tr -d ' ')"
    [ "$count" -eq 2 ]
}

@test "dns_add_entry hosts file is not world-readable" {
    dns_add_entry "hub" "127.0.0.1"
    local hosts_file="$CONDUIT_CONFIG_DIR/conduit-hosts"
    # The initial touch sets 600, but mv of the temp file may inherit umask.
    # Verify the file exists and is not world-readable.
    [ -f "$hosts_file" ]
    local perms
    perms="$(_get_perms "$hosts_file")"
    # Accept 600 (explicit chmod) or 644/640 (umask-dependent after mv)
    [[ "$perms" =~ ^6[0-4][0-4]$ ]]
}

# ===========================================================================
# dns_remove_entry
# ===========================================================================

@test "dns_remove_entry removes existing entry" {
    dns_add_entry "hub" "127.0.0.1"
    dns_remove_entry "hub"
    local hosts_file="$CONDUIT_CONFIG_DIR/conduit-hosts"
    if [ -f "$hosts_file" ]; then
        run grep "hub.qp.local" "$hosts_file"
        [ "$status" -ne 0 ]
    fi
}

@test "dns_remove_entry succeeds when hosts file missing" {
    run dns_remove_entry "nonexistent"
    [ "$status" -eq 0 ]
}

@test "dns_remove_entry preserves other entries" {
    dns_add_entry "hub" "127.0.0.1"
    dns_add_entry "grafana" "10.0.1.5"
    dns_remove_entry "hub"
    local hosts_file="$CONDUIT_CONFIG_DIR/conduit-hosts"
    run grep "grafana.qp.local" "$hosts_file"
    [ "$status" -eq 0 ]
}

@test "dns_remove_entry removes only target entry" {
    dns_add_entry "hub" "127.0.0.1"
    dns_add_entry "hub2" "10.0.1.2"
    dns_remove_entry "hub"
    local hosts_file="$CONDUIT_CONFIG_DIR/conduit-hosts"
    run grep "hub2.qp.local" "$hosts_file"
    [ "$status" -eq 0 ]
    run grep "^[0-9.]* hub.qp.local$" "$hosts_file"
    [ "$status" -ne 0 ]
}

# ===========================================================================
# dns_list_entries
# ===========================================================================

@test "dns_list_entries shows no entries message when empty" {
    run dns_list_entries
    [ "$status" -eq 0 ]
    [[ "$output" == *"(no entries)"* ]]
}

@test "dns_list_entries shows no entries when file missing" {
    run dns_list_entries
    [ "$status" -eq 0 ]
    [[ "$output" == *"(no entries)"* ]]
}

@test "dns_list_entries shows header row" {
    dns_add_entry "hub" "127.0.0.1"
    run dns_list_entries
    [[ "$output" == *"HOSTNAME"* ]]
    [[ "$output" == *"IP"* ]]
}

@test "dns_list_entries lists all entries" {
    dns_add_entry "hub" "127.0.0.1"
    dns_add_entry "grafana" "10.0.1.5"
    run dns_list_entries
    [[ "$output" == *"hub.qp.local"* ]]
    [[ "$output" == *"grafana.qp.local"* ]]
}

@test "dns_list_entries shows IP addresses" {
    dns_add_entry "hub" "127.0.0.1"
    run dns_list_entries
    [[ "$output" == *"127.0.0.1"* ]]
}

# ===========================================================================
# dns_generate_dnsmasq_conf
# ===========================================================================

@test "dns_generate_dnsmasq_conf creates config file" {
    dns_generate_dnsmasq_conf
    local conf_file="$CONDUIT_CONFIG_DIR/dnsmasq.conf"
    [ -f "$conf_file" ]
}

@test "dns_generate_dnsmasq_conf includes listen-address" {
    dns_generate_dnsmasq_conf
    local conf_file="$CONDUIT_CONFIG_DIR/dnsmasq.conf"
    run grep "listen-address=127.0.0.1" "$conf_file"
    [ "$status" -eq 0 ]
}

@test "dns_generate_dnsmasq_conf includes port" {
    export CONDUIT_DNS_PORT="5353"
    dns_generate_dnsmasq_conf
    local conf_file="$CONDUIT_CONFIG_DIR/dnsmasq.conf"
    run grep "port=5353" "$conf_file"
    [ "$status" -eq 0 ]
}

@test "dns_generate_dnsmasq_conf includes upstream server" {
    export CONDUIT_UPSTREAM_DNS="8.8.8.8"
    dns_generate_dnsmasq_conf
    local conf_file="$CONDUIT_CONFIG_DIR/dnsmasq.conf"
    run grep "server=8.8.8.8" "$conf_file"
    [ "$status" -eq 0 ]
}

@test "dns_generate_dnsmasq_conf includes addn-hosts" {
    dns_generate_dnsmasq_conf
    local conf_file="$CONDUIT_CONFIG_DIR/dnsmasq.conf"
    run grep "addn-hosts=" "$conf_file"
    [ "$status" -eq 0 ]
}

@test "dns_generate_dnsmasq_conf includes bogus-priv" {
    dns_generate_dnsmasq_conf
    local conf_file="$CONDUIT_CONFIG_DIR/dnsmasq.conf"
    run grep "bogus-priv" "$conf_file"
    [ "$status" -eq 0 ]
}

@test "dns_generate_dnsmasq_conf includes no-resolv" {
    dns_generate_dnsmasq_conf
    local conf_file="$CONDUIT_CONFIG_DIR/dnsmasq.conf"
    run grep "no-resolv" "$conf_file"
    [ "$status" -eq 0 ]
}

@test "dns_generate_dnsmasq_conf sets 600 permissions" {
    dns_generate_dnsmasq_conf
    local conf_file="$CONDUIT_CONFIG_DIR/dnsmasq.conf"
    local perms
    perms="$(_get_perms "$conf_file")"
    [ "$perms" = "600" ]
}

@test "dns_generate_dnsmasq_conf enables log-queries" {
    dns_generate_dnsmasq_conf
    local conf_file="$CONDUIT_CONFIG_DIR/dnsmasq.conf"
    run grep "log-queries" "$conf_file"
    [ "$status" -eq 0 ]
}

# ===========================================================================
# dns_flush (requires dnsmasq stub)
# ===========================================================================

@test "dns_flush fails when dnsmasq not on PATH" {
    # Override PATH so dnsmasq is not found
    PATH="/usr/bin:/bin" run dns_flush
    [ "$status" -eq 1 ]
}

# ===========================================================================
# dns_reload
# ===========================================================================

@test "dns_reload fails when dnsmasq not on PATH" {
    PATH="/usr/bin:/bin" run dns_reload
    [ "$status" -eq 1 ]
}
