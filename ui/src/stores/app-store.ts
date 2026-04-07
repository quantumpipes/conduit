import { create } from "zustand";

export type View =
  | "dashboard"
  | "services"
  | "dns"
  | "tls"
  | "servers"
  | "routing";

type StatusFilter = "up" | "degraded" | "down";

interface Filters {
  search: string;
  status: Set<StatusFilter>;
  serviceType: string;
}

interface AppState {
  view: View;
  filters: Filters;
  slideOver: string | null;
  sidebarCollapsed: boolean;

  setView: (v: View) => void;
  setSearch: (s: string) => void;
  toggleStatus: (s: StatusFilter) => void;
  setServiceType: (t: string) => void;
  setSlideOver: (id: string | null) => void;
  toggleSidebar: () => void;
}

// ── URL <-> View sync ──────────────────────────────────────────────────────

const PATH_TO_VIEW: Record<string, View> = {
  "/": "dashboard",
  "/services": "services",
  "/dns": "dns",
  "/tls": "tls",
  "/servers": "servers",
  "/routing": "routing",
};

const VIEW_TO_PATH: Record<View, string> = {
  dashboard: "/",
  services: "/services",
  dns: "/dns",
  tls: "/tls",
  servers: "/servers",
  routing: "/routing",
};

const VIEW_TITLES: Record<View, string> = {
  dashboard: "Dashboard",
  services: "Services",
  dns: "DNS",
  tls: "TLS",
  servers: "Servers",
  routing: "Routing",
};

function viewFromPath(): View {
  return PATH_TO_VIEW[window.location.pathname] ?? "dashboard";
}

// ── Store ──────────────────────────────────────────────────────────────────

const DEFAULT_STATUS = new Set<StatusFilter>(["up", "degraded", "down"]);

export const useAppStore = create<AppState>((set) => ({
  view: viewFromPath(),
  filters: {
    search: "",
    status: new Set(DEFAULT_STATUS),
    serviceType: "",
  },
  slideOver: null,
  sidebarCollapsed: false,

  setView: (view) => {
    const path = VIEW_TO_PATH[view];
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
    document.title = view === "dashboard" ? "QP Conduit" : `${VIEW_TITLES[view]} | QP Conduit`;
    set({ view });
  },

  setSearch: (search) =>
    set((state) => ({ filters: { ...state.filters, search } })),

  toggleStatus: (s) =>
    set((state) => {
      const next = new Set(state.filters.status);
      next.has(s) ? next.delete(s) : next.add(s);
      return { filters: { ...state.filters, status: next } };
    }),

  setServiceType: (serviceType) =>
    set((state) => ({ filters: { ...state.filters, serviceType } })),

  setSlideOver: (slideOver) => set({ slideOver }),
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));

// Listen for browser back/forward (set state without pushing history again)
window.addEventListener("popstate", () => {
  const view = viewFromPath();
  document.title = view === "dashboard" ? "QP Conduit" : `${VIEW_TITLES[view]} | QP Conduit`;
  useAppStore.setState({ view });
});
