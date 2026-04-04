# Healthcare Clinic (Air-Gapped)

A primary care clinic running QP on an isolated network with no internet access. The system processes patient records with AI-assisted diagnostics. HIPAA compliance requires encryption in transit, access logging, and audit accountability.

## Network Layout

```
Clinic Server (10.10.0.1)           Imaging Workstation (10.10.0.5)
  QP Core :8000                       PACS Viewer :8080
  QP Hub :8090                        AI Diagnostics :8500
  PostgreSQL :5432
  Redis :6379
  Ollama :11434 (medical LLM)
  QP Conduit (gateway)
    dnsmasq :53
    Caddy :443
    Dashboard :9999
```

All machines are on an isolated VLAN (10.10.0.0/24) with no internet gateway.

## Prerequisites

- Ubuntu 24.04 Server (STIG-hardened recommended)
- All dependencies pre-staged on USB media (Caddy, jq, dnsmasq, Python 3.14, Node 22)
- No internet access on any machine in the network segment

## Step 1: Install Pre-Staged Dependencies

Transfer the staging USB to the clinic server:

```bash
# Install from local packages
sudo dpkg -i /media/staging/dnsmasq_*.deb
sudo cp /media/staging/caddy /usr/local/bin/caddy && sudo chmod 755 /usr/local/bin/caddy
sudo cp /media/staging/jq /usr/local/bin/jq && sudo chmod 755 /usr/local/bin/jq
pip install --no-index --find-links /media/staging/python-packages/ -r requirements.txt
```

## Step 2: Initialize Conduit (Air-Gap Mode)

```bash
cd /opt/qp-conduit

# No upstream DNS (fully isolated)
./conduit-setup.sh --domain=clinic.internal --upstream-dns=127.0.0.1
```

## Step 3: Register All Clinical Services

```bash
# Core platform
./conduit-register.sh --name=core --host=10.10.0.1 --port=8000
./conduit-register.sh --name=hub --host=10.10.0.1 --port=8090
./conduit-register.sh --name=postgres --host=10.10.0.1 --port=5432 --no-tls
./conduit-register.sh --name=redis --host=10.10.0.1 --port=6379 --no-tls
./conduit-register.sh --name=ollama --host=10.10.0.1 --port=11434 --health=/api/tags

# Imaging services on the workstation
./conduit-register.sh --name=pacs --host=10.10.0.5 --port=8080 --health=/health
./conduit-register.sh --name=diagnostics --host=10.10.0.5 --port=8500 --health=/healthz
```

## Step 4: HIPAA Compliance Configuration

### Encryption in Transit (164.312(e)(1))

Conduit provides TLS 1.3 on all internal routes automatically. Every registered service gets an Ed25519 certificate. Verify:

```bash
./conduit-certs.sh
# Confirm all services have valid certificates

# Verify TLS is working
curl -v https://core.clinic.internal 2>&1 | grep "SSL connection using TLSv1.3"
```

### Audit Controls (164.312(b))

Every operation writes to the structured audit log:

```bash
# View recent audit entries
tail -5 ~/.config/qp-conduit/audit.log | jq .

# Verify Capsule chain integrity
qp-capsule verify --db ~/.config/qp-conduit/capsules.db
```

### Access Accountability

Conduit logs the Unix username for every operation. Ensure each staff member uses their own system account (no shared logins).

## Step 5: Staff Onboarding

When a new staff member joins:

1. Create a system account on their workstation
2. Distribute the CA certificate to their browser:
   ```bash
   scp root@10.10.0.1:~/.config/qp-conduit/certs/root.crt /tmp/clinic-ca.crt
   # Install in browser or system trust store
   ```
3. Configure their workstation's DNS to point to the Conduit host:
   ```bash
   echo "nameserver 10.10.0.1" | sudo tee /etc/resolv.conf
   ```
4. Verify access:
   ```bash
   curl -s https://hub.clinic.internal/healthz
   ```

## Step 6: Staff Departure

When a staff member leaves:

1. Disable their system account on all machines
2. Rotate certificates for any services they had direct access to:
   ```bash
   ./conduit-certs.sh --rotate=core
   ./conduit-certs.sh --rotate=hub
   ```
3. Verify the rotation was logged:
   ```bash
   tail -5 ~/.config/qp-conduit/audit.log | jq 'select(.action == "cert_rotate")'
   ```
4. The audit trail records when the rotation occurred and who performed it

## Step 7: Quarterly Key Rotation

Every 90 days, rotate all service certificates:

```bash
# Rotate all certificates
for svc in core hub pacs diagnostics ollama; do
  ./conduit-certs.sh --rotate=$svc
done

# Regenerate Caddyfile with new certs
# (conduit-certs.sh --rotate handles this automatically)

# Verify all services are healthy after rotation
./conduit-status.sh
```

## Step 8: Audit Export for Compliance

Export the audit log for quarterly compliance reviews:

```bash
# Full audit export (JSON array)
cat ~/.config/qp-conduit/audit.log | jq -s '.' > audit-export-$(date +%Y%m%d).json

# Capsule verification report
qp-capsule verify --db ~/.config/qp-conduit/capsules.db > capsule-report-$(date +%Y%m%d).txt

# Archive for compliance records
tar czf compliance-$(date +%Y%m%d).tar.gz \
  audit-export-$(date +%Y%m%d).json \
  capsule-report-$(date +%Y%m%d).txt
```

Transfer the archive to the compliance team via approved media (USB, encrypted transfer).

## Operational Checklist

| Task | Frequency | Responsible |
|---|---|---|
| Check service health | Daily | IT Administrator |
| Review audit log for anomalies | Weekly | Security Officer |
| Verify Capsule chain integrity | Weekly | Security Officer |
| Back up config directory | Weekly | IT Administrator |
| Rotate service certificates | Every 90 days | IT Administrator |
| Export audit records for compliance | Quarterly | Compliance Officer |
| Full system backup (OS + data) | Monthly | IT Administrator |
| Review access accounts | Quarterly | HR + IT |
