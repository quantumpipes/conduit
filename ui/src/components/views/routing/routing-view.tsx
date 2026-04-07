import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Network, RefreshCw, Activity, AlertTriangle, XCircle } from "lucide-react";
import { routingApi } from "@/api/routing";
import { HealthDot } from "@/components/shared/health-dot";
import { EmptyState } from "@/components/shared/empty-state";
import { ViewBlankSlate } from "@/components/shared/view-blank-slate";
import { useToast } from "@/components/shared/toast";
import { timeSince } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Route } from "@/lib/types";

export default function RoutingView() {
  const { toast } = useToast();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["routes"],
    queryFn: routingApi.list,
    refetchInterval: 15_000,
  });

  const routes = data?.routes ?? [];

  const stats = useMemo(() => {
    let up = 0;
    let degraded = 0;
    let down = 0;
    for (const r of routes) {
      if (r.health_status === "up") up++;
      else if (r.health_status === "degraded") degraded++;
      else down++;
    }
    return { total: routes.length, up, degraded, down };
  }, [routes]);

  const reloadMut = useMutation({
    mutationFn: () => routingApi.reload(),
    onSuccess: () => toast("Caddy configuration reloaded"),
    onError: (e: Error) => toast(e.message, "error"),
  });

  return (
    <div className="h-full overflow-y-auto bg-surface-0 p-6">
      <div className="mx-auto max-w-5xl animate-fade-in">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="mb-1 text-xl font-bold">Routing</h1>
            <p className="text-sm text-text-3">
              Reverse proxy routes managed by Caddy
            </p>
          </div>
          <button
            onClick={() => reloadMut.mutate()}
            disabled={reloadMut.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-warning/40 px-3 py-2 text-sm font-medium text-warning transition-colors hover:bg-warning/10 disabled:opacity-50"
          >
            <RefreshCw size={14} className={cn(reloadMut.isPending && "animate-spin")} />
            Reload Caddy
          </button>
        </div>

        {/* Stats row */}
        <div className="mb-6 grid grid-cols-4 gap-3">
          <StatPill
            icon={<Network size={16} />}
            label="Routes"
            value={stats.total}
            color="text-text-1"
          />
          <StatPill
            icon={<Activity size={16} className="text-success" />}
            label="Up"
            value={stats.up}
            color="text-success"
          />
          <StatPill
            icon={<AlertTriangle size={16} className="text-warning" />}
            label="Degraded"
            value={stats.degraded}
            color="text-warning"
          />
          <StatPill
            icon={<XCircle size={16} className="text-error" />}
            label="Down"
            value={stats.down}
            color="text-error"
          />
        </div>

        {/* Loading */}
        {isPending && <EmptyState loading title="Loading routes..." className="py-16" />}

        {/* Error */}
        {isError && !isPending && (
          <EmptyState
            title="Could not load routes"
            description={error instanceof Error ? error.message : "Request failed"}
            action={
              <button
                onClick={() => void refetch()}
                className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-2 hover:bg-surface-3"
              >
                Retry
              </button>
            }
            className="py-16"
          />
        )}

        {/* Empty */}
        {!isPending && !isError && routes.length === 0 && (
          <ViewBlankSlate
            icon={<Network size={28} />}
            title="No routes configured"
            tagline="Caddy reverse proxy, fully automated"
            description="Routes are generated from the service registry. Register a service and Conduit configures Caddy with TLS termination, health-aware routing, and load balancing."
            features={[
              { label: "Auto-Generated", description: "Routes from service registry" },
              { label: "TLS Termination", description: "HTTPS handled at the edge" },
              { label: "Health-Aware", description: "Routes skip unhealthy upstreams" },
              { label: "Hot Reload", description: "Config changes without downtime" },
            ]}
            command="make conduit-register NAME=grafana HOST=10.0.1.50:3000"
            commandLabel="Routes appear after registering a service"
            actionLabel="Register a Service"
            actionView="services"
            color="text-tab-routing-text"
            bgColor="bg-tab-routing"
            accentBorder="border-tab-routing-text/20"
          />
        )}

        {/* Route cards */}
        {!isPending && !isError && routes.length > 0 && (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
          >
            {routes.map((route) => (
              <RouteCard key={route.name} route={route} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RouteCard({ route }: { route: Route }) {
  return (
    <div className="group rounded-xl border border-border bg-surface-1 p-4 transition-colors hover:border-surface-4">
      {/* Domain + health */}
      <div className="mb-3 flex items-center gap-2.5">
        <HealthDot status={route.health_status === "unknown" ? undefined : route.health_status} size="sm" />
        <h3 className="truncate text-[15px] font-semibold text-text-1">
          {route.domain}
        </h3>
        <span
          className={cn(
            "ml-auto shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase",
            route.tls
              ? "border-success/30 bg-success/8 text-success"
              : "border-border bg-surface-2 text-text-muted",
          )}
        >
          {route.tls ? "TLS" : "Plain"}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-1.5 text-xs text-text-3">
        <p>
          <span className="text-text-muted">Upstream: </span>
          <span className="font-mono">{route.upstream}</span>
        </p>
        {route.response_time != null && (
          <p>
            <span className="text-text-muted">Response: </span>
            <span className="font-mono">{route.response_time}ms</span>
          </p>
        )}
        {route.last_checked && (
          <p>
            <span className="text-text-muted">Last check: </span>
            {timeSince(route.last_checked)}
          </p>
        )}
      </div>
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-1 px-4 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2">
        {icon}
      </div>
      <div>
        <p className={cn("text-lg font-bold tabular-nums", color)}>{value}</p>
        <p className="text-[11px] text-text-muted">{label}</p>
      </div>
    </div>
  );
}
