import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/api/tls", () => ({
  tlsApi: {
    list: vi.fn(),
    rotate: vi.fn(),
    inspect: vi.fn(),
    trust: vi.fn(),
    getCaInfo: vi.fn(),
  },
}));
vi.mock("@/components/shared/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import TlsView from "./tls-view";
import { tlsApi } from "@/api/tls";
import { useAppStore } from "@/stores/app-store";
import type { TlsCert, CaInfo } from "@/lib/types";

const CERT: TlsCert = {
  name: "grafana",
  domain: "grafana.internal",
  issuer: "Conduit Internal CA",
  not_before: "2026-04-01",
  not_after: "2027-04-01",
  fingerprint: "SHA256:abc123def456789012345678901234567890",
  algorithm: "Ed25519",
  status: "valid",
};

const CA: CaInfo = {
  issuer: "Conduit Root CA",
  not_after: "2036-04-01",
  algorithm: "Ed25519",
  fingerprint: "SHA256:rootca123456789",
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  useAppStore.setState({ view: "tls" });
  vi.clearAllMocks();
});

describe("TlsView", () => {
  // ── States ─────────────────────────────────────────────────────────────

  it("shows page title 'TLS Certificates'", async () => {
    vi.mocked(tlsApi.list).mockResolvedValue({ certs: [] });
    vi.mocked(tlsApi.getCaInfo).mockRejectedValue(new Error("n/a"));
    render(<TlsView />, { wrapper });
    expect(await screen.findByText("TLS Certificates")).toBeInTheDocument();
  });

  it("shows rich blank slate when empty", async () => {
    vi.mocked(tlsApi.list).mockResolvedValue({ certs: [] });
    vi.mocked(tlsApi.getCaInfo).mockRejectedValue(new Error("n/a"));
    render(<TlsView />, { wrapper });
    expect(await screen.findByText("No certificates issued")).toBeInTheDocument();
    expect(screen.getByText("Auto-Issued")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    vi.mocked(tlsApi.list).mockRejectedValue(new Error("fail"));
    vi.mocked(tlsApi.getCaInfo).mockRejectedValue(new Error("fail"));
    render(<TlsView />, { wrapper });
    expect(await screen.findByText("Could not load certificates")).toBeInTheDocument();
  });

  // ── Stats ──────────────────────────────────────────────────────────────

  it("renders stats with counts", async () => {
    vi.mocked(tlsApi.list).mockResolvedValue({
      certs: [
        CERT,
        { ...CERT, name: "exp", status: "expiring" },
        { ...CERT, name: "dead", status: "expired" },
      ],
    });
    vi.mocked(tlsApi.getCaInfo).mockRejectedValue(new Error("n/a"));
    render(<TlsView />, { wrapper });

    await screen.findByText("grafana");
    expect(screen.getByText("Valid")).toBeInTheDocument();
    expect(screen.getByText("Expiring Soon")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  // ── Cert cards ─────────────────────────────────────────────────────────

  it("renders cert card with details", async () => {
    vi.mocked(tlsApi.list).mockResolvedValue({ certs: [CERT] });
    vi.mocked(tlsApi.getCaInfo).mockRejectedValue(new Error("n/a"));
    render(<TlsView />, { wrapper });

    expect(await screen.findByText("grafana")).toBeInTheDocument();
    expect(screen.getByText("grafana.internal")).toBeInTheDocument();
    expect(screen.getByText("valid")).toBeInTheDocument();
  });

  it("opens inspect panel on Inspect click", async () => {
    vi.mocked(tlsApi.list).mockResolvedValue({ certs: [CERT] });
    vi.mocked(tlsApi.getCaInfo).mockRejectedValue(new Error("n/a"));
    render(<TlsView />, { wrapper });

    fireEvent.click(await screen.findByText("Inspect"));
    expect(screen.getByText("Certificate: grafana")).toBeInTheDocument();
    // Ed25519 appears in both card and panel
    expect(screen.getAllByText("Ed25519").length).toBeGreaterThanOrEqual(2);
  });

  it("calls rotate on Rotate click", async () => {
    vi.mocked(tlsApi.list).mockResolvedValue({ certs: [CERT] });
    vi.mocked(tlsApi.getCaInfo).mockRejectedValue(new Error("n/a"));
    vi.mocked(tlsApi.rotate).mockResolvedValue({ ok: true, cert: CERT });
    render(<TlsView />, { wrapper });

    fireEvent.click(await screen.findByText("Rotate"));
    await waitFor(() => {
      expect(tlsApi.rotate).toHaveBeenCalledWith("grafana");
    });
  });

  it("calls trust CA on Trust CA button", async () => {
    vi.mocked(tlsApi.list).mockResolvedValue({ certs: [CERT] });
    vi.mocked(tlsApi.getCaInfo).mockRejectedValue(new Error("n/a"));
    vi.mocked(tlsApi.trust).mockResolvedValue({ ok: true, message: "done" });
    render(<TlsView />, { wrapper });
    await screen.findByText("grafana");

    fireEvent.click(screen.getByText("Trust CA"));
    await waitFor(() => {
      expect(tlsApi.trust).toHaveBeenCalled();
    });
  });

  it("shows rotate error callback", async () => {
    vi.mocked(tlsApi.list).mockResolvedValue({ certs: [CERT] });
    vi.mocked(tlsApi.getCaInfo).mockRejectedValue(new Error("n/a"));
    vi.mocked(tlsApi.rotate).mockRejectedValue(new Error("rotate failed"));
    render(<TlsView />, { wrapper });

    fireEvent.click(await screen.findByText("Rotate"));
    await waitFor(() => {
      expect(tlsApi.rotate).toHaveBeenCalled();
    });
  });

  it("shows trust CA error callback", async () => {
    vi.mocked(tlsApi.list).mockResolvedValue({ certs: [CERT] });
    vi.mocked(tlsApi.getCaInfo).mockRejectedValue(new Error("n/a"));
    vi.mocked(tlsApi.trust).mockRejectedValue(new Error("trust failed"));
    render(<TlsView />, { wrapper });
    await screen.findByText("grafana");

    fireEvent.click(screen.getByText("Trust CA"));
    await waitFor(() => {
      expect(tlsApi.trust).toHaveBeenCalled();
    });
  });

  it("renders cert with PEM in inspect panel", async () => {
    const certWithPem = { ...CERT, pem: "-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----" };
    vi.mocked(tlsApi.list).mockResolvedValue({ certs: [certWithPem] });
    vi.mocked(tlsApi.getCaInfo).mockRejectedValue(new Error("n/a"));
    render(<TlsView />, { wrapper });

    fireEvent.click(await screen.findByText("Inspect"));
    expect(screen.getByText(/BEGIN CERTIFICATE/)).toBeInTheDocument();
  });

  it("renders expiring and expired badges", async () => {
    vi.mocked(tlsApi.list).mockResolvedValue({
      certs: [
        { ...CERT, name: "exp", status: "expiring" },
        { ...CERT, name: "dead", status: "expired" },
      ],
    });
    vi.mocked(tlsApi.getCaInfo).mockRejectedValue(new Error("n/a"));
    render(<TlsView />, { wrapper });

    expect(await screen.findByText("expiring")).toBeInTheDocument();
    expect(screen.getByText("expired")).toBeInTheDocument();
  });

  // ── CA info ────────────────────────────────────────────────────────────

  it("renders CA info box when available", async () => {
    vi.mocked(tlsApi.list).mockResolvedValue({ certs: [CERT] });
    vi.mocked(tlsApi.getCaInfo).mockResolvedValue({ ca: CA });
    render(<TlsView />, { wrapper });

    expect(await screen.findByText("Internal CA")).toBeInTheDocument();
    expect(screen.getByText("Conduit Root CA")).toBeInTheDocument();
  });

  it("renders CA fingerprint with copy button", async () => {
    vi.mocked(tlsApi.list).mockResolvedValue({ certs: [CERT] });
    vi.mocked(tlsApi.getCaInfo).mockResolvedValue({ ca: CA });
    render(<TlsView />, { wrapper });

    await screen.findByText("Internal CA");
    expect(screen.getByText(/rootca123/)).toBeInTheDocument();
  });

  it("renders inspect panel detail rows", async () => {
    vi.mocked(tlsApi.list).mockResolvedValue({ certs: [CERT] });
    vi.mocked(tlsApi.getCaInfo).mockRejectedValue(new Error("n/a"));
    render(<TlsView />, { wrapper });

    fireEvent.click(await screen.findByText("Inspect"));

    // DetailRow renders label + value
    expect(screen.getByText("Service")).toBeInTheDocument();
    expect(screen.getByText("Domain")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Not Before")).toBeInTheDocument();
    expect(screen.getByText("Not After")).toBeInTheDocument();
    expect(screen.getByText("Algorithm")).toBeInTheDocument();
    expect(screen.getByText("Fingerprint")).toBeInTheDocument();
  });

  it("hides CA info box when getCaInfo fails", async () => {
    vi.mocked(tlsApi.list).mockResolvedValue({ certs: [CERT] });
    vi.mocked(tlsApi.getCaInfo).mockRejectedValue(new Error("n/a"));
    render(<TlsView />, { wrapper });

    await screen.findByText("grafana");
    expect(screen.queryByText("Internal CA")).not.toBeInTheDocument();
  });
});
