import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CopyButton } from "./copy-button";

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  writeText.mockClear();
});

describe("CopyButton", () => {
  it("renders with title 'Copy'", () => {
    render(<CopyButton text="hello" />);
    expect(screen.getByTitle("Copy")).toBeInTheDocument();
  });

  it("copies text to clipboard on click", async () => {
    render(<CopyButton text="secret" />);
    await act(async () => {
      fireEvent.click(screen.getByTitle("Copy"));
    });
    expect(writeText).toHaveBeenCalledWith("secret");
  });

  it("shows success state after copying", async () => {
    const { container } = render(<CopyButton text="hello" />);
    await act(async () => {
      fireEvent.click(screen.getByTitle("Copy"));
    });
    expect(container.querySelector(".text-success")).toBeInTheDocument();
  });

  it("reverts after timeout", async () => {
    const { container } = render(<CopyButton text="hello" />);
    await act(async () => {
      fireEvent.click(screen.getByTitle("Copy"));
    });
    expect(container.querySelector(".text-success")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(container.querySelector(".text-success")).not.toBeInTheDocument();
  });

  it("renders label", () => {
    render(<CopyButton text="hello" label="Copy ID" />);
    expect(screen.getByText("Copy ID")).toBeInTheDocument();
  });

  it("shows 'Copied!' label after copy", async () => {
    render(<CopyButton text="hello" label="Copy ID" />);
    await act(async () => {
      fireEvent.click(screen.getByTitle("Copy"));
    });
    expect(screen.getByText("Copied!")).toBeInTheDocument();
  });

  it("stops event propagation", async () => {
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <CopyButton text="hello" />
      </div>,
    );
    await act(async () => {
      fireEvent.click(screen.getByTitle("Copy"));
    });
    expect(parentClick).not.toHaveBeenCalled();
  });

  it("applies className", () => {
    const { container } = render(<CopyButton text="hello" className="ml-2" />);
    expect(container.querySelector(".ml-2")).toBeInTheDocument();
  });
});
