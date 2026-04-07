import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBar } from "./status-bar";

describe("StatusBar", () => {
  it("shows 'Connecting...' when loading", () => {
    render(<StatusBar loading />);
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
  });

  it("shows DNS and Caddy status dots", () => {
    render(<StatusBar dnsOk caddyOk />);
    expect(screen.getByText("DNS")).toBeInTheDocument();
    expect(screen.getByText("Caddy")).toBeInTheDocument();
  });

  it("shows 'No services' when servicesTotal is 0", () => {
    render(<StatusBar servicesTotal={0} servicesUp={0} />);
    expect(screen.getByText("No services")).toBeInTheDocument();
  });

  it("shows service count when services exist", () => {
    render(<StatusBar servicesUp={3} servicesTotal={4} />);
    expect(screen.getByText("3/4 up")).toBeInTheDocument();
  });

  it("shows cert count", () => {
    render(<StatusBar certsValid={5} />);
    expect(screen.getByText(/5 certs valid/)).toBeInTheDocument();
  });

  it("shows singular cert text", () => {
    render(<StatusBar certsValid={1} />);
    expect(screen.getByText(/1 cert valid/)).toBeInTheDocument();
  });

  it("shows servers online count", () => {
    render(<StatusBar serversOnline={2} />);
    expect(screen.getByText("2 servers online")).toBeInTheDocument();
  });

  it("shows singular server text", () => {
    render(<StatusBar serversOnline={1} />);
    expect(screen.getByText("1 server online")).toBeInTheDocument();
  });

  it("shows last audit action", () => {
    render(<StatusBar lastAuditAction="service.register" lastAuditTime="2m ago" />);
    expect(screen.getByText("service.register")).toBeInTheDocument();
    expect(screen.getByText("2m ago")).toBeInTheDocument();
  });

  it("renders status dots with aria-labels", () => {
    render(<StatusBar dnsOk={true} caddyOk={false} />);
    const healthy = screen.getAllByLabelText("healthy");
    const unhealthy = screen.getAllByLabelText("unhealthy");
    expect(healthy.length).toBeGreaterThanOrEqual(1);
    expect(unhealthy.length).toBeGreaterThanOrEqual(1);
  });
});
