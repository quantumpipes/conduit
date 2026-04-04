# Defense Installation (Classified Environment)

A classified facility running QP on STIG-hardened servers in an air-gapped network. All infrastructure changes require audit accountability and cryptographic verification. Capsule Protocol sealing is mandatory. Certificate rotation follows DoD 90-day policy.

## Network Layout

```
Classification: CUI / SECRET (facility-dependent)

Primary Server (10.100.0.1)          GPU Server (10.100.0.10)
  QP Core :8000                        vLLM :8001 (classified LLM)
  QP Hub :8090                         NVIDIA H200 (80GB VRAM)
  PostgreSQL :5432
  Redis :6379
  QP Conduit (gateway)
    dnsmasq :53
    Caddy :443
    Dashboard :9999

Analyst Workstation (10.100.0.50)    Admin Workstation (10.100.0.51)
  Browser access to Hub                Conduit management
  Read-only service access             Service registration
```

All machines are on an isolated, physically secured network (10.100.0.0/24). No wireless. No internet gateway. No cross-domain solutions unless explicitly authorized.

## Prerequisites

- RHEL 9 (STIG-hardened, DISA STIG applied)
- All software pre-staged and scanned through the approved software intake process
- FIPS mode enabled on all hosts (`fips=1` kernel parameter)
- SSH key-based authentication only (no passwords)
- Dedicated service accounts with restricted shells

## Step 1: Install Pre-Staged Dependencies

All binaries arrive via the approved software intake pipeline (scanned, signed, verified):

```bash
# Install from approved repository mirror
sudo dnf install --disablerepo=* --enablerepo=local-mirror jq dnsmasq

# Caddy binary (built with GOEXPERIMENT=boringcrypto for FIPS)
sudo cp /media/approved/caddy-fips /usr/local/bin/caddy
sudo chmod 755 /usr/local/bin/caddy

# Python packages (offline)
pip install --no-index --find-links /media/approved/python/ -r requirements.txt

# Capsule Protocol CLI (mandatory for this environment)
pip install --no-index --find-links /media/approved/python/ qp-capsule
```

## Step 2: Initialize Conduit

```bash
cd /opt/qp-conduit

# Custom domain suffix for the facility
./conduit-setup.sh --domain=foxtrot.mil.internal --upstream-dns=127.0.0.1

# Verify Capsule Protocol is active
qp-capsule verify --db ~/.config/qp-conduit/capsules.db
```

Verify the setup audit entry was sealed:

```bash
tail -1 ~/.config/qp-conduit/audit.log | jq .
# Confirm action="setup", status="success"
```

## Step 3: Register Classified Services

```bash
# Primary server services
./conduit-register.sh --name=core --host=10.100.0.1 --port=8000
./conduit-register.sh --name=hub --host=10.100.0.1 --port=8090
./conduit-register.sh --name=postgres --host=10.100.0.1 --port=5432 --no-tls
./conduit-register.sh --name=redis --host=10.100.0.1 --port=6379 --no-tls

# GPU server
./conduit-register.sh --name=vllm --host=10.100.0.10 --port=8001 --health=/health
```

Verify each registration created a Capsule:

```bash
qp-capsule verify --db ~/.config/qp-conduit/capsules.db
# Should show: "Chain valid. N capsules verified."
```

## Step 4: Capsule Protocol Sealing (Mandatory)

In this environment, Capsule sealing is not optional. Verify it is active after every operation:

```bash
# Check that qp-capsule is installed
which qp-capsule

# Verify chain integrity
qp-capsule verify --db ~/.config/qp-conduit/capsules.db

# Inspect individual capsules
qp-capsule inspect --db ~/.config/qp-conduit/capsules.db --last 5
```

If the chain verification fails, stop operations and investigate:

```bash
qp-capsule inspect --db ~/.config/qp-conduit/capsules.db
# Look for broken links or invalid signatures
```

A broken chain indicates potential tampering. Report to the facility security officer immediately.

## Step 5: Certificate Rotation Policy (90-Day)

