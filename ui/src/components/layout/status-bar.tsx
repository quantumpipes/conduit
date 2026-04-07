import { cn } from "@/lib/cn";

interface StatusBarProps {
  dnsOk?: boolean;
  caddyOk?: boolean;
  servicesUp?: number;
  servicesTotal?: number;
  certsValid?: number;
  lastAuditAction?: string;
  lastAuditTime?: string;
  serversOnline?: number;
  loading?: boolean;
}

function Dot({ ok, loading }: { ok?: boolean; loading?: boolean }) {
  const label = loading ? "checking" : ok ? "healthy" : "unhealthy";
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
        loading && "animate-pulse-slow bg-warning",
        !loading && ok && "bg-success shadow-[0_0_4px_var(--color-success)]",
        !loading && !ok && "bg-error",
      )}
      role="img"
      aria-label={label}
    />
  );
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("flex items-center gap-1.5 font-medium text-text-3", className)}>
      {children}
    </span>
  );
}

function Sep() {
  return <span className="h-3 w-px bg-border" />;
}

export function StatusBar({
  dnsOk,
  caddyOk,
  servicesUp = 0,
  servicesTotal = 0,
  certsValid = 0,
  lastAuditAction,
  lastAuditTime,
  serversOnline = 0,
  loading = false,
}: StatusBarProps) {
  if (loading) {
    return (
      <div className="flex h-10 shrink-0 items-center border-b border-border bg-surface-1 px-5">
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <Dot loading />
          <span>Connecting...</span>
        </div>
      </div>
    );
  }

  const allServicesUp = servicesUp === servicesTotal && servicesTotal > 0;

  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-surface-1 px-5">
      <div className="flex items-center gap-3 text-[11px]">
        <Pill><Dot ok={dnsOk} /> DNS</Pill>
        <Pill><Dot ok={caddyOk} /> Caddy</Pill>
        <Sep />
        {servicesTotal > 0 ? (
          <Pill>
            <Dot ok={allServicesUp} loading={!allServicesUp && servicesUp > 0} />
            {servicesUp}/{servicesTotal} up
          </Pill>
        ) : (
          <Pill><Dot ok={false} /> No services</Pill>
        )}
        <Pill>
          <Dot ok={certsValid > 0} />
          {certsValid} cert{certsValid !== 1 ? "s" : ""} valid
        </Pill>
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        {lastAuditAction && (
          <Pill className="text-text-muted">
            {lastAuditAction}
            {lastAuditTime && <span className="ml-1">{lastAuditTime}</span>}
          </Pill>
        )}
        {serversOnline > 0 && (
          <>
            <Sep />
            <Pill className="text-tab-servers-text">
              {serversOnline} server{serversOnline !== 1 ? "s" : ""} online
            </Pill>
          </>
        )}
      </div>
    </div>
  );
}
