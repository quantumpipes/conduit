#!/usr/bin/env bash
# tests/smoke/test_standalone.sh
# Smoke tests: verify that standalone Conduit toolkit files exist and are valid.
# Does NOT execute conduit operations (no Caddy/dnsmasq required).

set -euo pipefail

CONDUIT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

PASS=0
FAIL=0
TOTAL=0

check() {
    local desc="$1"
    shift
    TOTAL=$((TOTAL + 1))
    if "$@" >/dev/null 2>&1; then
        echo "  PASS: $desc"
        PASS=$((PASS + 1))
    else
        echo "  FAIL: $desc"
        FAIL=$((FAIL + 1))
    fi
}

echo "QP Conduit Smoke Tests"
echo "======================"

# ---------------------------------------------------------------------------
# Command scripts exist and are executable
# ---------------------------------------------------------------------------

check "conduit-preflight.sh exists"     test -f "$CONDUIT_DIR/conduit-preflight.sh"
check "conduit-preflight.sh executable" test -x "$CONDUIT_DIR/conduit-preflight.sh"
check "conduit-setup.sh exists"         test -f "$CONDUIT_DIR/conduit-setup.sh"
check "conduit-setup.sh executable"     test -x "$CONDUIT_DIR/conduit-setup.sh"
check "conduit-register.sh exists"      test -f "$CONDUIT_DIR/conduit-register.sh"
check "conduit-register.sh executable"  test -x "$CONDUIT_DIR/conduit-register.sh"
check "conduit-deregister.sh exists"    test -f "$CONDUIT_DIR/conduit-deregister.sh"
check "conduit-deregister.sh executable" test -x "$CONDUIT_DIR/conduit-deregister.sh"
check "conduit-status.sh exists"        test -f "$CONDUIT_DIR/conduit-status.sh"
check "conduit-status.sh executable"    test -x "$CONDUIT_DIR/conduit-status.sh"
check "conduit-monitor.sh exists"       test -f "$CONDUIT_DIR/conduit-monitor.sh"
check "conduit-monitor.sh executable"   test -x "$CONDUIT_DIR/conduit-monitor.sh"
check "conduit-certs.sh exists"         test -f "$CONDUIT_DIR/conduit-certs.sh"
check "conduit-certs.sh executable"     test -x "$CONDUIT_DIR/conduit-certs.sh"
check "conduit-dns.sh exists"           test -f "$CONDUIT_DIR/conduit-dns.sh"
check "conduit-dns.sh executable"       test -x "$CONDUIT_DIR/conduit-dns.sh"

# ---------------------------------------------------------------------------
# Library files exist
# ---------------------------------------------------------------------------

check "lib/common.sh exists"      test -f "$CONDUIT_DIR/lib/common.sh"
check "lib/audit.sh exists"       test -f "$CONDUIT_DIR/lib/audit.sh"
check "lib/registry.sh exists"    test -f "$CONDUIT_DIR/lib/registry.sh"
check "lib/dns.sh exists"         test -f "$CONDUIT_DIR/lib/dns.sh"
check "lib/tls.sh exists"         test -f "$CONDUIT_DIR/lib/tls.sh"
check "lib/routing.sh exists"     test -f "$CONDUIT_DIR/lib/routing.sh"

# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

check "templates/ directory exists"          test -d "$CONDUIT_DIR/templates"
check "Caddyfile.service.tpl exists"         test -f "$CONDUIT_DIR/templates/Caddyfile.service.tpl"

# ---------------------------------------------------------------------------
# Config and documentation
# ---------------------------------------------------------------------------

check ".env.conduit.example exists"    test -f "$CONDUIT_DIR/.env.conduit.example"
check "Makefile exists"                test -f "$CONDUIT_DIR/Makefile"
check "VERSION exists"                 test -f "$CONDUIT_DIR/VERSION"
check "README.md exists"              test -f "$CONDUIT_DIR/README.md"
check "LICENSE exists"                 test -f "$CONDUIT_DIR/LICENSE"

# ---------------------------------------------------------------------------
# VERSION file contains valid semver
# ---------------------------------------------------------------------------