DoD mandates certificate rotation every 90 days. Schedule rotations on the first business day of each quarter:

```bash
# Rotate all service certificates
for svc in core hub vllm; do
  ./conduit-certs.sh --rotate=$svc
  echo "Rotated: $svc at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
done

# Verify rotation was logged and sealed
qp-capsule verify --db ~/.config/qp-conduit/capsules.db

# Verify all services are healthy
./conduit-status.sh
```

After rotation, redistribute the CA certificate if it was regenerated (typically only every 10 years for the root CA).

## Step 6: Audit Chain Verification Schedule

| Check | Frequency | Responsible | Method |
|---|---|---|---|
| Capsule chain integrity | Daily (automated) | ISSO | `qp-capsule verify --db capsules.db` |
| Audit log review | Daily | ISSO | Review `audit.log` for anomalies |
| Full chain inspection | Weekly | Security Officer | `qp-capsule inspect --db capsules.db` |
| Audit export for assessment | Monthly | ISSM | Export and archive (see below) |

### Automated Daily Verification

Create a cron job for automated verification:

```bash
# /etc/cron.daily/conduit-verify
#!/bin/bash
if ! qp-capsule verify --db /root/.config/qp-conduit/capsules.db; then
  echo "ALERT: Conduit Capsule chain verification FAILED" | \
    mail -s "CONDUIT SECURITY ALERT" isso@facility.mil
fi
```

## Step 7: Integration with QP Tunnel (Controlled External Access)

If the facility has an authorized cross-domain solution for controlled external access:

1. QP Tunnel runs on an approved boundary device
2. Tunnel peers connect through the CDS and WireGuard
3. Traffic arrives on the internal network at the Conduit gateway
4. Conduit routes to classified services via internal DNS and TLS

This configuration requires explicit authorization from the facility's Authorizing Official (AO). Document the data flow in the System Security Plan (SSP).

## Step 8: CMMC Level 2 Compliance Documentation

Conduit supports these CMMC L2 practices:

| Practice | ID | Conduit Control |
|---|---|---|
| Encrypt CUI in transit | SC.L2-3.13.8 | TLS 1.3 on all internal routes |
| Monitor system security | SI.L2-3.14.6 | Service health checks, GPU monitoring |
| Audit events | AU.L2-3.3.1 | Structured JSONL audit log |
| Audit content | AU.L2-3.3.2 | Timestamp, user, action, status, details |
| Protect audit information | AU.L2-3.3.8 | Capsule Protocol (SHA3-256 + Ed25519 + hash chain) |
| Review audit logs | AU.L2-3.3.3 | Daily review procedure (Step 6) |
| Limit access to CUI | AC.L2-3.1.3 | TLS certificates, DNS-based routing |

Document these controls in your SSP and reference the Conduit audit log as evidence.

## Operational Security Checklist

| Task | Frequency | Status |
|---|---|---|
| Verify Capsule chain integrity | Daily | |
| Review audit log for anomalies | Daily | |
| Check service health | Daily | |
| Monitor GPU temperature and VRAM | Daily | |
| Back up config directory to approved storage | Weekly | |
| Full chain inspection | Weekly | |
| Export audit records | Monthly | |
| Rotate all service certificates | Every 90 days | |
| Review access accounts | Quarterly | |
| CA certificate expiry check | Annually | |
| Update Conduit to latest approved version | As released | |

## Backup Procedure

Back up to approved encrypted storage only:

```bash
# Encrypt the backup with an approved key
tar czf - ~/.config/qp-conduit/ | \
  openssl enc -aes-256-cbc -salt -pbkdf2 -out /media/backup/conduit-$(date +%Y%m%d).enc

# Verify the backup
openssl enc -d -aes-256-cbc -pbkdf2 -in /media/backup/conduit-$(date +%Y%m%d).enc | \
  tar tzf - | head -5
```

Store backups according to facility data handling procedures. The backup contains the CA private key, which is classified at the same level as the data it protects.
