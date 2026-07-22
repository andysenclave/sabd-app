/**
 * Per-word aggregation (T15, rebuilt for P4-T7 confidence-weighted calibration) —
 * a pure function over RoundEvents so it runs on a D1 dump, a playtest export file,
 * or in-memory test data identically.
 *
 * Phase 4 additions carry the signal the confidence-weighted engine needs:
 *  - `uniquePlayers` (F8): the confidence weight counts distinct installs, not raw
 *    attempts, so one grinder can't re-rate a word alone.
 *  - `firstAttemptSolveRate` (F9): a player who failed then re-attempts has
 *    answer-adjacent knowledge; the calibration signal uses each player's FIRST
 *    attempt only (later attempts are excluded from the rate, not merely discounted).
 *  - `playerScoreSpread`: the range of attempting players' scores, a proxy for how
 *    representative the evidence is (a word tried only by a narrow score band gives
 *    weaker evidence — the confounding guard in calibrate.ts).
 *
 * Scale note (F11): pre-3.0.0 events carry old-scale `wordRatingAtPlay`; the
 * calibration entry (`calibrationEvents`) drops them before aggregating. Aggregate
 * solve RATE is scale-independent, so the enriched stats here stay meaningful either
 * way — the filter lives at the calibration boundary, not in this general function.
 */

import type { RoundEvent } from '@sabd/contracts';
import { configForVersion } from '@sabd/elo';

export interface WordStats {
  wordId: string;
  topic: string;
  attempts: number;
  /** Distinct installs that attempted this word (F8 — the confidence-weight base). */
  uniquePlayers: number;
  /** Fraction solved [0,1] over ALL attempts. */
  solveRate: number;
  /** Fraction solved over each player's FIRST attempt only (F9 — the clean signal). */
  firstAttemptSolveRate: number;
  /** Mean of timeUsed/timeLimit across attempts [0,1]. */
  avgClockUsed: number;
  /** Mean paid hints per attempt [0,2]. */
  avgHints: number;
  /** Mean player score at play (playerRatingBefore). */
  avgPlayerRating: number;
  /** max−min of playerRatingBefore across attempts — evidence-breadth proxy. */
  playerScoreSpread: number;
  /** The difficulty most recently faced (max playedAt) — the calibration baseline. */
  lastRatingAtPlay: number;
}

/**
 * Minimum DISTINCT PLAYERS for a word to be re-rated at all. Phase 4 lowered the gate
 * from a hard 30-attempt wall to 5 players: correction now STARTS at 5 with a tiny,
 * confidence-scaled nudge and grows with the sample (calibrate.ts), rather than doing
 * nothing until 30. Named NOISE_FLOOR for continuity; it now counts players.
 */
export const NOISE_FLOOR = 5;

/**
 * Keep only events eligible for calibration (F11): those written under a unified-scale
 * config (3.0.0+). Pre-3.0.0 evidence carries old-scale ratings and is discarded — the
 * volumes are tiny and mixing scales would corrupt the aggregate.
 */
export function calibrationEvents(events: readonly RoundEvent[]): RoundEvent[] {
  return events.filter((e) => configForVersion(e.engineConfigVersion)?.scale === 'unified');
}

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

    // Each player's FIRST attempt (min playedAt, tie-break roundId for determinism).
    const firstByPlayer = new Map<string, RoundEvent>();
    for (const e of list) {
      const cur = firstByPlayer.get(e.installId);
      if (!cur || e.playedAt < cur.playedAt || (e.playedAt === cur.playedAt && e.roundId < cur.roundId)) {
        firstByPlayer.set(e.installId, e);
      }
    }
    const firsts = [...firstByPlayer.values()];
    const uniquePlayers = firsts.length;

    const ratings = list.map((e) => e.playerRatingBefore);
    out.push({
      wordId,
      topic: latest.topic,
      attempts,
      uniquePlayers,
      solveRate: list.filter((e) => e.solved).length / attempts,
      firstAttemptSolveRate: firsts.filter((e) => e.solved).length / uniquePlayers,
      avgClockUsed:
        list.reduce((s, e) => s + Math.min(1, Math.max(0, e.timeUsedSec / e.timeLimitSec)), 0) / attempts,
      avgHints: list.reduce((s, e) => s + e.hintsUsed.length, 0) / attempts,
      avgPlayerRating: ratings.reduce((s, r) => s + r, 0) / attempts,
      playerScoreSpread: Math.max(...ratings) - Math.min(...ratings),
      lastRatingAtPlay: latest.wordRatingAtPlay,
    });
  }
  return out.sort((a, b) => (a.wordId < b.wordId ? -1 : 1));
}
