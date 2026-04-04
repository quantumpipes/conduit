import { AppShell } from "@/components/layout/app-shell";
import { useAppStore } from "@/stores/app-store";
import { lazy, Suspense } from "react";

const DashboardView = lazy(
  () => import("@/components/views/dashboard/dashboard-view"),
);
const ServicesView = lazy(
  () => import("@/components/views/services/services-view"),
);
const DnsView = lazy(() => import("@/components/views/dns/dns-view"));
const TlsView = lazy(() => import("@/components/views/tls/tls-view"));
const ServersView = lazy(
  () => import("@/components/views/servers/servers-view"),
);
const RoutingView = lazy(
  () => import("@/components/views/routing/routing-view"),
);

const views = {
  dashboard: DashboardView,
  services: ServicesView,
  dns: DnsView,
  tls: TlsView,
  servers: ServersView,
  routing: RoutingView,
} as const;

function Loading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}

export function App() {
  const view = useAppStore((s) => s.view);
  const View = views[view];

  return (
    <AppShell>
      <Suspense fallback={<Loading />}>
        <View />
      </Suspense>
    </AppShell>
  );
}
