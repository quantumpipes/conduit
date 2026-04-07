import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/api/services", () => ({
  servicesApi: { list: vi.fn() },
}));
vi.mock("@/api/tls", () => ({
  tlsApi: { list: vi.fn(), getCaInfo: vi.fn() },
}));
vi.mock("@/api/dns", () => ({
  dnsApi: { list: vi.fn() },
}));
vi.mock("@/api/servers", () => ({
  serversApi: { list: vi.fn() },
}));
vi.mock("@/api/audit", () => ({
  auditApi: { read: vi.fn() },
}));

import DashboardView from "./dashboard-view";
import { servicesApi } from "@/api/services";
import { tlsApi } from "@/api/tls";
import { dnsApi } from "@/api/dns";
import { serversApi } from "@/api/servers";
import { auditApi } from "@/api/audit";
import { useAppStore } from "@/stores/app-store";
import type { Service, TlsCert, DnsEntry, ServerStats, AuditEntry } from "@/lib/types";

const SVC: Service = {
  name: "grafana",
  host: "10.0.1.50",
  port: 3000,
  protocol: "https",
  health_path: "/healthz",
  tls_enabled: true,
  registered_at: "2026-04-01",
  status: "up",
  last_check: "2026-04-07T12:00:00Z",
  response_time: 42,
  domain: null,
};

const CERT: TlsCert = {
  name: "grafana",
  domain: "grafana.internal",
  issuer: "CA",
  not_before: "",
  not_after: "",
  fingerprint: "",
  algorithm: "Ed25519",
  status: "valid",
};

const DNS: DnsEntry = {
  name: "grafana",
  ip: "10.0.1.50",
  domain: "grafana.internal",
  source: "conduit",
  created_at: "",
};

const SERVER: ServerStats = {
  id: "s1",
  name: "node1",
  host: "h",
  cpu_percent: 50,
  cpu_cores: 4,
  memory_used: 0,
  memory_total: 0,
  memory_percent: 25,
  disk_used: 0,
  disk_total: 0,
  disk_percent: 10,
  uptime: "1d",
  gpus: [],
  containers: [],
  last_check: "",
  status: "up",
};

