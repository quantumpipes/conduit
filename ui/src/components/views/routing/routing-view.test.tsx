import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/api/routing", () => ({
  routingApi: { list: vi.fn(), reload: vi.fn() },
}));
vi.mock("@/components/shared/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import RoutingView from "./routing-view";
import { routingApi } from "@/api/routing";
import { useAppStore } from "@/stores/app-store";
import type { Route } from "@/lib/types";

const ROUTE: Route = {
  name: "grafana",
  domain: "grafana.internal",
  upstream: "10.0.1.50:3000",
  tls: true,
  health_status: "up",
  response_time: 12,
  last_checked: "2026-04-07T12:00:00Z",
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  useAppStore.setState({ view: "routing" });
  vi.clearAllMocks();
});

describe("RoutingView", () => {
  // ── States ─────────────────────────────────────────────────────────────

  it("shows rich blank slate when empty", async () => {
    vi.mocked(routingApi.list).mockResolvedValue({ routes: [] });
    render(<RoutingView />, { wrapper });
    expect(await screen.findByText("No routes configured")).toBeInTheDocument();
    expect(screen.getByText("Hot Reload")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    vi.mocked(routingApi.list).mockRejectedValue(new Error("fail"));
    render(<RoutingView />, { wrapper });
    expect(await screen.findByText("Could not load routes")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    vi.mocked(routingApi.list).mockReturnValue(new Promise(() => {}));
    render(<RoutingView />, { wrapper });
    expect(screen.getByText("Loading routes...")).toBeInTheDocument();
  });

  // ── Stats ──────────────────────────────────────────────────────────────

  it("shows correct stats", async () => {
    vi.mocked(routingApi.list).mockResolvedValue({
      routes: [
        ROUTE,
        { ...ROUTE, name: "prom", domain: "prom.internal", health_status: "degraded" },
        { ...ROUTE, name: "dead", domain: "dead.internal", health_status: "down" },
      ],
    });
    render(<RoutingView />, { wrapper });

    await screen.findByText("grafana.internal");
    expect(screen.getByText("Routes")).toBeInTheDocument();
    expect(screen.getByText("Up")).toBeInTheDocument();
    expect(screen.getByText("Degraded")).toBeInTheDocument();
    expect(screen.getByText("Down")).toBeInTheDocument();
  });

  // ── Route cards ────────────────────────────────────────────────────────

  it("renders route card with details", async () => {
    vi.mocked(routingApi.list).mockResolvedValue({ routes: [ROUTE] });
    render(<RoutingView />, { wrapper });

    expect(await screen.findByText("grafana.internal")).toBeInTheDocument();
    expect(screen.getByText("10.0.1.50:3000")).toBeInTheDocument();
    expect(screen.getByText("12ms")).toBeInTheDocument();
    expect(screen.getByText("TLS")).toBeInTheDocument();
  });

  it("shows Plain badge for non-TLS route", async () => {
    vi.mocked(routingApi.list).mockResolvedValue({
      routes: [{ ...ROUTE, tls: false }],
    });
    render(<RoutingView />, { wrapper });
    expect(await screen.findByText("Plain")).toBeInTheDocument();
  });

  it("handles route without response time", async () => {
    vi.mocked(routingApi.list).mockResolvedValue({
      routes: [{ ...ROUTE, response_time: null, last_checked: null }],
    });
    render(<RoutingView />, { wrapper });
    await screen.findByText("grafana.internal");
    expect(screen.queryByText(/ms$/)).not.toBeInTheDocument();
  });

  it("handles route with unknown health_status", async () => {
    vi.mocked(routingApi.list).mockResolvedValue({
      routes: [{ ...ROUTE, health_status: "unknown" }],
    });
    render(<RoutingView />, { wrapper });
    await screen.findByText("grafana.internal");
    // unknown status renders as "down" in stats
  });

  // ── Reload ─────────────────────────────────────────────────────────────

  it("calls reload Caddy", async () => {
    vi.mocked(routingApi.list).mockResolvedValue({ routes: [ROUTE] });
    vi.mocked(routingApi.reload).mockResolvedValue({ ok: true, message: "reloaded" });
    render(<RoutingView />, { wrapper });
    await screen.findByText("grafana.internal");

    fireEvent.click(screen.getByText("Reload Caddy"));

    await waitFor(() => {
      expect(routingApi.reload).toHaveBeenCalled();
    });
  });

  it("handles reload error", async () => {
    vi.mocked(routingApi.list).mockResolvedValue({ routes: [ROUTE] });
    vi.mocked(routingApi.reload).mockRejectedValue(new Error("Caddy unreachable"));
    render(<RoutingView />, { wrapper });
    await screen.findByText("grafana.internal");

    fireEvent.click(screen.getByText("Reload Caddy"));
    await waitFor(() => {
      expect(routingApi.reload).toHaveBeenCalled();
    });
  });
});
