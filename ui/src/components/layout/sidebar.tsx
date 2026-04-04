import {
  LayoutDashboard,
  Layers,
  Globe,
  ShieldCheck,
  Server,
  ArrowLeftRight,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAppStore, type View } from "@/stores/app-store";

interface NavItem {
  id: View;
  label: string;
  icon: typeof LayoutDashboard;
  activeClass: string;
  accentColor: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    label: "Overview",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        activeClass: "bg-surface-2 text-text-1",
        accentColor: "bg-primary",
      },
    ],
  },
  {
    label: "Services",
    items: [
      {
        id: "services",
        label: "Services",
        icon: Layers,
        activeClass: "bg-tab-services text-tab-services-text",
        accentColor: "bg-tab-services-text",
      },
      {
        id: "dns",
        label: "DNS",
        icon: Globe,
        activeClass: "bg-tab-dns text-tab-dns-text",
        accentColor: "bg-tab-dns-text",
      },
      {
        id: "tls",
        label: "TLS",
        icon: ShieldCheck,
        activeClass: "bg-tab-tls text-tab-tls-text",
        accentColor: "bg-tab-tls-text",
      },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      {
        id: "servers",
        label: "Servers",
        icon: Server,
        activeClass: "bg-tab-servers text-tab-servers-text",
        accentColor: "bg-tab-servers-text",
      },
      {
        id: "routing",
        label: "Routing",
        icon: ArrowLeftRight,
        activeClass: "bg-tab-routing text-tab-routing-text",
        accentColor: "bg-tab-routing-text",
      },
    ],
  },
];

export function Sidebar() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col overflow-hidden border-r border-border bg-surface-1 transition-[width] duration-200 ease-out",
        collapsed ? "w-14" : "w-[220px]",
      )}
    >
      <div
        className={cn(
          "flex h-10 shrink-0 items-center gap-2.5 border-b border-border",
          collapsed ? "justify-center" : "px-4",
        )}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20">
          <Network size={16} className="text-primary" />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-text-1 whitespace-nowrap">
            QP Conduit
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        {sections.map((section, i) => (
          <div key={section.label} className={cn(i > 0 && "mt-4")}>
            {!collapsed ? (
              <div className="mb-1.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                {section.label}
              </div>
            ) : i > 0 ? (
              <div className="mx-3 mb-3 border-t border-border" />
            ) : null}
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = view === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setView(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg mx-2 py-2 text-[13px] font-medium transition-all duration-100",
                      collapsed ? "justify-center" : "px-3",
                      active
                        ? item.activeClass
                        : "text-text-3 hover:bg-surface-2 hover:text-text-2",
                    )}
                  >
                    {active && (
                      <span
                        className={cn(
                          "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full",
                          item.accentColor,
                        )}
                      />
                    )}
                    <item.icon size={18} className="shrink-0" />
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-2">
        <button
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex w-full items-center rounded-lg py-2 text-text-3 transition-colors hover:bg-surface-2 hover:text-text-2",
            collapsed ? "justify-center" : "gap-2 px-3",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen size={16} />
          ) : (
            <PanelLeftClose size={16} />
          )}
          {!collapsed && <span className="text-[12px]">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
