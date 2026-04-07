---
title: "QP Conduit Network Configuration Guide"
description: "Network configuration guide for QP Conduit covering DNS setup, TLS trust distribution, firewall rules, LAN access, and integration with existing infrastructure."
date_modified: "2026-04-04"
ai_context: |
  Network guide for QP Conduit. dnsmasq installation and configuration on
  macOS and Linux, DNS resolution flow, upstream DNS, custom zones, TLS
  trust distribution (macOS Keychain, Linux update-ca-certificates, Windows
  certutil, iOS profiles, Android), firewall rules, LAN access, and
  troubleshooting DNS resolution.
related:
  - ./guide.md
  - ./deployment.md
  - ./crypto-notice.md
  - ./architecture.md
---

# Network Configuration Guide

## DNS Setup

### Installing dnsmasq

**macOS:**

```bash
brew install dnsmasq

# Start dnsmasq as a service
sudo brew services start dnsmasq
```

**Ubuntu/Debian:**

```bash
sudo apt install dnsmasq

# Disable systemd-resolved (conflicts with dnsmasq on port 53)
sudo systemctl disable --now systemd-resolved
sudo rm /etc/resolv.conf
echo "nameserver 127.0.0.1" | sudo tee /etc/resolv.conf
```

**RHEL/Fedora:**

```bash
sudo dnf install dnsmasq
sudo systemctl enable --now dnsmasq
```

### Conduit DNS Configuration

`conduit-setup.sh` generates the dnsmasq configuration automatically. The generated config at `~/.config/qp-conduit/dnsmasq.conf` contains:

```
listen-address=127.0.0.1
port=53
server=1.1.1.1
addn-hosts=/home/operator/.config/qp-conduit/conduit-hosts
log-queries
log-facility=/home/operator/.config/qp-conduit/dnsmasq.log
bogus-priv
no-resolv
```

Key settings:

| Directive | Purpose |
|---|---|
| `listen-address=127.0.0.1` | Listen only on localhost (security) |
| `port=53` | Standard DNS port |
| `server=1.1.1.1` | Upstream DNS for non-Conduit domains |
| `addn-hosts=...` | Conduit-managed hosts file |
| `bogus-priv` | Reject private addresses from upstream |
| `no-resolv` | Ignore `/etc/resolv.conf` (use only configured servers) |

Start dnsmasq with the Conduit config:

```bash
dnsmasq -C ~/.config/qp-conduit/dnsmasq.conf
```

## DNS Resolution Flow

```
Client query: core.qp.local
         |
         v
    ┌──────────┐
    │ dnsmasq  │
    │ :53      │
    └────┬─────┘
         |
    Is it in conduit-hosts?
         |
    ┌────┴────┐
    |         |
   YES        NO
    |         |
    v         v
  Return    Forward to
  local IP  upstream DNS
  (e.g.,    (1.1.1.1)
  127.0.0.1)
```

In air-gapped mode, there is no upstream forwarding. Non-Conduit queries return NXDOMAIN.

## Configuring Upstream DNS

By default, Conduit forwards non-internal queries to `1.1.1.1` (Cloudflare). Change this with:

```bash
# At setup time
./conduit-setup.sh --upstream-dns=8.8.8.8

# Or in .env.conduit
CONDUIT_UPSTREAM_DNS=10.0.1.1
```

For air-gapped deployments, set the upstream to localhost to prevent any forwarding:

```bash
CONDUIT_UPSTREAM_DNS=127.0.0.1
```

## Adding Custom DNS Zones

Conduit manages DNS entries through service registration. To add entries outside the service registry, edit the hosts file directly:

```bash
# Add a custom entry
echo "10.0.1.100 printer.qp.local" >> ~/.config/qp-conduit/conduit-hosts

# Reload dnsmasq
./conduit-dns.sh --flush
```

For complex DNS setups (multiple zones, conditional forwarding), edit the dnsmasq config:

```bash
# ~/.config/qp-conduit/dnsmasq.conf (append)
# Forward .corp.example.com to corporate DNS
server=/corp.example.com/10.0.0.1
```

Reload dnsmasq after changes: `./conduit-dns.sh --flush`

## Pointing Clients at Conduit DNS

For clients to resolve Conduit-managed names, configure them to use the Conduit host as their DNS server.

**macOS:**

```bash
# Set DNS for a specific network interface
sudo networksetup -setdnsservers "Wi-Fi" 10.0.1.1

# Or in /etc/resolver/ for specific domains only
sudo mkdir -p /etc/resolver
echo "nameserver 10.0.1.1" | sudo tee /etc/resolver/qp.local
```

**Linux:**

```bash
# /etc/resolv.conf
nameserver 10.0.1.1
```

**Windows:**

```powershell
# PowerShell (administrator)
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses ("10.0.1.1")
```

**DHCP:** Configure your DHCP server to distribute the Conduit host's IP as the DNS server for all clients on the network.

---

## TLS Trust Distribution

After `conduit-setup.sh` creates the internal CA, distribute the CA certificate to all clients that need to trust Conduit services.

### Locate the CA Certificate

```bash
# Default path
ls ~/.config/qp-conduit/certs/root.crt

# Copy it somewhere accessible
cp ~/.config/qp-conduit/certs/root.crt /tmp/qp-conduit-ca.crt
```

### macOS

```bash
# Automated (via conduit-certs.sh)
./conduit-certs.sh --trust

# Manual
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain /tmp/qp-conduit-ca.crt
```

After installing, Safari, Chrome, and curl trust all Conduit-issued certificates. Firefox uses its own trust store; import the CA via Preferences > Certificates > Import.

