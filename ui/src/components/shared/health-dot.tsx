import { cn } from "@/lib/cn";

type HealthState = "up" | "degraded" | "down";

interface HealthDotProps {
  // Accept any string: the backend/health-checker vocabulary (healthy, unknown,
  // ...) differs from the UI's, so we normalize rather than crash on a mismatch.
  status?: string;
  responseTime?: number | null;
  size?: "sm" | "md";
}

// Map the various status vocabularies (registry, health-checker, UI) to the
// three render states. Anything unrecognized returns undefined -> "Checking...".
function normalizeStatus(status?: string): HealthState | undefined {
  switch (status?.toLowerCase()) {
    case "up":
    case "healthy":
    case "ok":
    case "active":
      return "up";
    case "degraded":
    case "slow":
    case "warning":
      return "degraded";
    case "down":
    case "unhealthy":
    case "dead":
    case "error":
      return "down";
    default:
      return undefined; // unknown / null / "checking"
  }
}

export function HealthDot({ status, responseTime, size = "md" }: HealthDotProps) {
  const dotSize = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  const state = normalizeStatus(status);

  if (!state) {
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
  }[state];

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
