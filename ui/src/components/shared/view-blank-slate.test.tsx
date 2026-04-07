import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewBlankSlate } from "./view-blank-slate";
import { useAppStore } from "@/stores/app-store";
import { Globe } from "lucide-react";

beforeEach(() => {
  useAppStore.setState({ view: "dns" });
  window.history.replaceState(null, "", "/dns");
});

const defaultProps = {
  icon: <Globe size={28} data-testid="icon" />,
  title: "No DNS entries",
  tagline: "Every service gets a name",
  description: "When you register a service, Conduit creates .internal DNS entries.",
  features: [
    { label: "Auto-Created", description: "DNS entries from registry" },
    { label: "Resolve Tester", description: "Verify lookups" },
  ],
  command: "make conduit-register NAME=grafana HOST=10.0.1.50:3000",
  commandLabel: "Register via CLI",
  actionLabel: "Register a Service",
  actionView: "services" as const,
  color: "text-tab-dns-text",
  bgColor: "bg-tab-dns",
  accentBorder: "border-tab-dns-text/20",
};

describe("ViewBlankSlate", () => {
  it("renders title and tagline", () => {
    render(<ViewBlankSlate {...defaultProps} />);

    expect(screen.getByText("No DNS entries")).toBeInTheDocument();
    expect(screen.getByText("Every service gets a name")).toBeInTheDocument();
  });

  it("renders description text", () => {
    render(<ViewBlankSlate {...defaultProps} />);

    expect(
      screen.getByText(/When you register a service/),
    ).toBeInTheDocument();
  });

  it("renders feature pills", () => {
    render(<ViewBlankSlate {...defaultProps} />);

    expect(screen.getByText("Auto-Created")).toBeInTheDocument();
    expect(screen.getByText("Resolve Tester")).toBeInTheDocument();
    expect(screen.getByText("DNS entries from registry")).toBeInTheDocument();
  });

  it("renders the CLI command", () => {
    render(<ViewBlankSlate {...defaultProps} />);

    expect(
      screen.getByText("make conduit-register NAME=grafana HOST=10.0.1.50:3000"),
    ).toBeInTheDocument();
  });

  it("renders command label", () => {
    render(<ViewBlankSlate {...defaultProps} />);

    expect(screen.getByText("Register via CLI")).toBeInTheDocument();
  });

  it("navigates to actionView when action button clicked", () => {
    render(<ViewBlankSlate {...defaultProps} />);

    fireEvent.click(screen.getByText("Register a Service"));

    expect(useAppStore.getState().view).toBe("services");
  });

  it("calls onAction callback when provided instead of navigating", () => {
    const onAction = vi.fn();
    render(
      <ViewBlankSlate {...defaultProps} actionView={undefined} onAction={onAction} />,
    );

    fireEvent.click(screen.getByText("Register a Service"));

    expect(onAction).toHaveBeenCalledOnce();
  });

  it("navigates to dashboard via back link", () => {
    render(<ViewBlankSlate {...defaultProps} />);

    fireEvent.click(screen.getByText("Back to Dashboard"));

    expect(useAppStore.getState().view).toBe("dashboard");
  });

  it("renders action button with correct label", () => {
    render(<ViewBlankSlate {...defaultProps} actionLabel="Open DNS" />);

    expect(screen.getByText("Open DNS")).toBeInTheDocument();
  });
});
