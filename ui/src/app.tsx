import { AppShell } from "@/components/layout/app-shell";
import { useAppStore } from "@/stores/app-store";
import { Component, lazy, Suspense, type ReactNode, type ErrorInfo } from "react";

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
    <div className="flex h-full items-center justify-center" role="status">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("View crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <h2 className="text-lg font-semibold text-text-1">Something went wrong</h2>
          <p className="max-w-sm text-sm text-text-3">
            The view encountered an error. Try refreshing or switching to a different view.
          </p>
          <button
            onClick={() => {
              this.setState({ error: null });
              useAppStore.getState().setView("dashboard");
            }}
            className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            Back to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const view = useAppStore((s) => s.view);
  const View = views[view];

  return (
    <AppShell>
      <ErrorBoundary>
        <Suspense fallback={<Loading />}>
          <View />
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}
