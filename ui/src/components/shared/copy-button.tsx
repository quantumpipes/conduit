import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/cn";

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export function CopyButton({ text, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      onClick={(e) => { e.stopPropagation(); copy(); }}
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-all",
        copied
          ? "text-success"
          : "text-text-muted opacity-0 hover:bg-surface-3 hover:text-text-2 hover:opacity-100 group-hover:opacity-60",
        className,
      )}
      title="Copy"
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {label && <span>{copied ? "Copied!" : label}</span>}
    </button>
  );
}
