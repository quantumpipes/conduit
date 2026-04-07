import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ToastProvider, useToast } from "./toast";

function ToastTrigger({ message, type }: { message: string; type?: "success" | "error" }) {
  const { toast } = useToast();
  return <button onClick={() => toast(message, type)}>Fire</button>;
}

describe("Toast", () => {
  it("renders toast on trigger", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastTrigger message="Saved!" />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText("Fire").click();
    });

    expect(screen.getByText("Saved!")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("auto-dismisses after 3 seconds", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastTrigger message="Bye!" />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText("Fire").click();
    });
    expect(screen.getByText("Bye!")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText("Bye!")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("renders error toast with error styling", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastTrigger message="Failed!" type="error" />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText("Fire").click();
    });

    const toast = screen.getByText("Failed!");
    expect(toast.className).toContain("error");
    vi.useRealTimers();
  });

  it("renders success toast with success styling", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastTrigger message="Done!" />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText("Fire").click();
    });

    const toast = screen.getByText("Done!");
    expect(toast.className).toContain("success");
    vi.useRealTimers();
  });

  it("can show multiple toasts", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastTrigger message="First" />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText("Fire").click();
      screen.getByText("Fire").click();
    });

    expect(screen.getAllByText("First").length).toBe(2);
    vi.useRealTimers();
  });

  it("returns noop toast outside provider", () => {
    // useToast outside provider returns default noop - should not throw
    function Orphan() {
      const { toast } = useToast();
      return <button onClick={() => toast("nope")}>Fire</button>;
    }
    render(<Orphan />);
    expect(() => screen.getByText("Fire").click()).not.toThrow();
  });
});
