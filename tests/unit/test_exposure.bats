#!/usr/bin/env bats
# tests/unit/test_exposure.bats
# Unit tests for conduit-exposure.sh, with docker stubbed on PATH.

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/conduit-exposure.sh"

setup() {
    STUB_DIR="$BATS_TMPDIR/exposure-stub-$$-$BATS_TEST_NUMBER"
    mkdir -p "$STUB_DIR"
    export PATH="$STUB_DIR:$PATH"
}

teardown() {
    rm -rf "${STUB_DIR:-}" 2>/dev/null || true
}

# Helper: make `docker ps` print the given lines (name<TAB>ports)
_stub_docker() {
    printf '%s\n' "$@" > "$STUB_DIR/ps.out"
    cat > "$STUB_DIR/docker" <<EOF
#!/usr/bin/env bash
cat "$STUB_DIR/ps.out"
EOF
    chmod +x "$STUB_DIR/docker"
}

@test "loopback-only bindings pass" {
    _stub_docker $'qp-conduit\t127.0.0.1:9999->9999/tcp' \
                 $'caddy\t127.0.0.1:80->80/tcp, 127.0.0.1:443->443/tcp'
    run "$SCRIPT"
    [ "$status" -eq 0 ]
    [[ "$output" == *"No container publishes"* ]]
}

@test "containers with no published ports pass" {
    _stub_docker $'worker\t' $'db\t5432/tcp'
    run "$SCRIPT"
    [ "$status" -eq 0 ]
}

@test "an IPv4 wildcard binding fails and names the container" {
    _stub_docker $'api-1\t0.0.0.0:8280->8280/tcp'
    run "$SCRIPT"
    [ "$status" -eq 1 ]
    [[ "$output" == *"api-1"* ]]
    [[ "$output" == *"0.0.0.0:8280"* ]]
}

@test "an IPv6 wildcard binding fails" {
    _stub_docker $'hub\t[::]:8090->8080/tcp'
    run "$SCRIPT"
    [ "$status" -eq 1 ]
    [[ "$output" == *"[::]:8090"* ]]
}

@test "a wildcard binding hidden after a loopback one is still caught" {
    _stub_docker $'caddy\t127.0.0.1:2019->2019/tcp, 0.0.0.0:443->443/tcp'
    run "$SCRIPT"
    [ "$status" -eq 1 ]
    [[ "$output" == *"0.0.0.0:443"* ]]
    [[ "$output" != *"127.0.0.1:2019"* ]]
}

@test "--json lists exposed bindings and exits 1" {
    _stub_docker $'a\t0.0.0.0:80->80/tcp' $'b\t127.0.0.1:81->81/tcp'
    run "$SCRIPT" --json
    [ "$status" -eq 1 ]
    [ "$(echo "$output" | jq 'length')" -eq 1 ]
    [ "$(echo "$output" | jq -r '.[0].container')" = "a" ]
}

@test "--json on a clean host prints an empty list and exits 0" {
    _stub_docker $'a\t127.0.0.1:80->80/tcp'
    run "$SCRIPT" --json
    [ "$status" -eq 0 ]
    [ "$(echo "$output" | jq 'length')" -eq 0 ]
}

@test "a docker failure is could-not-look (exit 2), never clean" {
    cat > "$STUB_DIR/docker" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF
    chmod +x "$STUB_DIR/docker"
    run "$SCRIPT"
    [ "$status" -eq 2 ]
}

@test "unknown arguments are rejected" {
    _stub_docker $'a\t127.0.0.1:80->80/tcp'
    run "$SCRIPT" --bogus
    [ "$status" -eq 2 ]
}
