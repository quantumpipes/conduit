import { Terminal, ArrowRight, Layers } from "lucide-react";
import { useAppStore, type View } from "@/stores/app-store";
import { cn } from "@/lib/cn";

interface Feature {
  label: string;
  description: string;
}

interface ViewBlankSlateProps {
  icon: React.ReactNode;
  title: string;
  tagline: string;
  description: string;
  features: Feature[];
  command: string;
  commandLabel: string;
  actionLabel: string;
  actionView?: View;
  onAction?: () => void;
  color: string;
  bgColor: string;
  accentBorder: string;
}

export function ViewBlankSlate({
  icon,
  title,
  tagline,
  description,
  features,
  command,
  commandLabel,
  actionLabel,
  actionView,
  onAction,
  color,
  bgColor,
  accentBorder,
}: ViewBlankSlateProps) {
  const setView = useAppStore((s) => s.setView);

  function handleAction() {
    if (onAction) onAction();
    else if (actionView) setView(actionView);
  }

  return (
    <div className="animate-fade-in flex flex-col items-center py-12 px-4 text-center">
      {/* Icon with glow */}
      <div className="relative mb-5">
        <div
          className={cn(
            "absolute inset-0 rounded-2xl blur-xl opacity-30",
            bgColor,
          )}
        />
        <div
          className={cn(
            "relative flex h-16 w-16 items-center justify-center rounded-2xl border",
            bgColor,
            accentBorder,
          )}
        >
          <div className={color}>{icon}</div>
        </div>
      </div>

      {/* Title */}
      <h2 className="mb-1 text-lg font-bold text-text-1">{title}</h2>
      <p className={cn("mb-4 text-sm font-medium", color)}>{tagline}</p>

      {/* Description */}
      <p className="mb-6 max-w-md text-sm leading-relaxed text-text-3">
        {description}
      </p>

      {/* Feature pills */}
      <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
        {features.map((f) => (
          <div
            key={f.label}
            className="group relative rounded-lg border border-border bg-surface-1 px-3 py-2 text-left transition-colors hover:border-surface-4"
          >
            <p className="text-xs font-semibold text-text-2">{f.label}</p>
            <p className="text-[11px] text-text-muted">{f.description}</p>
          </div>
        ))}
      </div>

      {/* Command */}
      <div className="mb-5 w-full max-w-lg">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-muted">
          {commandLabel}
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2.5">
          <Terminal size={13} className="shrink-0 text-text-muted" />
          <code className="flex-1 truncate text-left font-mono text-xs text-text-3">
            {command}
          </code>
        </div>
      </div>

      {/* Action button */}
      <button
        onClick={handleAction}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all hover:brightness-110",
          bgColor,
          color,
        )}
      >
        {actionLabel}
        <ArrowRight size={14} />
      </button>

      {/* Hint to dashboard */}
      <button
        onClick={() => setView("dashboard")}
        className="mt-4 flex items-center gap-1.5 text-[11px] text-text-muted transition-colors hover:text-text-3"
      >
        <Layers size={11} />
        Back to Dashboard
      </button>
    </div>
  );
}
