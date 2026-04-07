import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./empty-state";
import { Globe } from "lucide-react";

describe("EmptyState", () => {
  it("renders loading spinner when loading=true", () => {
    const { container } = render(<EmptyState loading />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders loading title when provided", () => {
    render(<EmptyState loading title="Loading services..." />);
    expect(screen.getByText("Loading services...")).toBeInTheDocument();
  });

  it("renders icon, title, and description", () => {
    render(
      <EmptyState
        icon={<Globe data-testid="empty-icon" />}
        title="No DNS entries"
        description="Register a service to create entries."
      />,
    );

    expect(screen.getByTestId("empty-icon")).toBeInTheDocument();
    expect(screen.getByText("No DNS entries")).toBeInTheDocument();
    expect(screen.getByText("Register a service to create entries.")).toBeInTheDocument();
  });

  it("renders action button when provided", () => {
    render(
      <EmptyState
        title="Empty"
        action={<button>Do something</button>}
      />,
    );

    expect(screen.getByText("Do something")).toBeInTheDocument();
  });

  it("renders nothing when no props given (non-loading)", () => {
    const { container } = render(<EmptyState />);
    // Should render the container but no content
    expect(container.firstChild).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <EmptyState title="Test" className="py-16" />,
    );
    expect(container.firstChild).toHaveClass("py-16");
  });
});
