import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, Eraser, Search } from "lucide-react";
import { dnsApi } from "@/api/dns";
import { EmptyState } from "@/components/shared/empty-state";
import { CopyButton } from "@/components/shared/copy-button";
import { useToast } from "@/components/shared/toast";
import { cn } from "@/lib/cn";
import { timeSince } from "@/lib/format";
import type { DnsEntry } from "@/lib/types";

export default function DnsView() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [resolveQuery, setResolveQuery] = useState("");
  const [resolveResult, setResolveResult] = useState<string | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["dns-entries"],
    queryFn: dnsApi.listEntries,
    refetchInterval: 15_000,
  });

  const entries = data?.entries ?? [];

  const conduitCount = entries.filter((e) => e.source === "conduit").length;
  const staticCount = entries.filter((e) => e.source === "static").length;
  const systemCount = entries.filter((e) => e.source === "system").length;

  const flushMut = useMutation({
    mutationFn: () => dnsApi.flush(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dns-entries"] });
      toast("DNS cache flushed");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  const resolveMut = useMutation({
    mutationFn: (domain: string) => dnsApi.resolve(domain),
    onSuccess: (data) => {
      setResolveResult(data.ip ?? "No record found");
    },
    onError: (e: Error) => {
      setResolveResult(`Error: ${e.message}`);
    },
  });

  function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    const q = resolveQuery.trim();
    if (!q) return;
    setResolveResult(null);
    resolveMut.mutate(q);
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-0 p-6">
      <div className="mx-auto max-w-5xl animate-fade-in">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="mb-1 text-xl font-bold">DNS</h1>
            <p className="text-sm text-text-3">
              Manage DNS entries and test resolution
            </p>
          </div>
          <button
            onClick={() => flushMut.mutate()}
            disabled={flushMut.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-warning/40 px-3 py-2 text-sm font-medium text-warning transition-colors hover:bg-warning/10 disabled:opacity-50"
          >
            <Eraser size={14} /> Flush Cache
          </button>
        </div>

        {/* Stats row */}
        <div className="mb-6 grid grid-cols-4 gap-3">
          <MiniStat label="Total" value={entries.length} />
          <MiniStat label="Conduit" value={conduitCount} />
          <MiniStat label="Static" value={staticCount} />
          <MiniStat label="System" value={systemCount} />
        </div>

        {/* Resolve tester */}
        <div className="mb-6 rounded-xl border border-border bg-surface-1 p-4">
          <h3 className="mb-3 text-sm font-semibold">Resolve Tester</h3>
          <form onSubmit={handleResolve} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={resolveQuery}
                onChange={(e) => setResolveQuery(e.target.value)}
                placeholder="e.g. qp-core.qp.local"
                className="w-full rounded-lg border border-border bg-surface-0 py-2 pl-9 pr-3 font-mono text-sm text-text-1 placeholder:text-text-muted focus:border-primary focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={resolveMut.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              Resolve
            </button>
          </form>
          {resolveResult && (
            <div
              className={cn(
                "mt-3 rounded-lg px-3 py-2 font-mono text-sm",
                resolveResult.startsWith("Error")
                  ? "border border-error/30 bg-error/8 text-error"
                  : "border border-success/30 bg-success/8 text-success",
              )}
            >
              {resolveResult}
            </div>
          )}
        </div>

        {/* Loading */}
        {isPending && <EmptyState loading title="Loading DNS entries..." className="py-16" />}

        {/* Error */}
        {isError && !isPending && (
          <EmptyState
            title="Could not load DNS entries"
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
        {!isPending && !isError && entries.length === 0 && (
          <EmptyState
            icon={<Globe size={40} />}
            title="No DNS entries"
            description="Register a service to automatically create DNS entries."
            className="py-16"
          />
        )}

        {/* DNS entries list */}
        {!isPending && !isError && entries.length > 0 && (
          <div className="rounded-xl border border-border bg-surface-1">
            <div className="grid grid-cols-[1fr_140px_100px_100px] gap-2 border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              <span>Domain</span>
              <span>IP Address</span>
              <span>Source</span>
              <span>Created</span>
            </div>
            <div className="divide-y divide-border">
              {entries.map((entry, i) => (
                <DnsRow key={`${entry.domain}-${i}`} entry={entry} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DnsRow({ entry }: { entry: DnsEntry }) {
  const sourceColors: Record<string, string> = {
    conduit: "border-primary/30 bg-primary/8 text-primary",
    static: "border-accent/30 bg-accent/8 text-accent",
    system: "border-border bg-surface-2 text-text-muted",
  };

  return (
    <div className="group grid grid-cols-[1fr_140px_100px_100px] items-center gap-2 px-4 py-2.5">
      <span className="flex items-center gap-1 truncate font-mono text-sm text-text-1">
        {entry.domain}
        <CopyButton text={entry.domain} />
      </span>
      <span className="flex items-center gap-1 font-mono text-sm text-text-2">
        {entry.ip}
        <CopyButton text={entry.ip} />
      </span>
      <span>
        <span
          className={cn(
            "inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase",
            sourceColors[entry.source] ?? sourceColors["system"],
          )}
        >
          {entry.source}
        </span>
      </span>
      <span className="text-xs text-text-muted">
        {entry.created_at ? timeSince(entry.created_at) : ""}
      </span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-center">
      <p className="text-lg font-bold tabular-nums text-text-1">{value}</p>
      <p className="text-[11px] text-text-muted">{label}</p>
    </div>
  );
}
