import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/api/dns", () => ({
  dnsApi: { list: vi.fn(), resolve: vi.fn(), flush: vi.fn() },
}));
vi.mock("@/components/shared/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import DnsView from "./dns-view";
import { dnsApi } from "@/api/dns";
import { useAppStore } from "@/stores/app-store";
import type { DnsEntry } from "@/lib/types";

const ENTRY: DnsEntry = {
  name: "grafana",
  ip: "10.0.1.50",
  domain: "grafana.internal",
  source: "conduit",
  created_at: "2026-04-07T12:00:00Z",
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  useAppStore.setState({ view: "dns" });
  vi.clearAllMocks();
});

describe("DnsView", () => {
  // ── States ─────────────────────────────────────────────────────────────

  it("shows rich blank slate when empty", async () => {
    vi.mocked(dnsApi.list).mockResolvedValue({ entries: [] });
    render(<DnsView />, { wrapper });
    expect(await screen.findByText("No DNS entries")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    vi.mocked(dnsApi.list).mockRejectedValue(new Error("fail"));
    render(<DnsView />, { wrapper });
    expect(await screen.findByText("Could not load DNS entries")).toBeInTheDocument();
  });

  // ── Entry list ─────────────────────────────────────────────────────────

  it("renders DNS entries with domain and IP", async () => {
    vi.mocked(dnsApi.list).mockResolvedValue({
      entries: [ENTRY, { ...ENTRY, name: "prom", domain: "prom.internal", source: "static", ip: "10.0.1.51" }],
    });
    render(<DnsView />, { wrapper });

    expect(await screen.findByText("grafana.internal")).toBeInTheDocument();
    expect(screen.getByText("10.0.1.50")).toBeInTheDocument();
    expect(screen.getByText("prom.internal")).toBeInTheDocument();
  });

  it("renders source badges", async () => {
    vi.mocked(dnsApi.list).mockResolvedValue({
      entries: [
        ENTRY,
        { ...ENTRY, name: "s", domain: "s.internal", source: "static" },
        { ...ENTRY, name: "y", domain: "y.internal", source: "system" },
      ],
    });
    render(<DnsView />, { wrapper });

    await screen.findByText("grafana.internal");
    expect(screen.getByText("conduit")).toBeInTheDocument();
    expect(screen.getByText("static")).toBeInTheDocument();
    expect(screen.getByText("system")).toBeInTheDocument();
  });

  it("shows correct stats", async () => {
    vi.mocked(dnsApi.list).mockResolvedValue({
      entries: [ENTRY, { ...ENTRY, name: "s", domain: "s.internal", source: "static" }],
    });
    render(<DnsView />, { wrapper });
    await screen.findByText("grafana.internal");

    // Stats: Total=2, Conduit=1, Static=1, System=0
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("Conduit")).toBeInTheDocument();
  });

  // ── Resolve tester ─────────────────────────────────────────────────────

  it("resolves a domain", async () => {
    vi.mocked(dnsApi.list).mockResolvedValue({ entries: [ENTRY] });
    vi.mocked(dnsApi.resolve).mockResolvedValue({ domain: "grafana.internal", ip: "10.0.1.50", source: "conduit" });
    render(<DnsView />, { wrapper });

    await screen.findByText("grafana.internal");

    const input = screen.getByPlaceholderText("e.g. qp-core.qp.local");
    fireEvent.change(input, { target: { value: "grafana.internal" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(dnsApi.resolve).toHaveBeenCalledWith("grafana.internal");
    });
  });

  it("shows resolve error", async () => {
    vi.mocked(dnsApi.list).mockResolvedValue({ entries: [ENTRY] });
    vi.mocked(dnsApi.resolve).mockRejectedValue(new Error("NXDOMAIN"));
    render(<DnsView />, { wrapper });
    await screen.findByText("grafana.internal");

    const input = screen.getByPlaceholderText("e.g. qp-core.qp.local");
    fireEvent.change(input, { target: { value: "bad.local" } });
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByText(/Error: NXDOMAIN/)).toBeInTheDocument();
  });

  it("does not resolve empty query", async () => {
    vi.mocked(dnsApi.list).mockResolvedValue({ entries: [] });
    render(<DnsView />, { wrapper });
    await screen.findByText("No DNS entries");

    fireEvent.submit(screen.getByPlaceholderText("e.g. qp-core.qp.local").closest("form")!);
    expect(dnsApi.resolve).not.toHaveBeenCalled();
  });

  it("renders entry without created_at", async () => {
    vi.mocked(dnsApi.list).mockResolvedValue({
      entries: [{ ...ENTRY, created_at: "" }],
    });
    render(<DnsView />, { wrapper });
    await screen.findByText("grafana.internal");
  });

  it("shows flush error", async () => {
    vi.mocked(dnsApi.list).mockResolvedValue({ entries: [ENTRY] });
    vi.mocked(dnsApi.flush).mockRejectedValue(new Error("flush failed"));
    render(<DnsView />, { wrapper });
    await screen.findByText("grafana.internal");

    fireEvent.click(screen.getByText("Flush Cache"));
    await waitFor(() => {
      expect(dnsApi.flush).toHaveBeenCalled();
    });
  });

  it("shows resolve success result", async () => {
    vi.mocked(dnsApi.list).mockResolvedValue({ entries: [ENTRY] });
    vi.mocked(dnsApi.resolve).mockResolvedValue({ domain: "grafana.internal", ip: "10.0.1.50", source: "conduit" });
    render(<DnsView />, { wrapper });
    await screen.findByText("grafana.internal");

    const input = screen.getByPlaceholderText("e.g. qp-core.qp.local");
    fireEvent.change(input, { target: { value: "grafana.internal" } });
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByText("10.0.1.50", {}, { timeout: 2000 })).toBeInTheDocument();
  });

  // ── Flush ──────────────────────────────────────────────────────────────

  it("calls flush cache", async () => {
    vi.mocked(dnsApi.list).mockResolvedValue({ entries: [ENTRY] });
    vi.mocked(dnsApi.flush).mockResolvedValue({ ok: true, message: "flushed" });
    render(<DnsView />, { wrapper });
    await screen.findByText("grafana.internal");

    fireEvent.click(screen.getByText("Flush Cache"));
    await waitFor(() => {
      expect(dnsApi.flush).toHaveBeenCalled();
    });
  });
});
