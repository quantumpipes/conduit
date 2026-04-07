import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/api/servers", () => ({
  serversApi: { list: vi.fn() },
}));

import ServersView from "./servers-view";
import { serversApi } from "@/api/servers";
import { useAppStore } from "@/stores/app-store";
import type { ServerStats } from "@/lib/types";

const SERVER: ServerStats = {
  id: "srv-1",
  name: "gpu-node-1",
  host: "10.0.1.100",
  cpu_percent: 45,
  cpu_cores: 16,
  memory_used: 8 * 1024 ** 3,
  memory_total: 32 * 1024 ** 3,
  memory_percent: 25,
  disk_used: 100 * 1024 ** 3,
  disk_total: 500 * 1024 ** 3,
  disk_percent: 20,
  uptime: "14d 3h",
  gpus: [
    {
      index: 0,
      name: "NVIDIA H200",
      temperature: 65,
      utilization: 80,
      memory_used: 40 * 1024 ** 3,
      memory_total: 80 * 1024 ** 3,
      memory_percent: 50,
      power_draw: 350,
      power_limit: 700,
    },
  ],
  containers: [
    {
      id: "c1",
      name: "qp-core",
      image: "quantumpipes/core:latest",
      state: "running",
      status: "Up 3 days",
      cpu_percent: 12,
      memory_usage: 512 * 1024 ** 2,
      memory_limit: 2 * 1024 ** 3,
    },
  ],
  last_check: "2026-04-07T12:00:00Z",
  status: "up",
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  useAppStore.setState({ view: "servers" });
  vi.clearAllMocks();
});

