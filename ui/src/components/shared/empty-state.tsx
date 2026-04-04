import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

export function EmptyState({ icon, title, description, action, loading, className }: EmptyStateProps) {
  if (loading) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 py-20 text-center", className)}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        {title && <p className="text-sm text-text-3">{title}</p>}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-20 text-center", className)}>
      {icon && <div className="text-surface-4">{icon}</div>}
      {title && <h3 className="text-[15px] font-semibold text-text-2">{title}</h3>}
      {description && <p className="max-w-xs text-sm leading-relaxed text-text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
