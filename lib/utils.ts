/** Small collision-resistant id for local objects. */
export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

/** Derive a display title from a file name: "my_novel-v2.txt" -> "My novel v2" */
export function titleFromFileName(name: string): string {
  const base = name
    .replace(/\.(txt|md|epub|pdf)$/i, "")
    .replace(/[_\-+.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base || "Untitled";
}

export function formatNumber(n?: number): string {
  if (n === undefined || isNaN(n)) return "0";
  return n.toLocaleString("en-US");
}

export function formatDate(ts?: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRelative(ts?: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(ts);
}

export function pluralize(n: number, singular: string, plural?: string): string {
  return `${formatNumber(n)} ${n === 1 ? singular : (plural ?? singular + "s")}`;
}

/** Debounce helper. */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Estimate reading time for a body of text (avg 220 wpm, CJK ~300 cpm). */
export function estimateReadMinutes(text: string): number {
  const cjk = text.match(/[\u3400-\u9FFF]/g)?.length ?? 0;
  const nonCjk = text
    .replace(/[\u3400-\u9FFF]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const words = cjk + nonCjk;
  const wpm = cjk > nonCjk ? 300 : 220;
  return Math.max(1, Math.round(words / wpm));
}