describe("ServersView", () => {
  // ── States ─────────────────────────────────────────────────────────────

  it("shows rich blank slate when empty", async () => {
    vi.mocked(serversApi.list).mockResolvedValue({ servers: [] });
    render(<ServersView />, { wrapper });
    expect(await screen.findByText("No servers reporting")).toBeInTheDocument();
    expect(screen.getByText("GPU Telemetry")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    vi.mocked(serversApi.list).mockRejectedValue(new Error("fail"));
    render(<ServersView />, { wrapper });
    expect(await screen.findByText("Could not load servers")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    vi.mocked(serversApi.list).mockReturnValue(new Promise(() => {}));
    render(<ServersView />, { wrapper });
    expect(screen.getByText("Loading servers...")).toBeInTheDocument();
  });

  // ── Server card collapsed ──────────────────────────────────────────────

  it("renders server card with quick stats", async () => {
    vi.mocked(serversApi.list).mockResolvedValue({ servers: [SERVER] });
    render(<ServersView />, { wrapper });

    expect(await screen.findByText("gpu-node-1")).toBeInTheDocument();
    expect(screen.getByText("10.0.1.100")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument(); // CPU
    expect(screen.getByText("25%")).toBeInTheDocument(); // Mem
    expect(screen.getByText("20%")).toBeInTheDocument(); // Disk
  });

  // ── Server card expanded ───────────────────────────────────────────────

  it("expands server card to show resource details", async () => {
    vi.mocked(serversApi.list).mockResolvedValue({ servers: [SERVER] });
    render(<ServersView />, { wrapper });

    fireEvent.click(await screen.findByText("gpu-node-1"));

    // Resource cards appear in expanded view
    expect(screen.getByText("Uptime")).toBeInTheDocument();
    expect(screen.getByText("14d 3h")).toBeInTheDocument();
    expect(screen.getByText("16 cores")).toBeInTheDocument();
    // CPU/Memory/Disk labels exist (Memory may appear multiple times with GPU)
    expect(screen.getAllByText("CPU").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Memory").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Disk").length).toBeGreaterThanOrEqual(1);
  });

  it("shows GPU cards in expanded view", async () => {
    vi.mocked(serversApi.list).mockResolvedValue({ servers: [SERVER] });
    render(<ServersView />, { wrapper });

    fireEvent.click(await screen.findByText("gpu-node-1"));

    expect(screen.getByText("NVIDIA H200")).toBeInTheDocument();
    expect(screen.getByText("65°C")).toBeInTheDocument();
    expect(screen.getByText("350W")).toBeInTheDocument();
    expect(screen.getByText("GPUs (1)")).toBeInTheDocument();
  });

  it("shows container rows in expanded view", async () => {
    vi.mocked(serversApi.list).mockResolvedValue({ servers: [SERVER] });
    render(<ServersView />, { wrapper });

    fireEvent.click(await screen.findByText("gpu-node-1"));

    expect(screen.getByText("qp-core")).toBeInTheDocument();
    expect(screen.getByText("Containers (1)")).toBeInTheDocument();
    expect(screen.getByText("CPU 12%")).toBeInTheDocument();
  });

  it("collapses expanded card on second click", async () => {
    vi.mocked(serversApi.list).mockResolvedValue({ servers: [SERVER] });
    render(<ServersView />, { wrapper });

    // Expand
    fireEvent.click(await screen.findByText("gpu-node-1"));
    expect(screen.getByText("NVIDIA H200")).toBeInTheDocument();

    // Collapse
    fireEvent.click(screen.getByText("gpu-node-1"));
    expect(screen.queryByText("NVIDIA H200")).not.toBeInTheDocument();
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  it("handles server without GPUs", async () => {
    vi.mocked(serversApi.list).mockResolvedValue({
      servers: [{ ...SERVER, gpus: [], containers: [] }],
    });
    render(<ServersView />, { wrapper });
    fireEvent.click(await screen.findByText("gpu-node-1"));

    expect(screen.queryByText("GPUs")).not.toBeInTheDocument();
    expect(screen.queryByText("Containers")).not.toBeInTheDocument();
  });

  it("renders paused container state", async () => {
    const pausedContainer = {
      id: "c2",
      name: "paused-svc",
      image: "img:latest",
      state: "paused" as const,
      status: "Paused",
      cpu_percent: 0,
      memory_usage: 0,
      memory_limit: 0,
    };
    const exitedContainer = {
      id: "c3",
      name: "exited-svc",
      image: "img:latest",
      state: "exited" as const,
      status: "Exited (0)",
      cpu_percent: 0,
      memory_usage: 0,
      memory_limit: 0,
    };
    vi.mocked(serversApi.list).mockResolvedValue({
      servers: [{
        ...SERVER,
        containers: [pausedContainer, exitedContainer],
      }],
    });
    render(<ServersView />, { wrapper });
    fireEvent.click(await screen.findByText("gpu-node-1"));

    expect(screen.getByText("paused-svc")).toBeInTheDocument();
    expect(screen.getByText("exited-svc")).toBeInTheDocument();
    expect(document.querySelector(".bg-warning")).toBeInTheDocument();
  });

  it("renders GPU with N/A power draw", async () => {
    const gpu = {
      index: 0,
      name: "Test GPU",
      temperature: 90,
      utilization: 50,
      memory_used: 0,
      memory_total: 0,
      memory_percent: 50,
      power_draw: null as unknown as number,
      power_limit: 700,
    };
    vi.mocked(serversApi.list).mockResolvedValue({
      servers: [{ ...SERVER, gpus: [gpu] }],
    });
    render(<ServersView />, { wrapper });
    fireEvent.click(await screen.findByText("gpu-node-1"));

    expect(screen.getByText("90°C")).toBeInTheDocument();
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("shows degraded status color", async () => {
    vi.mocked(serversApi.list).mockResolvedValue({
      servers: [{ ...SERVER, status: "degraded" }],
    });
    render(<ServersView />, { wrapper });
    await screen.findByText("gpu-node-1");
    // HealthDot with degraded should render
    expect(document.querySelector(".bg-warning")).toBeInTheDocument();
  });

  it("calls refresh", async () => {
    vi.mocked(serversApi.list).mockResolvedValue({ servers: [SERVER] });
    render(<ServersView />, { wrapper });
    await screen.findByText("gpu-node-1");

    vi.mocked(serversApi.list).mockClear();
    fireEvent.click(screen.getByText("Refresh"));

    await waitFor(() => {
      expect(serversApi.list).toHaveBeenCalled();
    });
  });
});