### Linux (Debian/Ubuntu)

```bash
sudo cp /tmp/qp-conduit-ca.crt /usr/local/share/ca-certificates/qp-conduit-ca.crt
sudo update-ca-certificates
```

### Linux (RHEL/Fedora)

```bash
sudo cp /tmp/qp-conduit-ca.crt /etc/pki/ca-trust/source/anchors/qp-conduit-ca.crt
sudo update-ca-trust
```

### Windows

```powershell
# PowerShell (administrator)
certutil -addstore "Root" C:\path\to\qp-conduit-ca.crt
```

Or use Group Policy to distribute the CA certificate across an Active Directory domain.

### iOS

1. Transfer `root.crt` to the device (AirDrop, email, or web server)
2. Open the file and install the profile in Settings > General > VPN & Device Management
3. Enable full trust: Settings > General > About > Certificate Trust Settings > toggle on

### Android

1. Transfer `root.crt` to the device
2. Settings > Security > Encryption & credentials > Install a certificate > CA certificate
3. Select the file and confirm

### Docker Containers

Mount the CA certificate at build time or runtime:

```dockerfile
# In Dockerfile
COPY qp-conduit-ca.crt /usr/local/share/ca-certificates/
RUN update-ca-certificates
```

```yaml
# In docker-compose.yml
volumes:
  - ~/.config/qp-conduit/certs/root.crt:/usr/local/share/ca-certificates/qp-conduit-ca.crt:ro
```

---

## Firewall Rules

### Ports Used by Conduit

| Port | Protocol | Service | Direction |
|---|---|---|---|
| 53 | UDP/TCP | dnsmasq (DNS) | Inbound from LAN clients |
| 443 | TCP | Caddy (HTTPS proxy) | Inbound from LAN clients |
| 2019 | TCP | Caddy (admin API) | Localhost only |
| 9999 | TCP | Conduit dashboard | Inbound (optional, localhost for security) |

### Linux (nftables)

```bash
sudo nft add rule inet filter input tcp dport 443 accept
sudo nft add rule inet filter input udp dport 53 accept
sudo nft add rule inet filter input tcp dport 53 accept
# Restrict dashboard to localhost
sudo nft add rule inet filter input tcp dport 9999 ip saddr 127.0.0.1 accept
```

### Linux (iptables)

```bash
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 53 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 53 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 9999 -s 127.0.0.1 -j ACCEPT
```

### macOS

macOS does not require explicit firewall rules for services listening on standard ports. If the application firewall is enabled, allow Caddy and dnsmasq when prompted.

---

## LAN Access Configuration

By default, dnsmasq listens on `127.0.0.1` only. To serve DNS to other machines on the LAN:

1. Change the listen address in `.env.conduit`:
   ```bash
   CONDUIT_DNS_PORT=53
   ```

2. Edit the generated dnsmasq config to listen on the LAN interface:
   ```
   listen-address=127.0.0.1,10.0.1.1
   ```

3. Restart dnsmasq:
   ```bash
   ./conduit-dns.sh --flush
   ```

4. Open port 53 in the firewall (see above)

For Caddy (HTTPS proxy), it listens on all interfaces by default. Restrict to specific interfaces by binding in the Caddyfile or using firewall rules.

---

## Integration with Existing DNS Infrastructure

If you already have a DNS server (Active Directory, BIND, Unbound), configure conditional forwarding to delegate Conduit's domain:

### BIND

```
zone "qp.local" {
    type forward;
    forwarders { 10.0.1.1; };
};
```

### Unbound

```
forward-zone:
    name: "qp.local."
    forward-addr: 10.0.1.1
```

### Active Directory DNS

Add a conditional forwarder for `qp.local` pointing to the Conduit host IP.

### /etc/resolver (macOS)

```bash
sudo mkdir -p /etc/resolver
echo "nameserver 10.0.1.1" | sudo tee /etc/resolver/qp.local
```

This approach forwards only `*.qp.local` queries to Conduit. All other queries use the default DNS server.

---

## Troubleshooting DNS Resolution

### Check dnsmasq Is Running

```bash
pgrep dnsmasq
# Should return a PID
```

### Test Resolution Directly

```bash
# Using Conduit
./conduit-dns.sh --resolve=core

# Using host command
host core.qp.local 127.0.0.1

# Using dig
dig +short core.qp.local @127.0.0.1

# Using nslookup
nslookup core.qp.local 127.0.0.1
```

### Check the Hosts File

```bash
cat ~/.config/qp-conduit/conduit-hosts
# Should show: 127.0.0.1 core.qp.local
```

### Check dnsmasq Logs

```bash
tail -f ~/.config/qp-conduit/dnsmasq.log
```

### Common Issues

| Symptom | Cause | Fix |
|---|---|---|
| Resolution fails for all names | dnsmasq not running | Start dnsmasq with Conduit config |
| Resolution fails for new service | DNS cache stale | Run `./conduit-dns.sh --flush` |
| Resolution works locally, fails from LAN | dnsmasq listens on 127.0.0.1 only | Change listen address to include LAN IP |
| `systemd-resolved` conflict | Port 53 already in use | Disable systemd-resolved |
| Wrong IP returned | Stale entry in hosts file | Deregister and re-register the service |

---

## Related Documentation

- [Guide](./guide.md): Getting started walkthrough
- [Deployment](./deployment.md): Docker and production deployment
- [Architecture](./architecture.md): DNS and TLS subsystem design
- [Crypto Notice](./crypto-notice.md): Cryptographic analysis
