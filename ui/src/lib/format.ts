export function timeSince(iso: string): string {
  if (!iso || iso.startsWith("0001")) return "\u2014";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "just now";
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function formatDuration(d: number | undefined): string {
  if (d === undefined) return "";
  if (d < 0.001) return "<1ms";
  if (d < 1) return `${Math.round(d * 1000)}ms`;
  return `${d.toFixed(2)}s`;
}

export function esc(s: string): string {
  const el = document.createElement("span");
  el.textContent = s;
  return el.innerHTML;
}

/** Compact wall time for log rows (24h), or dash if missing/invalid. */
export function formatLogTime(iso?: string): string {
  if (!iso || iso.startsWith("0001")) return "\u2014";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
