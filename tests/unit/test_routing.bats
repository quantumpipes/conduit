#!/usr/bin/env bats
# tests/unit/test_routing.bats
# Unit tests for lib/routing.sh

LIB_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../lib" && pwd)"

setup() {
    export HOME="$BATS_TMPDIR"
    export CONDUIT_CONFIG_DIR="$BATS_TMPDIR/test-conduit-route-$$-$BATS_TEST_NUMBER"
    export CONDUIT_DOMAIN="qp.local"
    export CONDUIT_ADMIN_PORT="2019"
    source "$LIB_DIR/routing.sh"

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
# route_add
# ===========================================================================

@test "route_add creates route file" {
    route_add "hub" "127.0.0.1:8090"
    local route_file="$CONDUIT_CONFIG_DIR/routes/hub.caddy"
    [ -f "$route_file" ]
}

@test "route_add generates correct domain" {
    route_add "hub" "127.0.0.1:8090"
    local route_file="$CONDUIT_CONFIG_DIR/routes/hub.caddy"
    run grep "hub.qp.local" "$route_file"
    [ "$status" -eq 0 ]
}

@test "route_add includes reverse_proxy upstream" {
    route_add "hub" "127.0.0.1:8090"
    local route_file="$CONDUIT_CONFIG_DIR/routes/hub.caddy"
    run grep "reverse_proxy 127.0.0.1:8090" "$route_file"
    [ "$status" -eq 0 ]
}

@test "route_add includes tls internal by default" {
    route_add "hub" "127.0.0.1:8090"
    local route_file="$CONDUIT_CONFIG_DIR/routes/hub.caddy"
    run grep "tls internal" "$route_file"
    [ "$status" -eq 0 ]
}

@test "route_add includes X-Forwarded-Proto header" {
    route_add "hub" "127.0.0.1:8090"
    local route_file="$CONDUIT_CONFIG_DIR/routes/hub.caddy"
    run grep "X-Forwarded-Proto" "$route_file"
    [ "$status" -eq 0 ]
}

@test "route_add includes X-Real-IP header" {
    route_add "hub" "127.0.0.1:8090"
    local route_file="$CONDUIT_CONFIG_DIR/routes/hub.caddy"
    run grep "X-Real-IP" "$route_file"
    [ "$status" -eq 0 ]
}

@test "route_add includes health check config" {
    route_add "hub" "127.0.0.1:8090"
    local route_file="$CONDUIT_CONFIG_DIR/routes/hub.caddy"
    run grep "health_uri /healthz" "$route_file"
    [ "$status" -eq 0 ]
}

@test "route_add includes log block" {
    route_add "hub" "127.0.0.1:8090"
    local route_file="$CONDUIT_CONFIG_DIR/routes/hub.caddy"
    run grep "format json" "$route_file"
    [ "$status" -eq 0 ]
}

@test "route_add sets 600 permissions" {
    route_add "hub" "127.0.0.1:8090"
    local route_file="$CONDUIT_CONFIG_DIR/routes/hub.caddy"
    local perms
    perms="$(_get_perms "$route_file")"
    [ "$perms" = "600" ]
}

@test "route_add validates service name" {
    run route_add "bad name" "127.0.0.1:8090"
    [ "$status" -eq 1 ]
}

@test "route_add uses custom TLS cert path" {
    local fake_cert_dir="$CONDUIT_CONFIG_DIR/certs/hub"
    mkdir -p "$fake_cert_dir"
    touch "$fake_cert_dir/cert.pem" "$fake_cert_dir/key.pem"
    route_add "hub" "127.0.0.1:8090" "$fake_cert_dir/cert.pem"
    local route_file="$CONDUIT_CONFIG_DIR/routes/hub.caddy"
    run grep "cert.pem" "$route_file"
    [ "$status" -eq 0 ]
    run grep "key.pem" "$route_file"
    [ "$status" -eq 0 ]
}

@test "route_add uses custom domain" {
    export CONDUIT_DOMAIN="custom.test"
    route_add "hub" "127.0.0.1:8090"
    local route_file="$CONDUIT_CONFIG_DIR/routes/hub.caddy"
    run grep "hub.custom.test" "$route_file"
    [ "$status" -eq 0 ]
}

@test "route_add creates routes directory" {
    route_add "hub" "127.0.0.1:8090"
    [ -d "$CONDUIT_CONFIG_DIR/routes" ]
}

@test "route_add routes directory has 700 permissions" {
    route_add "hub" "127.0.0.1:8090"
    local perms
    perms="$(_get_perms "$CONDUIT_CONFIG_DIR/routes")"
    [ "$perms" = "700" ]
}

# ===========================================================================
# route_remove
# ===========================================================================

@test "route_remove removes route file" {
    route_add "hub" "127.0.0.1:8090"
    route_remove "hub"
    [ ! -f "$CONDUIT_CONFIG_DIR/routes/hub.caddy" ]
}

@test "route_remove succeeds for nonexistent route" {
    run route_remove "nonexistent"
    [ "$status" -eq 0 ]
}

@test "route_remove preserves other routes" {
    route_add "hub" "127.0.0.1:8090"
    route_add "grafana" "10.0.1.5:3000"
    route_remove "hub"
    [ ! -f "$CONDUIT_CONFIG_DIR/routes/hub.caddy" ]
    [ -f "$CONDUIT_CONFIG_DIR/routes/grafana.caddy" ]
}

# ===========================================================================
# route_list
# ===========================================================================

@test "route_list shows no routes message when empty" {
    run route_list
    [ "$status" -eq 0 ]
    [[ "$output" == *"(no routes)"* ]]
}

@test "route_list shows header" {
    route_add "hub" "127.0.0.1:8090"
    run route_list
    [[ "$output" == *"SERVICE"* ]]
    [[ "$output" == *"ROUTE FILE"* ]]
}

@test "route_list lists added route" {
    route_add "hub" "127.0.0.1:8090"
    run route_list
    [[ "$output" == *"hub"* ]]
}

@test "route_list lists multiple routes" {
    route_add "hub" "127.0.0.1:8090"
    route_add "grafana" "10.0.1.5:3000"
    run route_list
    [[ "$output" == *"hub"* ]]
    [[ "$output" == *"grafana"* ]]
}

@test "route_list does not show removed routes" {
    route_add "hub" "127.0.0.1:8090"
    route_add "grafana" "10.0.1.5:3000"
    route_remove "hub"
    run route_list
    [[ "$output" != *"hub"* ]] || true
    [[ "$output" == *"grafana"* ]]
}

# ===========================================================================
# route_generate_caddyfile
# ===========================================================================

@test "route_generate_caddyfile creates Caddyfile" {
    route_generate_caddyfile
    local caddyfile="$CONDUIT_CONFIG_DIR/Caddyfile"
    [ -f "$caddyfile" ]
}

@test "route_generate_caddyfile includes admin block" {
    route_generate_caddyfile
    local caddyfile="$CONDUIT_CONFIG_DIR/Caddyfile"
    run grep "admin localhost:2019" "$caddyfile"
    [ "$status" -eq 0 ]
}

@test "route_generate_caddyfile includes local_certs" {
    route_generate_caddyfile
    local caddyfile="$CONDUIT_CONFIG_DIR/Caddyfile"
    run grep "local_certs" "$caddyfile"
    [ "$status" -eq 0 ]
}

@test "route_generate_caddyfile includes service routes" {
    route_add "hub" "127.0.0.1:8090"
    route_generate_caddyfile
    local caddyfile="$CONDUIT_CONFIG_DIR/Caddyfile"
    run grep "hub.qp.local" "$caddyfile"
    [ "$status" -eq 0 ]
}

@test "route_generate_caddyfile combines multiple service routes" {
    route_add "hub" "127.0.0.1:8090"
    route_add "grafana" "10.0.1.5:3000"
    route_generate_caddyfile
    local caddyfile="$CONDUIT_CONFIG_DIR/Caddyfile"
    run grep "hub.qp.local" "$caddyfile"
    [ "$status" -eq 0 ]
    run grep "grafana.qp.local" "$caddyfile"
    [ "$status" -eq 0 ]
}

@test "route_generate_caddyfile sets 600 permissions" {
    route_generate_caddyfile
    local caddyfile="$CONDUIT_CONFIG_DIR/Caddyfile"
    local perms
    perms="$(_get_perms "$caddyfile")"
    [ "$perms" = "600" ]
}

@test "route_generate_caddyfile creates logs directory" {
    route_generate_caddyfile
    [ -d "$CONDUIT_CONFIG_DIR/logs" ]
}

@test "route_generate_caddyfile is idempotent" {
    route_add "hub" "127.0.0.1:8090"
    route_generate_caddyfile
    route_generate_caddyfile
    local caddyfile="$CONDUIT_CONFIG_DIR/Caddyfile"
    [ -f "$caddyfile" ]
    local count
    count="$(grep -c "hub.qp.local" "$caddyfile")"
    [ "$count" -eq 1 ]
}

@test "route_generate_caddyfile uses custom admin port" {
    export CONDUIT_ADMIN_PORT="9999"
    route_generate_caddyfile
    local caddyfile="$CONDUIT_CONFIG_DIR/Caddyfile"
    run grep "admin localhost:9999" "$caddyfile"
    [ "$status" -eq 0 ]
}

# ===========================================================================
# route_reload
# ===========================================================================

@test "route_reload fails without Caddyfile" {
    run route_reload
    [ "$status" -eq 1 ]
}
