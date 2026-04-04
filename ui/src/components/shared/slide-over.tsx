import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useEffect } from "react";

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function SlideOver({ open, onClose, title, children, footer }: SlideOverProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!open}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal={open}
        aria-label={title}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[480px] flex-col border-l border-border bg-surface-1 shadow-2xl transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-3 transition-colors hover:bg-surface-3 hover:text-text-1"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