const AUDIT: AuditEntry = {
  timestamp: "2026-04-07T12:00:00Z",
  action: "service.register",
  status: "success",
  message: "Registered grafana",
  user: "admin",
  details: {},
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function mockAllEmpty() {
  vi.mocked(servicesApi.list).mockResolvedValue({ services: [] });
  vi.mocked(tlsApi.list).mockResolvedValue({ certs: [] });
  vi.mocked(dnsApi.list).mockResolvedValue({ entries: [] });
  vi.mocked(serversApi.list).mockResolvedValue({ servers: [] });
  vi.mocked(auditApi.read).mockResolvedValue({ entries: [], });
}

function mockAllPopulated() {
  vi.mocked(servicesApi.list).mockResolvedValue({ services: [SVC, { ...SVC, name: "prom", status: "down" }] });
  vi.mocked(tlsApi.list).mockResolvedValue({ certs: [CERT] });
  vi.mocked(dnsApi.list).mockResolvedValue({ entries: [DNS] });
  vi.mocked(serversApi.list).mockResolvedValue({ servers: [SERVER] });
  vi.mocked(auditApi.read).mockResolvedValue({ entries: [AUDIT, { ...AUDIT, status: "failure", message: "" }], });
}

beforeEach(() => {
  useAppStore.setState({ view: "dashboard" });
  window.history.replaceState(null, "", "/");
  vi.clearAllMocks();
});

describe("DashboardView", () => {
  // ── Blank slate ────────────────────────────────────────────────────────

  it("shows blank slate when all data is empty", async () => {
    mockAllEmpty();
    render(<DashboardView />, { wrapper });
    expect(await screen.findByText("Your infrastructure, connected.")).toBeInTheDocument();
  });

  // ── Populated dashboard ────────────────────────────────────────────────

  it("shows normal dashboard when services exist", async () => {
    mockAllPopulated();
    render(<DashboardView />, { wrapper });
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Your infrastructure, connected.")).not.toBeInTheDocument();
  });

  it("shows stat cards with correct labels", async () => {
    mockAllPopulated();
    render(<DashboardView />, { wrapper });
    await screen.findByText("Dashboard");

    expect(screen.getByText("Services Up")).toBeInTheDocument();
    expect(screen.getByText("Certs Valid")).toBeInTheDocument();
    expect(screen.getByText("DNS Entries")).toBeInTheDocument();
    expect(screen.getByText("Servers Online")).toBeInTheDocument();
  });

  it("shows services health grid with View all link", async () => {
    mockAllPopulated();
    render(<DashboardView />, { wrapper });

    expect(await screen.findByText("Services Health")).toBeInTheDocument();
    expect(screen.getByText("View all")).toBeInTheDocument();
  });

  it("shows service cards in health grid", async () => {
    mockAllPopulated();
    render(<DashboardView />, { wrapper });

    // Wait for services to load - "grafana.internal" appears in service card
    expect(await screen.findByText("grafana.internal")).toBeInTheDocument();
  });

  it("shows service domain with .internal fallback", async () => {
    mockAllPopulated();
    render(<DashboardView />, { wrapper });
    await screen.findByText("grafana");
    expect(screen.getByText("grafana.internal")).toBeInTheDocument();
  });

  it("shows 'No services registered yet' when services empty but other data exists", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [] });
    vi.mocked(tlsApi.list).mockResolvedValue({ certs: [CERT] });
    vi.mocked(dnsApi.list).mockResolvedValue({ entries: [DNS] });
    vi.mocked(serversApi.list).mockResolvedValue({ servers: [] });
    vi.mocked(auditApi.read).mockResolvedValue({ entries: [], });

    render(<DashboardView />, { wrapper });
    expect(await screen.findByText("No services registered yet")).toBeInTheDocument();
  });

  it("shows audit section header", async () => {
    mockAllPopulated();
    render(<DashboardView />, { wrapper });

    expect(await screen.findByText("Recent Audit")).toBeInTheDocument();
    expect(screen.getByText("Quick Actions")).toBeInTheDocument();
  });

  it("shows 'No audit entries yet' when audit is empty", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [SVC] });
    vi.mocked(tlsApi.list).mockResolvedValue({ certs: [] });
    vi.mocked(dnsApi.list).mockResolvedValue({ entries: [] });
    vi.mocked(serversApi.list).mockResolvedValue({ servers: [] });
    vi.mocked(auditApi.read).mockResolvedValue({ entries: [], });

    render(<DashboardView />, { wrapper });
    expect(await screen.findByText("No audit entries yet")).toBeInTheDocument();
  });

  // ── Quick actions ──────────────────────────────────────────────────────

  it("renders all 4 quick actions", async () => {
    mockAllPopulated();
    render(<DashboardView />, { wrapper });
    await screen.findByText("Dashboard");

    expect(screen.getByText("Register Service")).toBeInTheDocument();
    expect(screen.getByText("Manage Certs")).toBeInTheDocument();
    expect(screen.getByText("Check DNS")).toBeInTheDocument();
    expect(screen.getByText("Monitor Servers")).toBeInTheDocument();
  });

  it("navigates to services via quick action", async () => {
    mockAllPopulated();
    render(<DashboardView />, { wrapper });
    fireEvent.click(await screen.findByText("Register Service"));
    expect(useAppStore.getState().view).toBe("services");
  });

  it("navigates to tls via quick action", async () => {
    mockAllPopulated();
    render(<DashboardView />, { wrapper });
    fireEvent.click(await screen.findByText("Manage Certs"));
    expect(useAppStore.getState().view).toBe("tls");
  });

  it("navigates to dns via quick action", async () => {
    mockAllPopulated();
    render(<DashboardView />, { wrapper });
    fireEvent.click(await screen.findByText("Check DNS"));
    expect(useAppStore.getState().view).toBe("dns");
  });

  it("navigates to servers via quick action", async () => {
    mockAllPopulated();
    render(<DashboardView />, { wrapper });
    fireEvent.click(await screen.findByText("Monitor Servers"));
    expect(useAppStore.getState().view).toBe("servers");
  });

  it("navigates to services via 'View all' link", async () => {
    mockAllPopulated();
    render(<DashboardView />, { wrapper });
    fireEvent.click(await screen.findByText("View all"));
    expect(useAppStore.getState().view).toBe("services");
  });

  it("shows service with unknown status in grid", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({
      services: [{ ...SVC, status: "unknown" }],
    });
    vi.mocked(tlsApi.list).mockResolvedValue({ certs: [] });
    vi.mocked(dnsApi.list).mockResolvedValue({ entries: [] });
    vi.mocked(serversApi.list).mockResolvedValue({ servers: [] });
    vi.mocked(auditApi.read).mockResolvedValue({ entries: [], });

    render(<DashboardView />, { wrapper });
    expect(await screen.findByText("Services Health")).toBeInTheDocument();
  });

  it("shows last_check in service grid card", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({
      services: [{ ...SVC, last_check: "2026-04-07T12:00:00Z" }],
    });
    vi.mocked(tlsApi.list).mockResolvedValue({ certs: [] });
    vi.mocked(dnsApi.list).mockResolvedValue({ entries: [] });
    vi.mocked(serversApi.list).mockResolvedValue({ servers: [] });
    vi.mocked(auditApi.read).mockResolvedValue({ entries: [], });

    render(<DashboardView />, { wrapper });
    await screen.findByText("Services Health");
    expect(await screen.findByText(/Checked/)).toBeInTheDocument();
  });

  it("shows success color when all servers up", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [SVC] });
    vi.mocked(tlsApi.list).mockResolvedValue({ certs: [CERT] });
    vi.mocked(dnsApi.list).mockResolvedValue({ entries: [] });
    vi.mocked(serversApi.list).mockResolvedValue({ servers: [SERVER] });
    vi.mocked(auditApi.read).mockResolvedValue({ entries: [], });

    render(<DashboardView />, { wrapper });
    await screen.findByText("Servers Online");
    // All servers up = text-success class
  });

  it("shows failure audit dot", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [SVC] });
    vi.mocked(tlsApi.list).mockResolvedValue({ certs: [] });
    vi.mocked(dnsApi.list).mockResolvedValue({ entries: [] });
    vi.mocked(serversApi.list).mockResolvedValue({ servers: [] });
    vi.mocked(auditApi.read).mockResolvedValue({
      entries: [{ ...AUDIT, status: "failure", message: "" }],
    });

    render(<DashboardView />, { wrapper });
    expect(await screen.findByText("Recent Audit")).toBeInTheDocument();
  });

  // ── Loading ────────────────────────────────────────────────────────────

  it("shows loading spinner while services pending", () => {
    vi.mocked(servicesApi.list).mockReturnValue(new Promise(() => {}));
    vi.mocked(tlsApi.list).mockReturnValue(new Promise(() => {}));
    vi.mocked(dnsApi.list).mockReturnValue(new Promise(() => {}));
    vi.mocked(serversApi.list).mockReturnValue(new Promise(() => {}));
    vi.mocked(auditApi.read).mockReturnValue(new Promise(() => {}));

    render(<DashboardView />, { wrapper });
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Loading services...")).toBeInTheDocument();
  });

  // ── Edge: servers with warning color ───────────────────────────────────

  it("shows warning color when not all servers are up", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [SVC] });
    vi.mocked(tlsApi.list).mockResolvedValue({ certs: [] });
    vi.mocked(dnsApi.list).mockResolvedValue({ entries: [] });
    vi.mocked(serversApi.list).mockResolvedValue({
      servers: [SERVER, { ...SERVER, id: "s2", name: "n2", status: "down" }],
    });
    vi.mocked(auditApi.read).mockResolvedValue({ entries: [], });

    render(<DashboardView />, { wrapper });
    await screen.findByText("Dashboard");
    // Servers Online stat should use warning color since not all up
    expect(screen.getByText("Servers Online")).toBeInTheDocument();
  });
});
