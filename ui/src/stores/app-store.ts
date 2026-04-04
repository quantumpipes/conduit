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

const DEFAULT_STATUS = new Set<StatusFilter>(["up", "degraded", "down"]);

export const useAppStore = create<AppState>((set) => ({
  view: "dashboard",
  filters: {
    search: "",
    status: new Set(DEFAULT_STATUS),
    serviceType: "",
  },
  slideOver: null,
  sidebarCollapsed: false,

  setView: (view) => set({ view }),

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
