import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SlideOver } from "./slide-over";

describe("SlideOver", () => {
  it("renders title and children when open", () => {
    render(
      <SlideOver open onClose={vi.fn()} title="Details">
        <p>Panel content</p>
      </SlideOver>,
    );
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Panel content")).toBeInTheDocument();
  });

  it("renders footer when provided", () => {
    render(
      <SlideOver open onClose={vi.fn()} title="Test" footer={<button>Save</button>}>
        <p>Body</p>
      </SlideOver>,
    );
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("does not render footer when not provided", () => {
    render(
      <SlideOver open onClose={vi.fn()} title="Test">
        <p>Body</p>
      </SlideOver>,
    );
    expect(screen.queryByText("Save")).not.toBeInTheDocument();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(
      <SlideOver open onClose={onClose} title="Test">
        <p>Body</p>
      </SlideOver>,
    );
    fireEvent.click(screen.getByLabelText("Close panel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when backdrop clicked", () => {
    const onClose = vi.fn();
    render(
      <SlideOver open onClose={onClose} title="Test">
        <p>Body</p>
      </SlideOver>,
    );
    // The backdrop is the first div with aria-hidden
    const backdrop = document.querySelector("[aria-hidden]");
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose on Escape key when open", () => {
    const onClose = vi.fn();
    render(
      <SlideOver open onClose={onClose} title="Test">
        <p>Body</p>
      </SlideOver>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose on Escape when closed", () => {
    const onClose = vi.fn();
    render(
      <SlideOver open={false} onClose={onClose} title="Test">
        <p>Body</p>
      </SlideOver>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("has correct aria attributes when open", () => {
    render(
      <SlideOver open onClose={vi.fn()} title="Test Panel">
        <p>Body</p>
      </SlideOver>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Test Panel");
  });

  it("slides off-screen when closed", () => {
    render(
      <SlideOver open={false} onClose={vi.fn()} title="Test">
        <p>Body</p>
      </SlideOver>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("translate-x-full");
  });
});