check "VERSION is valid semver" bash -c 'grep -qE "^[0-9]+\.[0-9]+\.[0-9]+" '"$CONDUIT_DIR"'/VERSION'

# ---------------------------------------------------------------------------
# All scripts have shebang line
# ---------------------------------------------------------------------------

check "conduit-preflight.sh has shebang"  bash -c 'head -1 '"$CONDUIT_DIR"'/conduit-preflight.sh | grep -q "^#!/usr/bin/env bash"'
check "conduit-setup.sh has shebang"      bash -c 'head -1 '"$CONDUIT_DIR"'/conduit-setup.sh | grep -q "^#!/usr/bin/env bash"'
check "conduit-register.sh has shebang"   bash -c 'head -1 '"$CONDUIT_DIR"'/conduit-register.sh | grep -q "^#!/usr/bin/env bash"'
check "conduit-deregister.sh has shebang" bash -c 'head -1 '"$CONDUIT_DIR"'/conduit-deregister.sh | grep -q "^#!/usr/bin/env bash"'
check "conduit-status.sh has shebang"     bash -c 'head -1 '"$CONDUIT_DIR"'/conduit-status.sh | grep -q "^#!/usr/bin/env bash"'
check "conduit-monitor.sh has shebang"    bash -c 'head -1 '"$CONDUIT_DIR"'/conduit-monitor.sh | grep -q "^#!/usr/bin/env bash"'
check "conduit-certs.sh has shebang"      bash -c 'head -1 '"$CONDUIT_DIR"'/conduit-certs.sh | grep -q "^#!/usr/bin/env bash"'
check "conduit-dns.sh has shebang"        bash -c 'head -1 '"$CONDUIT_DIR"'/conduit-dns.sh | grep -q "^#!/usr/bin/env bash"'

# ---------------------------------------------------------------------------
# All scripts have set -euo pipefail
# ---------------------------------------------------------------------------

check "conduit-preflight.sh: strict mode"  grep -q 'set -euo pipefail' "$CONDUIT_DIR/conduit-preflight.sh"
check "conduit-setup.sh: strict mode"      grep -q 'set -euo pipefail' "$CONDUIT_DIR/conduit-setup.sh"
check "conduit-register.sh: strict mode"   grep -q 'set -euo pipefail' "$CONDUIT_DIR/conduit-register.sh"
check "conduit-deregister.sh: strict mode" grep -q 'set -euo pipefail' "$CONDUIT_DIR/conduit-deregister.sh"
check "conduit-status.sh: strict mode"     grep -q 'set -euo pipefail' "$CONDUIT_DIR/conduit-status.sh"
check "conduit-monitor.sh: strict mode"    grep -q 'set -euo pipefail' "$CONDUIT_DIR/conduit-monitor.sh"
check "conduit-certs.sh: strict mode"      grep -q 'set -euo pipefail' "$CONDUIT_DIR/conduit-certs.sh"
check "conduit-dns.sh: strict mode"        grep -q 'set -euo pipefail' "$CONDUIT_DIR/conduit-dns.sh"

# ---------------------------------------------------------------------------
# All scripts have copyright header
# ---------------------------------------------------------------------------

check "conduit-preflight.sh: copyright"  grep -q 'Copyright' "$CONDUIT_DIR/conduit-preflight.sh"
check "conduit-setup.sh: copyright"      grep -q 'Copyright' "$CONDUIT_DIR/conduit-setup.sh"
check "conduit-register.sh: copyright"   grep -q 'Copyright' "$CONDUIT_DIR/conduit-register.sh"
check "conduit-deregister.sh: copyright" grep -q 'Copyright' "$CONDUIT_DIR/conduit-deregister.sh"
check "conduit-status.sh: copyright"     grep -q 'Copyright' "$CONDUIT_DIR/conduit-status.sh"
check "conduit-monitor.sh: copyright"    grep -q 'Copyright' "$CONDUIT_DIR/conduit-monitor.sh"
check "conduit-certs.sh: copyright"      grep -q 'Copyright' "$CONDUIT_DIR/conduit-certs.sh"
check "conduit-dns.sh: copyright"        grep -q 'Copyright' "$CONDUIT_DIR/conduit-dns.sh"
check "lib/common.sh: copyright"         grep -q 'Copyright' "$CONDUIT_DIR/lib/common.sh"
check "lib/audit.sh: copyright"          grep -q 'Copyright' "$CONDUIT_DIR/lib/audit.sh"
check "lib/registry.sh: copyright"       grep -q 'Copyright' "$CONDUIT_DIR/lib/registry.sh"
check "lib/dns.sh: copyright"            grep -q 'Copyright' "$CONDUIT_DIR/lib/dns.sh"
check "lib/tls.sh: copyright"            grep -q 'Copyright' "$CONDUIT_DIR/lib/tls.sh"
check "lib/routing.sh: copyright"        grep -q 'Copyright' "$CONDUIT_DIR/lib/routing.sh"

