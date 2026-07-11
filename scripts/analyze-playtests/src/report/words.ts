/**
 * §3.4 — Are the seeded word ratings sane? A shortlist for your eyeballs, not a
 * correction (the ≥30-attempts correction gate lives in @sabd/elo, off by default —
 * this script never touches it). Obviously broken words show up even at n=2 via the
 * non-percentage signals (avg_hints, avg_clock_used); solve_rate itself still routes
 * through the same n<5 suppression as everything else — never a bare percentage.
 */
import type { RoundEvent } from '@sabd/contracts';
import { formatRate, formatStat, heading, table } from '../format.ts';

export interface WordStat {
  wordId: string;
  attempts: number;
  solved: number;
  seededDifficulty: number;
  avgClockUsed: number | null;
  avgHints: number | null;
}

export function computeWordStats(rounds: readonly RoundEvent[]): WordStat[] {
  const byWord = new Map<string, RoundEvent[]>();
  for (const r of rounds) {
    const list = byWord.get(r.wordId) ?? [];
    list.push(r);
    byWord.set(r.wordId, list);
  }

  return [...byWord.entries()].map(([wordId, attempts]) => {
    const clockFractions = attempts.map((r) => r.timeUsedSec / r.timeLimitSec);
    const hintCounts = attempts.map((r) => r.hintsUsed.length);
    return {
      wordId,
      attempts: attempts.length,
      solved: attempts.filter((r) => r.solved).length,
      seededDifficulty: attempts[0]!.wordRatingAtPlay,
      avgClockUsed: avg(clockFractions),
      avgHints: avg(hintCounts),
    };
  });
}

function avg(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export interface WordOutlier extends WordStat {
  flags: string[];
}

/** Only rows that trip at least one flag — the actual "shortlist". */
export function wordOutliers(stats: readonly WordStat[]): WordOutlier[] {
  const out: WordOutlier[] = [];
  for (const s of stats) {
    const flags: string[] = [];
    const solveRate = s.attempts >= 5 ? s.solved / s.attempts : null;

    if (solveRate !== null) {
      if (s.seededDifficulty < 1200 && solveRate < 0.5) flags.push('under-rated (low tier, solve<50%)');
      if (s.seededDifficulty > 1600 && solveRate > 0.85) flags.push('over-rated (high tier, solve>85%)');
      if (solveRate === 1 && s.avgClockUsed !== null && s.avgClockUsed < 0.4) {
        flags.push('too easy for its tier (100% solve, fast times)');
      }
    }
    if (s.avgHints !== null && s.avgHints >= 1.8) {
      flags.push('avg_hints≈2.0 — too hard, or its description is too oblique');
    }
    if (flags.length > 0) out.push({ ...s, flags });
  }
  return out.sort((a, b) => b.attempts - a.attempts);
}

export function wordsReportText(rounds: readonly RoundEvent[]): string {
  const stats = computeWordStats(rounds);
  const outliers = wordOutliers(stats);

  if (outliers.length === 0) {
    return `${heading('3.4 — Are the seeded word ratings sane? (outlier shortlist)')}\n  No outliers flagged.`;
  }

  const clockUsedText = (o: WordOutlier): string =>
    o.attempts < 5 || o.avgClockUsed === null
      ? `insufficient data (n=${o.attempts})`
      : `${Math.round(o.avgClockUsed * 100)}% (n=${o.attempts})`;

  const rows = outliers.map((o) =>
    table([
      [o.wordId, `difficulty=${o.seededDifficulty}`],
      ['  attempts', `${o.attempts}`],
      ['  solve rate', formatRate(o.solved, o.attempts)],
      ['  avg clock used', clockUsedText(o)],
      ['  avg hints', formatStat(o.avgHints, o.attempts, 2)],
      ['  flags', o.flags.join('; ')],
    ]),
  );

  return `${heading('3.4 — Are the seeded word ratings sane? (outlier shortlist)')}\n${rows.join('\n\n')}`;
}
