import { cn } from "@/lib/cn";

interface ChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}

export function Chip({ label, active, onClick, className }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-0.5 text-xs font-medium transition-all duration-100",
        active
          ? "border-primary/50 bg-primary/10 text-text-1"
          : "border-border bg-transparent text-text-3 hover:bg-surface-2 hover:text-text-2",
        className,
      )}
    >
      {label}
    </button>
  );
}

export function ServiceChip({ service, active, onClick }: { service: string; active: boolean; onClick: () => void }) {
  const colors: Record<string, string> = {
    caddy: active ? "border-success/50 bg-svc-caddy-bg text-svc-caddy" : "",
    postgres: active ? "border-accent/50 bg-svc-postgres-bg text-svc-postgres" : "",
    redis: active ? "border-error/50 bg-svc-redis-bg text-svc-redis" : "",
    dns: active ? "border-info/50 bg-svc-dns-bg text-svc-dns" : "",
    tls: active ? "border-warning/50 bg-svc-tls-bg text-svc-tls" : "",
  };

  return (
    <Chip
      label={service}
      active={active}
      onClick={onClick}
      className={colors[service]}
    />
  );
}
