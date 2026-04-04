// ── Service Registry ────────────────────────────────────────────────────────

export interface Service {
  name: string;
  host: string;
  port: number;
  protocol: "http" | "https";
  health_path: string;
  tls_enabled: boolean;
  registered_at: string;
  status: "up" | "degraded" | "down" | "unknown";
  last_check: string | null;
  response_time: number | null;
}

// ── DNS ─────────────────────────────────────────────────────────────────────

export interface DnsEntry {
  name: string;
  ip: string;
  domain: string;
  source: "conduit" | "static" | "system";
  created_at: string;
}

// ── TLS ─────────────────────────────────────────────────────────────────────

export interface TlsCert {
  name: string;
  domain: string;
  issuer: string;
  not_before: string;
  not_after: string;
  fingerprint: string;
  algorithm: string;
  status: "valid" | "expiring" | "expired" | "revoked";
}

// ── Servers ─────────────────────────────────────────────────────────────────

export interface ServerStats {
  id: string;
  name: string;
  host: string;
  cpu_percent: number;
  memory_used: number;
  memory_total: number;
  disk_used: number;
  disk_total: number;
  uptime: string;
  gpus: GpuInfo[];
  containers: ContainerInfo[];
  last_check: string;
  status: "up" | "degraded" | "down";
}

export interface GpuInfo {
  index: number;
  name: string;
  temperature: number;
  utilization: number;
  memory_used: number;
  memory_total: number;
  power_draw: number;
  power_limit: number;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: "running" | "exited" | "paused" | "restarting";
  status: string;
  cpu_percent: number;
  memory_usage: number;
  memory_limit: number;
}

// ── Routing ─────────────────────────────────────────────────────────────────

export interface Route {
  name: string;
  domain: string;
  upstream: string;
  tls: boolean;
  health_status: "up" | "degraded" | "down" | "unknown";
  response_time: number | null;
  last_checked: string | null;
}

// ── Audit ───────────────────────────────────────────────────────────────────

export interface AuditEntry {
  timestamp: string;
  action: string;
  status: "success" | "failure";
  message: string;
  user: string;
  details: Record<string, unknown>;
}

// ── Global Status ───────────────────────────────────────────────────────────

export interface ConduitStatus {
  dns: boolean;
  caddy: boolean;
  services: { up: number; degraded: number; down: number; total: number };
  certs: { valid: number; expiring: number; expired: number };
  servers: { online: number; total: number };
  last_audit: AuditEntry | null;
}
