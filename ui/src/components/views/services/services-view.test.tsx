import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/api/services", () => ({
  servicesApi: {
    list: vi.fn(),
    register: vi.fn(),
    deregister: vi.fn(),
    health: vi.fn(),
  },
}));

vi.mock("@/components/shared/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import ServicesView from "./services-view";
import { servicesApi } from "@/api/services";
import { useAppStore } from "@/stores/app-store";
import type { Service } from "@/lib/types";

const SVC: Service = {
  name: "grafana",
  host: "10.0.1.50",
  port: 3000,
  protocol: "https",
  health_path: "/healthz",
  tls_enabled: true,
  registered_at: "2026-04-01T00:00:00Z",
  status: "up",
  last_check: "2026-04-07T12:00:00Z",
  response_time: 42,
  domain: null,
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  useAppStore.setState({ view: "services" });
  vi.clearAllMocks();
});

describe("ServicesView", () => {
  it("shows rich blank slate when empty", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [] });
    render(<ServicesView />, { wrapper });
    expect(await screen.findByText("No services registered")).toBeInTheDocument();
    expect(screen.getByText("Auto-Discovery")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    vi.mocked(servicesApi.list).mockReturnValue(new Promise(() => {}));
    render(<ServicesView />, { wrapper });
    expect(screen.getByText("Loading services...")).toBeInTheDocument();
  });

  it("shows error state with message", async () => {
    vi.mocked(servicesApi.list).mockRejectedValue(new Error("Network error"));
    render(<ServicesView />, { wrapper });
    expect(await screen.findByText("Could not load services")).toBeInTheDocument();
    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  it("shows retry button on error", async () => {
    vi.mocked(servicesApi.list).mockRejectedValue(new Error("fail"));
    render(<ServicesView />, { wrapper });
    expect(await screen.findByText("Retry")).toBeInTheDocument();
  });

  it("renders service cards with details", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [SVC] });
    render(<ServicesView />, { wrapper });

    expect(await screen.findByText("grafana")).toBeInTheDocument();
    expect(screen.getByText("1 service registered")).toBeInTheDocument();
    expect(screen.getByText(/10\.0\.1\.50/)).toBeInTheDocument();
    expect(screen.getByText("/healthz")).toBeInTheDocument();
    expect(screen.getByText("42ms")).toBeInTheDocument();
  });

  it("shows TLS badge for TLS-enabled service", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [SVC] });
    render(<ServicesView />, { wrapper });
    await screen.findByText("grafana");
    expect(screen.getByText("TLS")).toBeInTheDocument();
  });

  it("shows Plain badge for non-TLS service", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({
      services: [{ ...SVC, tls_enabled: false }],
    });
    render(<ServicesView />, { wrapper });
    expect(await screen.findByText("Plain")).toBeInTheDocument();
  });

  it("pluralizes correctly for multiple services", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({
      services: [SVC, { ...SVC, name: "prometheus" }],
    });
    render(<ServicesView />, { wrapper });
    expect(await screen.findByText("2 services registered")).toBeInTheDocument();
  });

  it("opens register form via Register Service button", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [SVC] });
    render(<ServicesView />, { wrapper });
    await screen.findByText("grafana");

    // The button has icon + text, find by role
    const registerBtn = screen.getAllByRole("button").find(
      (b) => b.textContent?.includes("Register Service"),
    )!;
    fireEvent.click(registerBtn);
    // SlideOver should open with form fields
    expect(screen.getByText("Service Name")).toBeInTheDocument();
  });

  it("calls health check mutation", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [SVC] });
    vi.mocked(servicesApi.health).mockResolvedValue({ ok: true, status: "up", response_time: 10 });
    render(<ServicesView />, { wrapper });
    await screen.findByText("grafana");

    fireEvent.click(screen.getByText("Check"));
    await waitFor(() => {
      expect(servicesApi.health).toHaveBeenCalledWith("grafana");
    });
  });

  it("calls deregister with user confirmation", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [SVC] });
    vi.mocked(servicesApi.deregister).mockResolvedValue({ ok: true });
    vi.stubGlobal("confirm", vi.fn(() => true));

    render(<ServicesView />, { wrapper });
    await screen.findByText("grafana");

    fireEvent.click(screen.getByText("Deregister"));

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(servicesApi.deregister).toHaveBeenCalledWith("grafana");
    });

    vi.unstubAllGlobals();
  });

  it("does not deregister when cancelled", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [SVC] });
    vi.stubGlobal("confirm", vi.fn(() => false));

    render(<ServicesView />, { wrapper });
    await screen.findByText("grafana");

    fireEvent.click(screen.getByText("Deregister"));
    expect(servicesApi.deregister).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  // ── Register form ───────────────────────────────────────────────────────

  it("renders form fields in register panel", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [SVC] });
    render(<ServicesView />, { wrapper });
    await screen.findByText("grafana");

    const registerBtn = screen.getAllByRole("button").find(
      (b) => b.textContent?.includes("Register Service"),
    )!;
    fireEvent.click(registerBtn);

    expect(screen.getByText("Service Name")).toBeInTheDocument();
    expect(screen.getByText("Host")).toBeInTheDocument();
    expect(screen.getByText("Port")).toBeInTheDocument();
    expect(screen.getByText("Health Path")).toBeInTheDocument();
    expect(screen.getByText("Enable TLS")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. qp-core")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. 10.0.1.50")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. 8000")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("/healthz")).toBeInTheDocument();
  });

  it("submits register form with valid data", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [] });
    vi.mocked(servicesApi.register).mockResolvedValue({ ok: true, service: SVC });
    render(<ServicesView />, { wrapper });
    await screen.findByText("No services registered");

    // Open the form from the blank slate action
    const registerBtn = screen.getAllByRole("button").find(
      (b) => b.textContent?.includes("Register Service"),
    )!;
    fireEvent.click(registerBtn);

    // Fill the form
    fireEvent.change(screen.getByPlaceholderText("e.g. qp-core"), { target: { value: "grafana" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. 10.0.1.50"), { target: { value: "10.0.1.50" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. 8000"), { target: { value: "3000" } });

    // Click Register button in the footer
    const submitBtn = screen.getAllByRole("button").find(
      (b) => b.textContent === "Register",
    )!;
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(servicesApi.register).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "grafana",
          host: "10.0.1.50",
          port: 3000,
        }),
      );
    });
  });

  it("closes register form on Cancel", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [SVC] });
    render(<ServicesView />, { wrapper });
    await screen.findByText("grafana");

    const registerBtn = screen.getAllByRole("button").find(
      (b) => b.textContent?.includes("Register Service"),
    )!;
    fireEvent.click(registerBtn);
    expect(screen.getByText("Service Name")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));
    // The SlideOver should transition to closed
  });

  it("validates empty fields on form submit", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [SVC] });
    render(<ServicesView />, { wrapper });
    await screen.findByText("grafana");

    // Open form
    const registerBtn = screen.getAllByRole("button").find(
      (b) => b.textContent?.includes("Register Service"),
    )!;
    fireEvent.click(registerBtn);

    // Leave all fields empty and submit
    const submitBtn = screen.getAllByRole("button").find(
      (b) => b.textContent === "Register",
    )!;
    fireEvent.click(submitBtn);

    // Validation prevents API call
    expect(servicesApi.register).not.toHaveBeenCalled();
  });

  it("validates partial fields (port=0)", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [SVC] });
    render(<ServicesView />, { wrapper });
    await screen.findByText("grafana");

    const registerBtn = screen.getAllByRole("button").find(
      (b) => b.textContent?.includes("Register Service"),
    )!;
    fireEvent.click(registerBtn);

    // Fill name and host but leave port as 0
    fireEvent.change(screen.getByPlaceholderText("e.g. qp-core"), { target: { value: "test" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. 10.0.1.50"), { target: { value: "10.0.1.1" } });

    const submitBtn = screen.getAllByRole("button").find(
      (b) => b.textContent === "Register",
    )!;
    fireEvent.click(submitBtn);

    expect(servicesApi.register).not.toHaveBeenCalled();
  });

  it("shows register mutation error", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [] });
    vi.mocked(servicesApi.register).mockRejectedValue(new Error("Duplicate name"));
    render(<ServicesView />, { wrapper });
    await screen.findByText("No services registered");

    const registerBtn = screen.getAllByRole("button").find(
      (b) => b.textContent?.includes("Register Service"),
    )!;
    fireEvent.click(registerBtn);

    fireEvent.change(screen.getByPlaceholderText("e.g. qp-core"), { target: { value: "grafana" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. 10.0.1.50"), { target: { value: "10.0.1.50" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. 8000"), { target: { value: "3000" } });

    const submitBtn = screen.getAllByRole("button").find(
      (b) => b.textContent === "Register",
    )!;
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(servicesApi.register).toHaveBeenCalled();
    });
  });

  it("shows health check error", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [SVC] });
    vi.mocked(servicesApi.health).mockRejectedValue(new Error("timeout"));
    render(<ServicesView />, { wrapper });
    await screen.findByText("grafana");

    fireEvent.click(screen.getByText("Check"));
    await waitFor(() => {
      expect(servicesApi.health).toHaveBeenCalled();
    });
  });

  it("shows deregister error", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [SVC] });
    vi.mocked(servicesApi.deregister).mockRejectedValue(new Error("in use"));
    vi.stubGlobal("confirm", vi.fn(() => true));

    render(<ServicesView />, { wrapper });
    await screen.findByText("grafana");

    fireEvent.click(screen.getByText("Deregister"));
    await waitFor(() => {
      expect(servicesApi.deregister).toHaveBeenCalled();
    });

    vi.unstubAllGlobals();
  });

  it("renders service with last_check timestamp", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({
      services: [{ ...SVC, last_check: "2026-04-07T12:00:00Z" }],
    });
    render(<ServicesView />, { wrapper });
    await screen.findByText("grafana");
    // timeSince renders something like "Xm ago"
    expect(screen.getByText(/ago/)).toBeInTheDocument();
  });

  it("renders service without response_time", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({
      services: [{ ...SVC, response_time: null }],
    });
    render(<ServicesView />, { wrapper });
    await screen.findByText("grafana");
    expect(screen.queryByText(/\d+ms/)).not.toBeInTheDocument();
  });

  it("calls refresh", async () => {
    vi.mocked(servicesApi.list).mockResolvedValue({ services: [SVC] });
    render(<ServicesView />, { wrapper });
    await screen.findByText("grafana");

    vi.mocked(servicesApi.list).mockClear();
    fireEvent.click(screen.getByText("Refresh"));

    await waitFor(() => {
      expect(servicesApi.list).toHaveBeenCalled();
    });
  });
});
