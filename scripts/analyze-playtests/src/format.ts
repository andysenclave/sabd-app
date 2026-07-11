/**
 * Plain-text formatting helpers — the ONE place the n<5 suppression rule lives
 * (playtest-analysis doc §4.5/§6.5: "impossible to accidentally print a percentage
 * on n=2"). Every rate in every report routes through `formatRate`.
 *
 * n<5 suppression is applied at whatever grain the doc's own example tables show it:
 * per-row for hint/timing/topic/word breakdowns (one bucket can be thin while another
 * is healthy), whole-block for session-level medians (one population, one n).
 */

const SUPPRESS_BELOW = 5;

/** "62% (n=13)" or "insufficient data (n=3)" — never a bare percentage. */
export function formatRate(count: number, total: number): string {
  if (total < SUPPRESS_BELOW) return `insufficient data (n=${total})`;
  const pct = total === 0 ? 0 : Math.round((count / total) * 1000) / 10;
  return `${pct}% (n=${total})`;
}

/** A non-percentage stat (median, avg) — still carries its n, still suppressible. */
export function formatStat(value: number | null, n: number, digits = 1): string {
  if (n < SUPPRESS_BELOW || value === null) return `insufficient data (n=${n})`;
  return `${value.toFixed(digits)} (n=${n})`;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Nearest-rank percentile (p in [0,100]). */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
}

export function heading(title: string): string {
  return `\n${title}\n${'─'.repeat(title.length)}`;
}

export function table(rows: readonly (readonly [string, string])[]): string {
  const width = Math.max(...rows.map(([k]) => k.length), 0);
  return rows.map(([k, v]) => `  ${k.padEnd(width)}  ${v}`).join('\n');
}
