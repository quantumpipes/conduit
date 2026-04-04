import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  XCircle,
  Shield,
  Globe,
  Server,
  Network,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import { servicesApi } from "@/api/services";
import { tlsApi } from "@/api/tls";
import { dnsApi } from "@/api/dns";
import { serversApi } from "@/api/servers";
import { auditApi } from "@/api/audit";
import { HealthDot } from "@/components/shared/health-dot";
import { EmptyState } from "@/components/shared/empty-state";
import { useAppStore } from "@/stores/app-store";
import { timeSince } from "@/lib/format";
import { cn } from "@/lib/cn";

export default function DashboardView() {
  const setView = useAppStore((s) => s.setView);

  const { data: servicesData, isPending: servicesLoading } = useQuery({
    queryKey: ["services"],
    queryFn: servicesApi.list,
    refetchInterval: 15_000,
  });

  const { data: tlsData } = useQuery({
    queryKey: ["tls-certs"],
    queryFn: tlsApi.listCerts,
    refetchInterval: 15_000,
  });

  const { data: dnsData } = useQuery({
    queryKey: ["dns-entries"],
    queryFn: dnsApi.listEntries,
    refetchInterval: 15_000,
  });

  const { data: serversData } = useQuery({
    queryKey: ["servers"],
    queryFn: serversApi.list,
    refetchInterval: 15_000,
  });

  const { data: auditData } = useQuery({
    queryKey: ["audit-recent"],
    queryFn: () => auditApi.read(5),
  });

  const services = servicesData?.services ?? [];
  const certs = tlsData?.certificates ?? [];
  const dnsEntries = dnsData?.entries ?? [];
  const servers = serversData?.servers ?? [];
  const auditEntries = auditData?.entries ?? [];

  const servicesUp = services.filter((s) => s.health_status === "up").length;
  const certsValid = certs.filter((c) => c.status === "valid").length;

  return (
    <div className="h-full overflow-y-auto bg-surface-0 p-6">
      <div className="mx-auto max-w-5xl animate-fade-in">
        <h1 className="mb-1 text-xl font-bold">Dashboard</h1>
        <p className="mb-6 text-sm text-text-3">
          Conduit deployment health and quick actions
        </p>

        {/* Stat cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            icon={<Activity size={18} className="text-success" />}
            label="Services Up"
            value={servicesUp}
            total={services.length}
            bg="bg-success/10"
            color={servicesUp === services.length ? "text-success" : "text-warning"}
          />
          <StatCard
            icon={<Shield size={18} className="text-primary" />}
            label="Certs Valid"
            value={certsValid}
            total={certs.length}
            bg="bg-primary/10"
            color={certsValid === certs.length ? "text-success" : "text-warning"}
          />
          <StatCard
            icon={<Globe size={18} className="text-accent" />}
            label="DNS Entries"
            value={dnsEntries.length}
            bg="bg-accent/10"
            color="text-text-1"
          />
          <StatCard
            icon={<Server size={18} className="text-info" />}
            label="Servers Online"
            value={servers.filter((s) => s.status === "up").length}
            total={servers.length}
            bg="bg-info/10"
            color={
              servers.length > 0 &&
              servers.every((s) => s.status === "up")
                ? "text-success"
                : "text-warning"
            }
          />
        </div>

        {/* Services health grid */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Services Health</h2>
            <button
              onClick={() => setView("services")}
              className="text-xs text-primary hover:underline"
            >
              View all
            </button>
          </div>

          {servicesLoading && (
            <EmptyState loading title="Loading services..." className="py-10" />
          )}

          {!servicesLoading && services.length === 0 && (
            <div className="rounded-xl border border-border bg-surface-1 px-4 py-8 text-center text-sm text-text-muted">
              No services registered yet
            </div>
          )}

          {!servicesLoading && services.length > 0 && (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
            >
              {services.slice(0, 6).map((svc) => (
                <div
                  key={svc.name}
                  className="rounded-xl border border-border bg-surface-1 p-3.5"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <HealthDot status={svc.health_status} size="sm" />
                    <span className="truncate text-sm font-semibold text-text-1">
                      {svc.name}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-text-3">
                    <p>
                      {svc.name}.{svc.domain ?? "internal"}
                    </p>
                    {svc.response_time != null && (
                      <p className="font-mono">{svc.response_time}ms</p>
                    )}
                    {svc.last_health_check && (
                      <p className="text-text-muted">
                        Checked {timeSince(svc.last_health_check)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Recent audit */}
          <div className="rounded-xl border border-border bg-surface-1 p-4">
            <h3 className="mb-3 text-sm font-semibold">Recent Audit</h3>
            {auditEntries.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-muted">
                No audit entries yet
              </p>
            ) : (
              <div className="space-y-2">
                {auditEntries.map((entry, i) => (
                  <div
                    key={`${entry.timestamp}-${i}`}
                    className="flex items-start gap-2 rounded-lg bg-surface-0 p-2.5"
                  >
                    <span
                      className={cn(
                        "mt-1 h-2 w-2 shrink-0 rounded-full",
                        entry.status === "success" ? "bg-success" : "bg-error",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs text-text-1">
                        {entry.action}
                      </p>
                      <p className="mt-0.5 text-[11px] text-text-muted">
                        {entry.message && `${entry.message} · `}
                        {entry.user} · {timeSince(entry.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="rounded-xl border border-border bg-surface-1 p-4">
            <h3 className="mb-3 text-sm font-semibold">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <NavCard
                icon={<ClipboardList size={16} />}
                label="Register Service"
                onClick={() => setView("services")}
              />
              <NavCard
                icon={<Shield size={16} />}
                label="Manage Certs"
                onClick={() => setView("tls")}
              />
              <NavCard
                icon={<Globe size={16} />}
                label="Check DNS"
                onClick={() => setView("dns")}
              />
              <NavCard
                icon={<Server size={16} />}
                label="Monitor Servers"
                onClick={() => setView("servers")}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  total,
  bg,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  total?: number;
  bg: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-1 px-4 py-3">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", bg)}>
        {icon}
      </div>
      <div>
        <p className={cn("text-xl font-bold tabular-nums", color)}>
          {value}
          {total != null && (
            <span className="text-sm font-normal text-text-muted">/{total}</span>
          )}
        </p>
        <p className="text-xs text-text-3">{label}</p>
      </div>
    </div>
  );
}

function NavCard({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-0 px-3 py-2.5 text-xs font-medium text-text-2 transition-all hover:border-surface-4 hover:bg-surface-2"
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      <ArrowRight size={12} className="text-text-muted" />
    </button>
  );
}
