/**
 * Sabd scoring engine — monotonic points.
 *
 * Pure, deterministic. No I/O, no globals, no Date.now(), no randomness.
 *
 * A solve awards `tierBase + speedBonus − hintPenalty` (floored at `minSolvePoints`),
 * plus an escalating streak bonus. A miss (timeout or abandon) awards 0 and resets the
 * streak. The running score therefore only ever climbs, and floors at 0 for free.
 *
 * Difficulty follows the *score*, not the streak: a bigger score means harder words, and
 * because the score never drops, the difficulty you've earned never drops either — a
 * broken streak costs you the bonus, not your level.
 */

import { defaultConfig, type PointsConfig } from './config.ts';
import type { RatingUpdate, RoundResult, ScoreBreakdown, WordTier } from './types.ts';

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Player scoring state — authoritative score + current solve streak. */
export interface PlayerState {
  /** Running point total (≥ 0). */
  rating: number;
  /** Consecutive solves so far (0 after any miss). */
  streak: number;
}

/** Distinct paid hints used, capped at 2 (only Position + Letters count). */
export function countPaidHints(result: Pick<RoundResult, 'hintsUsed'>): number {
  return Math.min(new Set(result.hintsUsed).size, 2);
}

/** The word's difficulty tier, re-derived from its numeric difficulty (event-log has no tier). */
export function tierForDifficulty(difficulty: number, config: PointsConfig = defaultConfig): WordTier {
  if (difficulty <= config.tierBands.lowMax) return 'low';
  if (difficulty <= config.tierBands.midMax) return 'mid';
  return 'high';
}

/**
 * The difficulty tier a player at this score is served. Monotonic in `score`, so the
 * difficulty a player has reached never regresses (the score never drops).
 */
export function tierForScore(score: number, config: PointsConfig = defaultConfig): WordTier {
  if (score < config.tierThresholds.mid) return 'low';
  if (score < config.tierThresholds.high) return 'mid';
  return 'high';
}

/**
 * Apply a round result to the player's score + streak.
 *
 *   miss  → delta 0, score unchanged, streak → 0
 *   solve → base = max(minSolvePoints, tierBase + speedBonus − hintPenalty)
 *           streakBonus = min(streakBonusMax, streakStep * (newStreak − 1))
 *           delta = base + streakBonus, score += delta, streak += 1
 */
export function applyPoints(
  state: PlayerState,
  result: RoundResult,
  config: PointsConfig = defaultConfig,
): RatingUpdate {
  const zeroBreakdown: ScoreBreakdown = { tierBase: 0, speedBonus: 0, hintPenalty: 0, streakBonus: 0 };

  if (!result.solved) {
    // A miss: no points, streak broken. The score never drops.
    return { delta: 0, newPlayerRating: state.rating, streak: 0, breakdown: zeroBreakdown };
  }

  if (!(result.timeLimitSec > 0)) {
    throw new RangeError(`timeLimitSec must be > 0, got ${result.timeLimitSec}`);
  }

  const tier = tierForDifficulty(result.wordDifficulty, config);
  const tierBase = config.tierBase[tier];

  const T = clamp(result.timeUsedSec / result.timeLimitSec, 0, 1);
  const speedBonus = Math.round(config.speedBonusMax * (1 - T));
  const hints = countPaidHints(result);
  const hintPenalty = hints === 0 ? 0 : -config.hintPenaltyPerHint * hints; // avoid -0

  const solvePoints = Math.max(config.minSolvePoints, tierBase + speedBonus + hintPenalty);

  const newStreak = state.streak + 1;
  const streakBonus = Math.min(config.streakBonusMax, config.streakStep * (newStreak - 1));

  const delta = solvePoints + streakBonus;

  return {
    delta,
    newPlayerRating: state.rating + delta,
    streak: newStreak,
    breakdown: { tierBase, speedBonus, hintPenalty, streakBonus },
  };
}
