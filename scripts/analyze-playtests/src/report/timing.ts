/**
 * §3.3 — Is 60 seconds right? Time-to-solve distribution. The decision it informs:
 * `timeLimitSec`. A 2% timeout rate means the game is too easy, not that it's good.
 */
import type { RoundEvent } from '@sabd/contracts';
import { formatRate, formatStat, heading, median, percentile, table } from '../format.ts';

export function timingReport(rounds: readonly RoundEvent[]): string {
  const solved = rounds.filter((r) => r.solved);
  const times = solved.map((r) => r.timeUsedSec);
  const n = solved.length;

  const stats = table([
    ['Time to solve — median', formatStat(median(times), n)],
    ['Time to solve — p25', formatStat(percentile(times, 25), n)],
    ['Time to solve — p75', formatStat(percentile(times, 75), n)],
    ['Time to solve — p90', formatStat(percentile(times, 90), n)],
    ['Timeout rate', formatRate(rounds.length - solved.length, rounds.length)],
  ]);

  const buckets = new Map<number, number>();
  for (const t of times) {
    const bucket = Math.floor(t / 5) * 5;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  const histogram =
    n >= 5
      ? [...buckets.entries()]
          .sort(([a], [b]) => a - b)
          .map(([bucket, count]) => `  ${bucket}-${bucket + 4}s: ${'█'.repeat(count)} (${count})`)
          .join('\n')
      : `  insufficient data (n=${n})`;

  return `${heading('3.3 — Is 60 seconds right? (time-to-solve)')}\n${stats}\n\n  Histogram (5s buckets):\n${histogram}`;
}
