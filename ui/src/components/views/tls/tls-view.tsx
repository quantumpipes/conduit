import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, RefreshCw, Eye, ShieldCheck } from "lucide-react";
import { tlsApi } from "@/api/tls";
import { EmptyState } from "@/components/shared/empty-state";
import { SlideOver } from "@/components/shared/slide-over";
import { CopyButton } from "@/components/shared/copy-button";
import { useToast } from "@/components/shared/toast";
import { cn } from "@/lib/cn";
import type { TlsCert, CaInfo } from "@/lib/types";

export default function TlsView() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [inspecting, setInspecting] = useState<TlsCert | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["tls-certs"],
    queryFn: tlsApi.list,
    refetchInterval: 15_000,
  });

  const { data: caData } = useQuery({
    queryKey: ["tls-ca"],
    queryFn: tlsApi.getCaInfo,
  });

  const certs = data?.certs ?? [];
  const ca: CaInfo | null = caData?.ca ?? null;

  const validCount = certs.filter((c: TlsCert) => c.status === "valid").length;
  const expiringCount = certs.filter((c: TlsCert) => c.status === "expiring").length;
  const expiredCount = certs.filter((c: TlsCert) => c.status === "expired").length;

  const trustCaMut = useMutation({
    mutationFn: () => tlsApi.trust(),
    onSuccess: () => toast("CA certificate trusted in system store"),
    onError: (e: Error) => toast(e.message, "error"),
  });

  const rotateMut = useMutation({
    mutationFn: (name: string) => tlsApi.rotate(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tls-certs"] });
      toast("Certificate rotated");
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  return (
    <div className="h-full overflow-y-auto bg-surface-0 p-6">
      <div className="mx-auto max-w-5xl animate-fade-in">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="mb-1 text-xl font-bold">TLS TlsCerts</h1>
            <p className="text-sm text-text-3">
              Internal CA and service certificate management
            </p>
          </div>
          <button
            onClick={() => trustCaMut.mutate()}
            disabled={trustCaMut.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <ShieldCheck size={14} /> Trust CA
          </button>
        </div>

        {/* Stats row */}
        <div className="mb-6 grid grid-cols-4 gap-3">
          <MiniStat label="Valid" value={validCount} color="text-success" />
          <MiniStat label="Expiring Soon" value={expiringCount} color="text-warning" />
          <MiniStat label="Expired" value={expiredCount} color="text-error" />
          <MiniStat label="Total" value={certs.length} color="text-text-1" />
        </div>

        {/* CA info */}
        {ca && (
          <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Shield size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-text-1">Internal CA</h3>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
              <p>
                <span className="text-text-muted">Issuer: </span>
                <span className="text-text-2">{ca.issuer}</span>
              </p>
              <p>
                <span className="text-text-muted">Valid Until: </span>
                <span className="text-text-2">{ca.not_after}</span>
              </p>
              <p>
                <span className="text-text-muted">Algorithm: </span>
                <span className="font-mono text-text-2">{ca.algorithm ?? "Ed25519"}</span>
              </p>
              <p className="flex items-center gap-1">
                <span className="text-text-muted">Fingerprint: </span>
                <span className="truncate font-mono text-text-2">
                  {ca.fingerprint?.slice(0, 24)}...
                </span>
                {ca.fingerprint && <CopyButton text={ca.fingerprint} />}
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {isPending && <EmptyState loading title="Loading certificates..." className="py-16" />}

        {/* Error */}
        {isError && !isPending && (
          <EmptyState
            title="Could not load certificates"
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
        {!isPending && !isError && certs.length === 0 && (
          <EmptyState
            icon={<Shield size={40} />}
            title="No certificates issued"
            description="TlsCerts are issued automatically when you register a TLS-enabled service."
            className="py-16"
          />
        )}

        {/* TlsCert grid */}
        {!isPending && !isError && certs.length > 0 && (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
          >
            {certs.map((cert: TlsCert) => (
              <CertCard
                key={cert.name}
                cert={cert}
                onInspect={() => setInspecting(cert)}
                onRotate={() => rotateMut.mutate(cert.name)}
                rotating={rotateMut.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Inspect SlideOver */}
      <SlideOver
        open={inspecting !== null}
        onClose={() => setInspecting(null)}
        title={inspecting ? `Certificate: ${inspecting.name}` : "Certificate Details"}
      >
        {inspecting && <CertDetails cert={inspecting} />}
      </SlideOver>
    </div>
  );
}

function CertCard({
  cert,
  onInspect,
  onRotate,
  rotating,
}: {
  cert: TlsCert;
  onInspect: () => void;
  onRotate: () => void;
  rotating: boolean;
}) {
  const statusColors: Record<string, string> = {
    valid: "border-success/30 bg-success/8 text-success",
    expiring: "border-warning/30 bg-warning/8 text-warning",
    expired: "border-error/30 bg-error/8 text-error",
  };

  return (
    <div className="group rounded-xl border border-border bg-surface-1 p-4 transition-colors hover:border-surface-4">
      <div className="mb-3 flex items-center gap-2.5">
        <h3 className="truncate text-[15px] font-semibold text-text-1">
          {cert.name}
        </h3>
        <span
          className={cn(
            "ml-auto shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase",
            statusColors[cert.status] ?? "border-border bg-surface-2 text-text-muted",
          )}
        >
          {cert.status}
        </span>
      </div>

      <div className="mb-3 space-y-1.5 text-xs text-text-3">
        <p>
          <span className="text-text-muted">Domain: </span>
          <span className="font-mono">{cert.domain}</span>
        </p>
        <p>
          <span className="text-text-muted">Not Before: </span>
          {cert.not_before}
        </p>
        <p>
          <span className="text-text-muted">Not After: </span>
          {cert.not_after}
        </p>
        <p>
          <span className="text-text-muted">Algorithm: </span>
          <span className="font-mono">{cert.algorithm ?? "Ed25519"}</span>
        </p>
        {cert.fingerprint && (
          <p className="flex items-center gap-1">
            <span className="text-text-muted">Fingerprint: </span>
            <span className="truncate font-mono">{cert.fingerprint.slice(0, 20)}...</span>
            <CopyButton text={cert.fingerprint} />
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-3">
        <button
          onClick={onInspect}
          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-text-3 transition-colors hover:bg-surface-2"
        >
          <Eye size={11} /> Inspect
        </button>
        <button
          onClick={onRotate}
          disabled={rotating}
          className="ml-auto flex items-center gap-1 rounded-md border border-primary/30 px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
        >
          <RefreshCw size={11} /> Rotate
        </button>
      </div>
    </div>
  );
}

function CertDetails({ cert }: { cert: TlsCert }) {
  return (
    <div className="space-y-4">
      <DetailRow label="Service" value={cert.name} />
      <DetailRow label="Domain" value={cert.domain} mono />
      <DetailRow label="Status" value={cert.status} />
      <DetailRow label="Not Before" value={cert.not_before} />
      <DetailRow label="Not After" value={cert.not_after} />
      <DetailRow label="Algorithm" value={cert.algorithm ?? "Ed25519"} mono />
      {cert.fingerprint && (
        <div>
          <p className="mb-1 text-xs font-medium text-text-muted">Fingerprint</p>
          <p className="break-all font-mono text-xs text-text-2">{cert.fingerprint}</p>
        </div>
      )}
      {cert.pem && (
        <div>
          <p className="mb-1 text-xs font-medium text-text-muted">PEM</p>
          <pre className="max-h-60 overflow-auto rounded-lg border border-border bg-surface-0 p-3 font-mono text-[11px] text-text-3">
            {cert.pem}
          </pre>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="mb-0.5 text-xs font-medium text-text-muted">{label}</p>
      <p className={cn("text-sm text-text-1", mono && "font-mono")}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-center">
      <p className={cn("text-lg font-bold tabular-nums", color)}>{value}</p>
      <p className="text-[11px] text-text-muted">{label}</p>
    </div>
  );
}
