# Audit Log Conformance

Golden test vectors for validating QP Conduit's structured JSONL audit log format.

## Audit Log Format

QP Conduit writes one JSON object per line to `~/.config/<app-name>/audit.log`. Each line is a self-contained JSON object (JSONL format, not a JSON array).

### Required Fields

Every audit entry must contain these six fields:

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO 8601 UTC timestamp (`YYYY-MM-DDTHH:MM:SSZ`) |
| `action` | string | Operation identifier (see valid actions below) |
| `status` | string | `"success"` or `"failure"` |
| `message` | string | Human-readable description of the operation |
| `user` | string | System username that executed the command |
| `details` | object | Structured metadata (action-specific, may be empty `{}`) |

### Valid Actions

| Action | Script | Description |
|--------|--------|-------------|
| `conduit_setup` | conduit-setup.sh | Conduit initialized (dnsmasq, Caddy, internal CA) |
| `service_register` | conduit-register.sh | Service registered with DNS, TLS, and routing |
| `service_deregister` | conduit-deregister.sh | Service deregistered and archived |
| `cert_rotate` | conduit-certs.sh | Certificate revoked and reissued for a service |
| `cert_revoke` | conduit-deregister.sh | Certificate archived during deregistration |
| `dns_flush` | conduit-dns.sh | DNS cache flushed |
| `dns_add` | conduit-register.sh | DNS entry added for a service |
| `dns_remove` | conduit-deregister.sh | DNS entry removed for a service |
| `health_change` | conduit-status.sh | Service health status transition (up/down) |
| `monitor_alert` | conduit-monitor.sh | Hardware threshold exceeded (GPU temp, disk, memory) |
| `*_error` | Any (ERR trap) | Error trap fired during execution |

### Details by Action

Each action writes specific fields in the `details` object:

**conduit_setup:**
```json
{"domain": "qp.local", "dns": "dnsmasq", "proxy": "caddy", "ca": "ed25519"}
```

**service_register:**
```json
{"name": "hub", "host": "127.0.0.1", "port": "8090", "protocol": "https", "health_path": "/healthz", "tls": true}
```

**service_deregister:**
```json
{"name": "hub"}
```

**cert_rotate:**
```json
{"name": "hub"}
```

**cert_revoke:**
```json
{"name": "hub"}
```

**dns_flush:**
```json
{}
```

**dns_add:**
```json
{"name": "hub", "host": "127.0.0.1"}
```

**dns_remove:**
```json
{"name": "hub"}
```

**health_change:**
```json
{"name": "hub", "previous": "healthy", "current": "down", "checked_at": "2026-04-04T14:30:00Z"}
```

**monitor_alert:**
```json
{"metric": "gpu_temperature", "value": 92, "threshold": 85, "unit": "celsius", "gpu_index": 0}
```

**error trap:**
```json
{"line": "42", "script": "conduit-register"}
```

## Validation Rules

A conformant audit entry must satisfy all of the following:

1. The entry is valid JSON (parseable by `jq`)
2. All six required fields are present
3. `timestamp` matches the pattern `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$`
4. `action` is a non-empty string
5. `status` is `"success"` or `"failure"`
6. `message` is a string (may be empty)
7. `user` is a non-empty string
8. `details` is a JSON object (not null, not an array, not a scalar)
9. No secrets or tokens appear unmasked in the `message` field
10. The entry occupies exactly one line (no embedded newlines in the serialized JSON)

## Capsule Sealing (Optional)

When `qp-capsule` is installed, each audit entry is also sealed as a tamper-evident Capsule in `capsules.db`. The sealed entry includes:

- SHA3-256 hash of the JSON content
- Ed25519 signature
- Chain linkage to the previous Capsule

The JSONL audit log is the fast local index. The Capsule database is the cryptographic source of truth. Both contain the same entries.

Verify integrity:

```bash
qp-capsule verify --db ~/.config/qp-conduit/capsules.db
```

## Test Fixtures

The `audit-fixtures.json` file contains golden test vectors. Each fixture has:

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | What this fixture tests |
| `entry` | object | The exact JSON audit log entry |
| `valid` | boolean | Whether a conformant validator should accept this entry |

### Using the Fixtures

For every fixture where `valid` is `true`:

1. Serialize `entry` as compact JSON (no whitespace)
2. Parse it back
3. Confirm all six required fields are present and correctly typed
4. Confirm `timestamp`, `status`, and `details` pass validation rules

For every fixture where `valid` is `false`:

1. Attempt to validate `entry`
2. Confirm the validator rejects it
3. The `description` field explains what is wrong

## Adding New Fixtures

New fixtures must:

1. Test a specific edge case or action type
2. Be deterministic (no random data)
3. Include `description`, `entry`, and `valid`
4. Use realistic but fictional data
