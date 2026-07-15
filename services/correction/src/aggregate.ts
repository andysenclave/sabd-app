/**
 * Per-word aggregation (T15) — mirrors docs/sabd-event-log-and-sync.md §7.3 and the
 * playtest-analysis logic, as a pure function over RoundEvents so it runs on a D1
 * dump, a playtest export file, or in-memory test data identically.
 *
 * The equivalent SQL (documented for a direct D1 run) lives in the README.
 */

import type { RoundEvent } from '@sabd/contracts';

export interface WordStats {
  wordId: string;
  topic: string;
  attempts: number;
  /** Fraction solved [0,1]. */
  solveRate: number;
  /** Mean of timeUsed/timeLimit across attempts [0,1]. */
  avgClockUsed: number;
  /** Mean paid hints per attempt [0,2]. */
  avgHints: number;
  /** Mean player score at play (playerRatingBefore). */
  avgPlayerRating: number;
  /** The difficulty most recently faced (max playedAt) — the calibration baseline. */
  lastRatingAtPlay: number;
}

/** Words below this many attempts are noise, not signal — never re-rated. */
export const NOISE_FLOOR = 30;

export function aggregateWords(events: readonly RoundEvent[]): WordStats[] {
  const byWord = new Map<string, RoundEvent[]>();
  for (const e of events) {
    const list = byWord.get(e.wordId);
    if (list) list.push(e);
    else byWord.set(e.wordId, [e]);
  }

  const out: WordStats[] = [];
  for (const [wordId, list] of byWord) {
    const attempts = list.length;
    const latest = list.reduce((a, b) => (b.playedAt > a.playedAt ? b : a));
    out.push({
      wordId,
      topic: latest.topic,
      attempts,
      solveRate: list.filter((e) => e.solved).length / attempts,
      avgClockUsed:
        list.reduce((s, e) => s + Math.min(1, Math.max(0, e.timeUsedSec / e.timeLimitSec)), 0) / attempts,
      avgHints: list.reduce((s, e) => s + e.hintsUsed.length, 0) / attempts,
      avgPlayerRating: list.reduce((s, e) => s + e.playerRatingBefore, 0) / attempts,
      lastRatingAtPlay: latest.wordRatingAtPlay,
    });
  }
  return out.sort((a, b) => (a.wordId < b.wordId ? -1 : 1));
}
