#!/usr/bin/env bats
# tests/integration/test_certs_trust_audit.bats
# Integration test: the privileged `conduit-certs.sh --trust` action (CA-trust
# install, the highest-privilege sudo-backed operation) must emit an immutable
# audit/capsule record, consistent with cert_rotate and dns_flush.

SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)"

setup() {
    export HOME="$BATS_TMPDIR"
    export CONDUIT_CONFIG_DIR="$BATS_TMPDIR/test-certs-trust-$$-$BATS_TEST_NUMBER"
    export CONDUIT_DOMAIN="qp.local"
    # qp-capsule is intentionally not required: the JSONL audit line is the
    # durable record and the capsule seal fails open when the CLI is absent.
}

teardown() {
    rm -rf "${CONDUIT_CONFIG_DIR:-}" 2>/dev/null || true
}

# When tls_trust_ca fails (no CA cert present, no sudo needed) the script must
# still record a `ca_trust_install` failure audit entry, then exit non-zero.
@test "conduit-certs.sh --trust seals a ca_trust_install audit entry on failure" {
    run "$SCRIPT_DIR/conduit-certs.sh" --trust
    # tls_trust_ca cannot find a CA cert in the isolated config dir, so the
    # privileged action fails and the script exits non-zero.
    [ "$status" -ne 0 ]

    local audit_log="$CONDUIT_CONFIG_DIR/audit.log"
    [ -f "$audit_log" ]

    local line
    line="$(grep '"action":"ca_trust_install"' "$audit_log" | tail -1)"
    [ -n "$line" ]

    run jq -r '.action' <<< "$line"
    [ "$output" = "ca_trust_install" ]
    run jq -r '.status' <<< "$line"
    [ "$output" = "failure" ]
}
