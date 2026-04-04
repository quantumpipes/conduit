# Home Lab with GPU Server

A researcher with two machines: a GPU server (NVIDIA RTX 4090, Ubuntu 24.04) running Ollama for local LLM inference, and a NUC (Intel N100, Ubuntu 24.04) running QP Core, PostgreSQL, Redis, and Grafana. Conduit runs on the NUC as the gateway host.

## Network Layout

```
NUC (10.0.1.1)               GPU Server (10.0.1.20)
  QP Core :8000                 Ollama :11434
  QP Hub :8090                  NVIDIA RTX 4090 (24GB VRAM)
  PostgreSQL :5432
  Redis :6379
  Grafana :3000
  QP Conduit (gateway)
    dnsmasq :53
    Caddy :443
    Dashboard :9999
```

## Prerequisites

- Ubuntu 24.04 on both machines
- NVIDIA driver installed on GPU server
- Docker installed on the NUC
- SSH key-based access from NUC to GPU server

## Step 1: Install Dependencies on the NUC

```bash
sudo apt install jq dnsmasq

# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy.list
sudo apt update && sudo apt install caddy
```

## Step 2: Initialize Conduit

```bash
cd /opt/qp-conduit
./conduit-setup.sh --domain=lab.local
```

## Step 3: Register Services

```bash
# Local services on the NUC
./conduit-register.sh --name=core --host=127.0.0.1 --port=8000
./conduit-register.sh --name=hub --host=127.0.0.1 --port=8090
./conduit-register.sh --name=grafana --host=127.0.0.1 --port=3000 --health=/api/health
./conduit-register.sh --name=postgres --host=127.0.0.1 --port=5432 --no-tls
./conduit-register.sh --name=redis --host=127.0.0.1 --port=6379 --no-tls

# Remote service on the GPU server
./conduit-register.sh --name=ollama --host=10.0.1.20 --port=11434 --health=/api/tags
```

## Step 4: Start Infrastructure

```bash
# Start dnsmasq
dnsmasq -C ~/.config/qp-conduit/dnsmasq.conf

# Start Caddy
caddy run --config ~/.config/qp-conduit/Caddyfile &

# Start the dashboard
make dev
```

## Step 5: Monitor GPU Utilization

```bash
# Check GPU stats on the remote server
./conduit-monitor.sh --server=operator@10.0.1.20
```

Output:

```
--- GPU ---
NVIDIA GeForce RTX 4090, 52, 78 %, 45 %, 18432 MiB, 24576 MiB
```

## Step 6: Trust the CA on Your Laptop

Copy the CA certificate to your laptop:

```bash
scp operator@10.0.1.1:~/.config/qp-conduit/certs/root.crt ~/Desktop/lab-ca.crt
```

Install on macOS:

```bash
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain ~/Desktop/lab-ca.crt
```

Now browse to `https://core.lab.local` and `https://grafana.lab.local` without certificate warnings.

## Step 7: Trust the CA on Your Phone (iOS)

1. AirDrop `root.crt` to your iPhone
2. Open the file, then go to Settings > General > VPN & Device Management > Install
3. Settings > General > About > Certificate Trust Settings > toggle on "QP Conduit CA"

Now access `https://grafana.lab.local` from Safari on your phone (while connected to the same Wi-Fi network).

## Step 8: Verify Everything

```bash
./conduit-status.sh
```

```
NAME             UPSTREAM             PORT     HEALTH     TLS EXPIRY   DNS
----             --------             ----     ------     ----------   ---
core             127.0.0.1            8000     healthy    Apr  4 2027  ok
hub              127.0.0.1            8090     healthy    Apr  4 2027  ok
grafana          127.0.0.1            3000     healthy    Apr  4 2027  ok
ollama           10.0.1.20            11434    healthy    Apr  4 2027  ok
postgres         127.0.0.1            5432     healthy    n/a          ok
redis            127.0.0.1            6379     healthy    n/a          ok
```

## Key Rotation Schedule

| Task | Frequency | Command |
|---|---|---|
| Rotate service certificates | Every 90 days | `./conduit-certs.sh --rotate=core` (repeat for each service) |
| Verify audit chain | Weekly | `qp-capsule verify --db ~/.config/qp-conduit/capsules.db` |
| Back up config directory | Weekly | `tar czf conduit-backup-$(date +%Y%m%d).tar.gz ~/.config/qp-conduit/` |
| Check GPU temperature trends | Daily | `./conduit-monitor.sh --server=operator@10.0.1.20` |
