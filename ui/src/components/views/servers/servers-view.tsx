import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Server, ChevronDown, ChevronRight, RefreshCw, Cpu, HardDrive, MemoryStick } from "lucide-react";
import { serversApi } from "@/api/servers";
import { HealthDot } from "@/components/shared/health-dot";
import { EmptyState } from "@/components/shared/empty-state";
import { ViewBlankSlate } from "@/components/shared/view-blank-slate";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";
import type { ServerStats, GpuInfo, ContainerInfo } from "@/lib/types";

export default function ServersView() {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["servers"],
    queryFn: serversApi.list,
    refetchInterval: 30_000,
  });

  const servers = data?.servers ?? [];

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="h-full overflow-y-auto bg-surface-0 p-6">
      <div className="mx-auto max-w-5xl animate-fade-in">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="mb-1 text-xl font-bold">Servers</h1>
            <p className="text-sm text-text-3">
              {servers.length} server{servers.length !== 1 ? "s" : ""} in the deployment
            </p>
          </div>
          <button
            onClick={() => void refetch()}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-3 transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={cn(isFetching && !isPending && "animate-spin")}
            />
            Refresh
          </button>
        </div>

        {/* Loading */}
        {isPending && <EmptyState loading title="Loading servers..." className="py-16" />}

        {/* Error */}
        {isError && !isPending && (
          <EmptyState
            icon={<Server size={40} className="text-text-muted" />}
            title="Could not load servers"
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
        {!isPending && !isError && servers.length === 0 && (
          <ViewBlankSlate
            icon={<Server size={28} />}
            title="No servers reporting"
            tagline="Full-stack hardware observability"
            description="Servers report CPU, memory, disk, GPU utilization, and container health to Conduit. One pane of glass for your entire fleet, from bare metal to containers."
            features={[
              { label: "CPU / Memory / Disk", description: "Real-time resource monitoring" },
              { label: "GPU Telemetry", description: "Temp, utilization, VRAM, power" },
              { label: "Container Health", description: "Docker state, CPU, memory per container" },
              { label: "Auto-Refresh", description: "Live metrics every 30 seconds" },
            ]}
            command="make conduit-monitor"
            commandLabel="Servers appear once they report metrics"
            actionLabel="View Dashboard"
            actionView="dashboard"
            color="text-tab-servers-text"
            bgColor="bg-tab-servers"
            accentBorder="border-tab-servers-text/20"
          />
        )}

        {/* Server cards */}
        {!isPending && !isError && servers.length > 0 && (
          <div className="space-y-3">
            {servers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                expanded={expandedIds.has(server.id)}
                onToggle={() => toggleExpanded(server.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ServerCard({
  server,
  expanded,
  onToggle,
}: {
  server: ServerStats;
  expanded: boolean;
  onToggle: () => void;
}) {
  const status = server.status === "up" ? "up" : server.status === "degraded" ? "degraded" : "down";

  return (
    <div className="rounded-xl border border-border bg-surface-1 transition-colors hover:border-surface-4">
      {/* Collapsed header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-text-3" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-text-3" />
        )}
        <HealthDot status={status} size="sm" />
        <span className="text-sm font-semibold text-text-1">{server.name}</span>
        <span className="font-mono text-xs text-text-muted">{server.host}</span>

        {/* Quick stats when collapsed */}
        {!expanded && (
          <div className="ml-auto flex items-center gap-4 text-xs text-text-3">
            <QuickStat label="CPU" value={`${server.cpu_percent}%`} />
            <QuickStat label="Mem" value={`${server.memory_percent}%`} />
            <QuickStat label="Disk" value={`${server.disk_percent}%`} />
            {server.gpus && server.gpus.length > 0 && (
              <QuickStat label="GPUs" value={String(server.gpus.length)} />
            )}
          </div>
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          {/* 4-column resource grid */}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <ResourceCard
              icon={<Cpu size={14} className="text-primary" />}
              label="CPU"
              main={`${server.cpu_percent}%`}
              sub={server.cpu_cores ? `${server.cpu_cores} cores` : undefined}
              percent={server.cpu_percent}
            />
            <ResourceCard
              icon={<MemoryStick size={14} className="text-accent" />}
              label="Memory"
              main={`${server.memory_percent}%`}
              sub={
                server.memory_used != null && server.memory_total != null
                  ? `${formatBytes(server.memory_used)} / ${formatBytes(server.memory_total)}`
                  : undefined
              }
              percent={server.memory_percent}
            />
            <ResourceCard
              icon={<HardDrive size={14} className="text-info" />}
              label="Disk"
              main={`${server.disk_percent}%`}
              sub={
                server.disk_used != null && server.disk_total != null
                  ? `${formatBytes(server.disk_used)} / ${formatBytes(server.disk_total)}`
                  : undefined
              }
              percent={server.disk_percent}
            />
            <ResourceCard
              icon={<Server size={14} className="text-success" />}
              label="Uptime"
              main={server.uptime ?? "N/A"}
            />
          </div>

          {/* GPUs */}
          {server.gpus && server.gpus.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-2 text-xs font-semibold text-text-2">
                GPUs ({server.gpus.length})
              </h4>
              <div className="space-y-2">
                {server.gpus.map((gpu: GpuInfo, i: number) => (
                  <GpuCard key={i} gpu={gpu} />
                ))}
              </div>
            </div>
          )}

          {/* Containers */}
          {server.containers && server.containers.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold text-text-2">
                Containers ({server.containers.length})
              </h4>
              <div className="space-y-1">
                {server.containers.map((c: ContainerInfo) => (
                  <ContainerRow key={c.id} container={c} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-text-muted">{label} </span>
      <span className="font-mono font-medium">{value}</span>
    </span>
  );
}

function ResourceCard({
  icon,
  label,
  main,
  sub,
  percent,
}: {
  icon: React.ReactNode;
  label: string;
  main: string;
  sub?: string;
  percent?: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-0 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        {icon}
        <span className="text-[11px] font-semibold text-text-2">{label}</span>
      </div>
      <p className="text-lg font-bold tabular-nums text-text-1">{main}</p>
      {sub && <p className="mt-0.5 text-[11px] text-text-muted">{sub}</p>}
      {percent != null && (
        <div
          className="mt-2 h-1.5 rounded-full bg-surface-3"
          role="progressbar"
          aria-valuenow={Math.round(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} ${Math.round(percent)}%`}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all",
              percent > 90 ? "bg-error" : percent > 70 ? "bg-warning" : "bg-success",
            )}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function GpuCard({ gpu }: { gpu: GpuInfo }) {
  return (
    <div className="rounded-lg border border-border bg-surface-0 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-text-1">{gpu.name}</span>
        {gpu.temperature != null && (
          <span
            className={cn(
              "font-mono text-[11px] font-medium",
              gpu.temperature > 85 ? "text-error" : gpu.temperature > 70 ? "text-warning" : "text-text-3",
            )}
          >
            {gpu.temperature}°C
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-text-muted">Utilization</p>
          <div className="mt-1 h-1.5 rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(gpu.utilization ?? 0, 100)}%` }}
            />
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-text-3">{gpu.utilization ?? 0}%</p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted">Memory</p>
          <div className="mt-1 h-1.5 rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${Math.min(gpu.memory_percent ?? 0, 100)}%` }}
            />
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-text-3">
            {gpu.memory_used != null && gpu.memory_total != null
              ? `${formatBytes(gpu.memory_used)} / ${formatBytes(gpu.memory_total)}`
              : `${gpu.memory_percent ?? 0}%`}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted">Power</p>
          <p className="mt-1 font-mono text-xs text-text-3">
            {gpu.power_draw != null ? `${gpu.power_draw}W` : "N/A"}
          </p>
        </div>
      </div>
    </div>
  );
}

function ContainerRow({ container }: { container: ContainerInfo }) {
  const stateNorm = container.state.trim().toLowerCase();
  const stateColor =
    stateNorm === "running"
      ? "bg-success"
      : stateNorm === "paused"
        ? "bg-warning"
        : "bg-error";

  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface-0 px-3 py-2">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", stateColor)} />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-1">
        {container.name}
      </span>
      <span className="hidden truncate font-mono text-[11px] text-text-muted md:block">
        {container.image}
      </span>
      {container.cpu_percent != null && (
        <span className="text-[11px] text-text-3">
          CPU {container.cpu_percent}%
        </span>
      )}
      {container.memory_usage != null && (
        <span className="text-[11px] text-text-3">
          {formatBytes(container.memory_usage)}
        </span>
      )}
    </div>
  );
}
