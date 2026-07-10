/**
 * Sabd rating engine — performance score (§3.2 of the design doc).
 *
 * Grades HOW WELL the player did into s ∈ [0,1]:
 *
 *   T = timeUsedSec / timeLimitSec        (fraction of clock used, clamped 0..1)
 *   H = number of PAID hints used          (0..2 — only Position + Letters count)
 *
 *   not solved:  s = 0.0
 *   solved:      solveBase   = 0.5
 *                speedBonus  = 0.5 * (1 - T)
 *                hintPenalty = 0.20 * H
 *                s = clamp(solveBase + speedBonus - hintPenalty, 0.05, 1.0)
 *
 * Pure and deterministic — time comes in via RoundResult.
 */

import { defaultConfig, type EloConfig } from './config.ts';
import type { PerformanceBreakdown, RoundResult } from './types.ts';

const clamp = (x: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, x));

export interface PerformanceResult {
  /** Performance score s ∈ [0,1]. */
  s: number;
  breakdown: PerformanceBreakdown;
}

/** Count of distinct paid hints used, capped at 2. */
export function countPaidHints(result: Pick<RoundResult, 'hintsUsed'>): number {
  return Math.min(new Set(result.hintsUsed).size, 2);
}

export function computePerformance(
  result: RoundResult,
  config: EloConfig = defaultConfig,
): PerformanceResult {
  if (!result.solved) {
    // Timed out: no credit at all.
    return { s: 0.0, breakdown: { solveBase: 0, speedBonus: 0, hintPenalty: 0 } };
  }

  if (!(result.timeLimitSec > 0)) {
    throw new RangeError(`timeLimitSec must be > 0, got ${result.timeLimitSec}`);
  }

  const T = clamp(result.timeUsedSec / result.timeLimitSec, 0, 1);
  const H = countPaidHints(result);

  const solveBase = config.solveBase;
  const speedBonus = config.speedBonusMax * (1 - T);
  const hintPenalty = -config.hintPenaltyPerHint * H;

  const s = clamp(
    solveBase + speedBonus + hintPenalty,
    config.solvedFloor,
    config.performanceCeiling,
  );

  return { s, breakdown: { solveBase, speedBonus, hintPenalty } };
}
