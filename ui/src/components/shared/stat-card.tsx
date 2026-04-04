import { cn } from "@/lib/cn";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: "up" | "down" | "flat";
  trendLabel?: string;
  className?: string;
}

export function StatCard({ icon, label, value, trend, trendLabel, className }: StatCardProps) {
  const trendConfig = {
    up: { icon: TrendingUp, color: "text-success" },
    down: { icon: TrendingDown, color: "text-error" },
    flat: { icon: Minus, color: "text-text-muted" },
  };

  const trendInfo = trend ? trendConfig[trend] : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-surface-1 p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
          {label}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-text-3">
          {icon}
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-semibold tabular-nums text-text-1">
          {value}
        </span>
        {trendInfo && (
          <span className={cn("flex items-center gap-1 text-[11px] font-medium", trendInfo.color)}>
            <trendInfo.icon size={12} />
            {trendLabel}
          </span>
        )}
      </div>
    </div>
  );
}
