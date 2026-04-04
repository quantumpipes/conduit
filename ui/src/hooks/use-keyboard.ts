import { useEffect } from "react";
import { useAppStore, type View } from "@/stores/app-store";

const VIEW_KEYS: Record<string, View> = {
  "1": "dashboard",
  "2": "services",
  "3": "dns",
  "4": "tls",
  "5": "servers",
  "6": "routing",
};

export function useKeyboardShortcuts() {
  const setView = useAppStore((s) => s.setView);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT";

      if (e.key === "/" && !isInput) {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          "[data-search-input]",
        );
        searchInput?.focus();
        return;
      }

      if (e.key === "Escape") {
        const setSlideOver = useAppStore.getState().setSlideOver;
        setSlideOver(null);
        if (isInput) (target as HTMLInputElement).blur();
        return;
      }

      if (!isInput && !e.metaKey && !e.ctrlKey && VIEW_KEYS[e.key]) {
        setView(VIEW_KEYS[e.key]!);
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setView]);
}
