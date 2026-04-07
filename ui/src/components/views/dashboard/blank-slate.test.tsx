import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BlankSlate } from "./blank-slate";
import { useAppStore } from "@/stores/app-store";

beforeEach(() => {
  useAppStore.setState({ view: "dashboard" });
  window.history.replaceState(null, "", "/");
});

describe("BlankSlate (dashboard)", () => {
  // ── Rendering ──────────────────────────────────────────────────────────

  it("renders the hero headline", () => {
    render(<BlankSlate />);
    expect(screen.getByText("Your infrastructure, connected.")).toBeInTheDocument();
  });

  it("renders the status beacon", () => {
    render(<BlankSlate />);
    expect(screen.getByText("Conduit is running")).toBeInTheDocument();
  });

  it("renders all 5 capability cards", () => {
    render(<BlankSlate />);

    // Each label appears twice: once in the topology SVG and once in the card
    expect(screen.getAllByText("Services").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("DNS").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("TLS").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Servers").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Routing").length).toBeGreaterThanOrEqual(2);
  });

  it("renders step numbers for each capability", () => {
    render(<BlankSlate />);

    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(`Step ${i}`)).toBeInTheDocument();
    }
  });

  it("renders the three principles", () => {
    render(<BlankSlate />);

    expect(screen.getByText("Zero Trust")).toBeInTheDocument();
    expect(screen.getByText("Air-Gapped")).toBeInTheDocument();
    expect(screen.getByText("Observable")).toBeInTheDocument();
  });

  it("renders the first step CTA", () => {
    render(<BlankSlate />);

    expect(screen.getByText("Register a Service")).toBeInTheDocument();
  });

  it("renders the getting started section", () => {
    render(<BlankSlate />);

    expect(screen.getByText("Get Started")).toBeInTheDocument();
  });

  // ── Topology map navigation ────────────────────────────────────────────

  it("navigates to services when topology node is clicked", () => {
    render(<BlankSlate />);

    // The topology map has SVG text labels that are clickable via their parent group
    // Click the "Register a Service" CTA button instead (more reliable)
    fireEvent.click(screen.getByText("Register a Service"));

    expect(useAppStore.getState().view).toBe("services");
  });

  // ── Capability card expansion ──────────────────────────────────────────

  it("expands a capability card on click", () => {
    render(<BlankSlate />);

    // Click "Register and monitor" tagline's parent button
    fireEvent.click(screen.getByText("Register and monitor"));

    // Should show the expanded description
    expect(
      screen.getByText(/Register backend services with health checks/),
    ).toBeInTheDocument();
  });

  it("shows CLI command in expanded card", () => {
    render(<BlankSlate />);

    // Expand Services card
    fireEvent.click(screen.getByText("Register and monitor"));

    expect(
      screen.getByText("make conduit-register NAME=grafana HOST=10.0.1.50:3000"),
    ).toBeInTheDocument();
  });

  it("shows Open button in expanded card", () => {
    render(<BlankSlate />);

    fireEvent.click(screen.getByText("Register and monitor"));

    expect(screen.getByText("Open Services")).toBeInTheDocument();
  });

  it("navigates when Open button is clicked in expanded card", () => {
    render(<BlankSlate />);

    fireEvent.click(screen.getByText("Register and monitor"));
    fireEvent.click(screen.getByText("Open Services"));

    expect(useAppStore.getState().view).toBe("services");
  });

  it("collapses card when clicked again", () => {
    render(<BlankSlate />);

    // Expand
    fireEvent.click(screen.getByText("Register and monitor"));
    expect(
      screen.getByText(/Register backend services/),
    ).toBeInTheDocument();

    // Collapse
    fireEvent.click(screen.getByText("Register and monitor"));
    expect(
      screen.queryByText(/Register backend services/),
    ).not.toBeInTheDocument();
  });

  it("only one card expanded at a time", () => {
    render(<BlankSlate />);

    // Expand Services
    fireEvent.click(screen.getByText("Register and monitor"));
    expect(screen.getByText(/Register backend services/)).toBeInTheDocument();

    // Expand DNS (should close Services)
    fireEvent.click(screen.getByText("Name everything"));
    expect(screen.queryByText(/Register backend services/)).not.toBeInTheDocument();
    expect(screen.getByText(/Automatic \.internal DNS/)).toBeInTheDocument();
  });

  // ── Topology keyboard navigation ────────────────────────────────────────

  it("navigates via Enter key on topology node", () => {
    render(<BlankSlate />);

    const buttons = Array.from(document.querySelectorAll('g[role="button"]'));
    expect(buttons.length).toBe(5);

    fireEvent.keyDown(buttons[0]!, { key: "Enter" });
    expect(useAppStore.getState().view).toBe("services");
  });

  it("navigates via Space key on topology node", () => {
    render(<BlankSlate />);

    const buttons = Array.from(document.querySelectorAll('g[role="button"]'));
    fireEvent.keyDown(buttons[1]!, { key: " " });
    expect(useAppStore.getState().view).toBe("dns");
  });

  it("ignores non-Enter/Space keys on topology node", () => {
    render(<BlankSlate />);

    const buttons = Array.from(document.querySelectorAll('g[role="button"]'));
    fireEvent.keyDown(buttons[0]!, { key: "Tab" });
    expect(useAppStore.getState().view).toBe("dashboard");
  });

  it("handles hover on topology node", () => {
    render(<BlankSlate />);

    const buttons = Array.from(document.querySelectorAll('g[role="button"]'));
    fireEvent.mouseEnter(buttons[0]!);
    fireEvent.mouseLeave(buttons[0]!);
  });

  // ── Footer ─────────────────────────────────────────────────────────────

  it("renders footer branding", () => {
    render(<BlankSlate />);

    expect(screen.getByText("QP Conduit")).toBeInTheDocument();
    expect(screen.getByText("On-premises infrastructure mesh")).toBeInTheDocument();
  });
});
