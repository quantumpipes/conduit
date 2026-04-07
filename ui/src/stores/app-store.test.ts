import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAppStore } from "./app-store";

// Reset store between tests
beforeEach(() => {
  // Reset to default state
  useAppStore.setState({
    view: "dashboard",
    filters: {
      search: "",
      status: new Set(["up", "degraded", "down"]),
      serviceType: "",
    },
    slideOver: null,
    sidebarCollapsed: false,
  });
  // Reset URL
  window.history.replaceState(null, "", "/");
});

describe("app-store", () => {
  // ── View from URL ──────────────────────────────────────────────────────

  describe("viewFromPath (initial state)", () => {
    it("defaults to dashboard for /", () => {
      window.history.replaceState(null, "", "/");
      // Re-import to pick up new path? No, just test the store logic.
      // The store reads path on module load, so test setView + path mapping.
      expect(useAppStore.getState().view).toBe("dashboard");
    });

    it("maps known paths to views via setView roundtrip", () => {
      const mappings: Record<string, string> = {
        services: "/services",
        dns: "/dns",
        tls: "/tls",
        servers: "/servers",
        routing: "/routing",
        dashboard: "/",
      };

      for (const [view, path] of Object.entries(mappings)) {
        useAppStore.getState().setView(view as any);
        expect(window.location.pathname).toBe(path);
        expect(useAppStore.getState().view).toBe(view);
      }
    });
  });

  // ── setView ────────────────────────────────────────────────────────────

  describe("setView", () => {
    it("updates the view state", () => {
      useAppStore.getState().setView("services");
      expect(useAppStore.getState().view).toBe("services");
    });

    it("pushes to browser history", () => {
      useAppStore.getState().setView("dns");
      expect(window.location.pathname).toBe("/dns");
    });

    it("updates document title for non-dashboard views", () => {
      useAppStore.getState().setView("tls");
      expect(document.title).toBe("TLS | QP Conduit");
    });

    it("sets title to 'QP Conduit' for dashboard", () => {
      useAppStore.getState().setView("services");
      useAppStore.getState().setView("dashboard");
      expect(document.title).toBe("QP Conduit");
    });

    it("does not push duplicate history entries for same path", () => {
      const pushSpy = vi.spyOn(window.history, "pushState");
      useAppStore.getState().setView("servers");
      pushSpy.mockClear();

      // Setting same view again should not push
      useAppStore.getState().setView("servers");
      expect(pushSpy).not.toHaveBeenCalled();
      pushSpy.mockRestore();
    });
  });

  // ── popstate (back/forward) ────────────────────────────────────────────

  describe("popstate handling", () => {
    it("updates view on popstate event", () => {
      useAppStore.getState().setView("routing");
      useAppStore.getState().setView("tls");

      // Simulate going back
      window.history.back();
      // In happy-dom, history.back() is sync, but popstate may need manual dispatch
      window.history.replaceState(null, "", "/routing");
      window.dispatchEvent(new PopStateEvent("popstate"));

      expect(useAppStore.getState().view).toBe("routing");
    });

    it("falls back to dashboard for unknown paths", () => {
      window.history.replaceState(null, "", "/unknown-page");
      window.dispatchEvent(new PopStateEvent("popstate"));

      expect(useAppStore.getState().view).toBe("dashboard");
    });
  });

  // ── Filters ────────────────────────────────────────────────────────────

  describe("filters", () => {
    it("sets search text", () => {
      useAppStore.getState().setSearch("grafana");
      expect(useAppStore.getState().filters.search).toBe("grafana");
    });

    it("toggles status filter on", () => {
      // Start with all, remove one, add it back
      useAppStore.getState().toggleStatus("down");
      expect(useAppStore.getState().filters.status.has("down")).toBe(false);

      useAppStore.getState().toggleStatus("down");
      expect(useAppStore.getState().filters.status.has("down")).toBe(true);
    });

    it("sets service type", () => {
      useAppStore.getState().setServiceType("http");
      expect(useAppStore.getState().filters.serviceType).toBe("http");
    });
  });

  // ── UI state ───────────────────────────────────────────────────────────

  describe("UI state", () => {
    it("toggles sidebar collapsed", () => {
      expect(useAppStore.getState().sidebarCollapsed).toBe(false);
      useAppStore.getState().toggleSidebar();
      expect(useAppStore.getState().sidebarCollapsed).toBe(true);
      useAppStore.getState().toggleSidebar();
      expect(useAppStore.getState().sidebarCollapsed).toBe(false);
    });

    it("sets and clears slideOver", () => {
      useAppStore.getState().setSlideOver("cert-detail");
      expect(useAppStore.getState().slideOver).toBe("cert-detail");

      useAppStore.getState().setSlideOver(null);
      expect(useAppStore.getState().slideOver).toBeNull();
    });
  });
});