# ---------------------------------------------------------------------------
# No .env files committed (security check)
# ---------------------------------------------------------------------------

check "no .env.conduit committed"  test ! -f "$CONDUIT_DIR/.env.conduit"
check "no .env committed"         test ! -f "$CONDUIT_DIR/.env"

# ---------------------------------------------------------------------------
# UI directory
# ---------------------------------------------------------------------------

check "ui/ directory exists"       test -d "$CONDUIT_DIR/ui"
check "ui/package.json exists"     test -f "$CONDUIT_DIR/ui/package.json"

# ---------------------------------------------------------------------------
# Server
# ---------------------------------------------------------------------------

check "server.py exists"           test -f "$CONDUIT_DIR/server.py"

# ---------------------------------------------------------------------------
# Lib modules have shebang
# ---------------------------------------------------------------------------

check "lib/common.sh has shebang"   bash -c 'head -1 '"$CONDUIT_DIR"'/lib/common.sh | grep -q "^#!/usr/bin/env bash"'
check "lib/audit.sh has shebang"    bash -c 'head -1 '"$CONDUIT_DIR"'/lib/audit.sh | grep -q "^#!/usr/bin/env bash"'
check "lib/registry.sh has shebang" bash -c 'head -1 '"$CONDUIT_DIR"'/lib/registry.sh | grep -q "^#!/usr/bin/env bash"'
check "lib/dns.sh has shebang"      bash -c 'head -1 '"$CONDUIT_DIR"'/lib/dns.sh | grep -q "^#!/usr/bin/env bash"'
check "lib/tls.sh has shebang"      bash -c 'head -1 '"$CONDUIT_DIR"'/lib/tls.sh | grep -q "^#!/usr/bin/env bash"'
check "lib/routing.sh has shebang"  bash -c 'head -1 '"$CONDUIT_DIR"'/lib/routing.sh | grep -q "^#!/usr/bin/env bash"'

# ---------------------------------------------------------------------------
# Lib audit.sh has Capsule integration
# ---------------------------------------------------------------------------

check "audit.sh: _ensure_capsule"   grep -q '_ensure_capsule' "$CONDUIT_DIR/lib/audit.sh"
check "audit.sh: pip install"       grep -q 'pip install.*qp-capsule' "$CONDUIT_DIR/lib/audit.sh"
check "audit.sh: _capsule_seal"     grep -q '_capsule_seal' "$CONDUIT_DIR/lib/audit.sh"
check "audit.sh: audit_verify"      grep -q 'audit_verify' "$CONDUIT_DIR/lib/audit.sh"

# Check audit.sh calls _capsule_seal from audit_log (critical fix verification)
check "audit.sh: capsule_seal called in audit_log" bash -c 'sed -n "/^audit_log/,/^}/p" '"$CONDUIT_DIR"'/lib/audit.sh | grep -q "_capsule_seal"'

# Check preflight ensures capsule
check "preflight: _ensure_capsule"  grep -q '_ensure_capsule' "$CONDUIT_DIR/conduit-preflight.sh"

# ---------------------------------------------------------------------------
# CONDUIT_APP_NAME generalization
# ---------------------------------------------------------------------------

check "common.sh: CONDUIT_APP_NAME" grep -q 'CONDUIT_APP_NAME' "$CONDUIT_DIR/lib/common.sh"

# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------

echo ""
echo "Results: $PASS/$TOTAL passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
