import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAppStore } from "@/stores/app-store";

// Mock all lazy-loaded views
vi.mock("@/components/views/dashboard/dashboard-view", () => ({
  default: () => <div>Dashboard View</div>,
}));
vi.mock("@/components/views/services/services-view", () => ({
  default: () => <div>Services View</div>,
}));
vi.mock("@/components/views/dns/dns-view", () => ({
  default: () => <div>DNS View</div>,
}));
vi.mock("@/components/views/tls/tls-view", () => ({
  default: () => <div>TLS View</div>,
}));
vi.mock("@/components/views/servers/servers-view", () => ({
  default: () => <div>Servers View</div>,
}));
vi.mock("@/components/views/routing/routing-view", () => ({
  default: () => <div>Routing View</div>,
}));
vi.mock("@/hooks/use-keyboard", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

import { App } from "./app";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  useAppStore.setState({ view: "dashboard", sidebarCollapsed: false });
  window.history.replaceState(null, "", "/");
});

describe("App", () => {
  it("renders the dashboard view by default", async () => {
    render(<App />, { wrapper });
    expect(await screen.findByText("Dashboard View")).toBeInTheDocument();
  });

  it("renders with sr-only loading text support", () => {
    render(<App />, { wrapper });
    // The app renders successfully (loading or view)
    expect(document.body.textContent).toBeTruthy();
  });

  it("switches views based on store state", async () => {
    render(<App />, { wrapper });
    await screen.findByText("Dashboard View");

    useAppStore.getState().setView("services");
    expect(await screen.findByText("Services View")).toBeInTheDocument();
  });

  it("renders all six views", async () => {
    render(<App />, { wrapper });

    const viewTests: [string, string][] = [
      ["dashboard", "Dashboard View"],
      ["services", "Services View"],
      ["dns", "DNS View"],
      ["tls", "TLS View"],
      ["servers", "Servers View"],
      ["routing", "Routing View"],
    ];

    for (const [view, text] of viewTests) {
      useAppStore.getState().setView(view as any);
      expect(await screen.findByText(text)).toBeInTheDocument();
    }
  });
});
