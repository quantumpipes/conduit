import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HealthDot } from "./health-dot";

describe("HealthDot", () => {
  // ── No status (checking) ──────────────────────────────────────────────

  it("shows 'Checking...' when status is undefined (md size)", () => {
    render(<HealthDot />);
    expect(screen.getByText("Checking...")).toBeInTheDocument();
  });

  it("hides label when status is undefined and size is sm", () => {
    render(<HealthDot size="sm" />);
    expect(screen.queryByText("Checking...")).not.toBeInTheDocument();
  });

  it("renders pulse animation dot when no status", () => {
    const { container } = render(<HealthDot />);
    expect(container.querySelector(".animate-pulse-slow")).toBeInTheDocument();
  });

  // ── Up status ─────────────────────────────────────────────────────────

  it("shows 'Up' label for up status", () => {
    render(<HealthDot status="up" />);
    expect(screen.getByText("Up")).toBeInTheDocument();
  });

  it("renders green dot for up status", () => {
    const { container } = render(<HealthDot status="up" />);
    expect(container.querySelector(".bg-success")).toBeInTheDocument();
  });

  // ── Degraded status ───────────────────────────────────────────────────

  it("shows 'Slow' label for degraded status", () => {
    render(<HealthDot status="degraded" />);
    expect(screen.getByText("Slow")).toBeInTheDocument();
  });

  it("renders yellow dot for degraded status", () => {
    const { container } = render(<HealthDot status="degraded" />);
    expect(container.querySelector(".bg-warning")).toBeInTheDocument();
  });

  // ── Down status ───────────────────────────────────────────────────────

  it("shows 'Down' label for down status", () => {
    render(<HealthDot status="down" />);
    expect(screen.getByText("Down")).toBeInTheDocument();
  });

  it("renders red dot for down status", () => {
    const { container } = render(<HealthDot status="down" />);
    expect(container.querySelector(".bg-error")).toBeInTheDocument();
  });

  // ── Response time ─────────────────────────────────────────────────────

  it("shows response time when provided", () => {
    render(<HealthDot status="up" responseTime={42} />);
    expect(screen.getByText("42ms")).toBeInTheDocument();
  });

  it("hides response time when null", () => {
    render(<HealthDot status="up" responseTime={null} />);
    expect(screen.queryByText(/ms/)).not.toBeInTheDocument();
  });

  // ── Size variants ─────────────────────────────────────────────────────

  it("hides label text when size is sm", () => {
    render(<HealthDot status="up" size="sm" />);
    expect(screen.queryByText("Up")).not.toBeInTheDocument();
  });

  it("hides response time when size is sm", () => {
    render(<HealthDot status="up" responseTime={42} size="sm" />);
    expect(screen.queryByText("42ms")).not.toBeInTheDocument();
  });

  it("uses smaller dot size for sm", () => {
    const { container } = render(<HealthDot status="up" size="sm" />);
    expect(container.querySelector(".h-2")).toBeInTheDocument();
  });

  it("uses larger dot size for md (default)", () => {
    const { container } = render(<HealthDot status="up" />);
    expect(container.querySelector('[class*="h-2.5"]')).toBeInTheDocument();
  });
});
