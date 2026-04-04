import { cn } from "@/lib/cn";

interface HealthDotProps {
  status?: "up" | "degraded" | "down";
  responseTime?: number | null;
  size?: "sm" | "md";
}

export function HealthDot({ status, responseTime, size = "md" }: HealthDotProps) {
  const dotSize = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";

  if (!status) {
    return (
      <span className="flex items-center gap-1.5">
        <span className={cn(dotSize, "animate-pulse-slow rounded-full bg-surface-4")} />
        {size === "md" && <span className="text-xs text-text-muted">Checking...</span>}
      </span>
    );
  }

  const config = {
    up: { dot: "bg-success shadow-[0_0_6px_var(--color-success)]", label: "Up", color: "text-success" },
    degraded: { dot: "bg-warning", label: "Slow", color: "text-warning" },
    down: { dot: "bg-error", label: "Down", color: "text-error" },
  }[status];

  return (
    <span className="flex items-center gap-1.5">
      <span className={cn(dotSize, "rounded-full", config.dot)} />
      {size === "md" && (
        <span className={cn("text-xs font-medium", config.color)}>
          {config.label}
          {responseTime != null && <span className="ml-1 text-text-muted">{responseTime}ms</span>}
        </span>
      )}
    </span>
  );
}
