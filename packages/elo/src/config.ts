/**
 * Sabd scoring engine — tunable constants (single source of truth).
 *
 * The score is a monotonic point total: a solve awards points (never negative), a miss
 * awards nothing and breaks the streak. Every weight/band lives here so playtest tuning
 * never touches the math. The engine functions accept an optional config override.
 */

import type { WordTier } from './types.ts';

export interface PointsConfig {
  /** Base points awarded for a solve, by the word's difficulty tier. */
  readonly tierBase: Readonly<Record<WordTier, number>>;
  /** Max extra points for an instant solve; scales down to 0 as the clock is used. */
  readonly speedBonusMax: number;
  /** Points deducted per PAID hint used (max 2 paid hints). */
  readonly hintPenaltyPerHint: number;
  /** A solve never awards fewer than this (before the streak bonus is added). */
  readonly minSolvePoints: number;

  /** Extra points added per consecutive solve: bonus = streakStep * (streak - 1). */
  readonly streakStep: number;
  /** Cap on the per-round streak bonus so a long streak can't run away. */
  readonly streakBonusMax: number;

  /**
   * Score → difficulty tier the player is served. The score only climbs, so difficulty
   * only ever holds or rises: `score < mid` → low, `< high` → mid, else high.
   */
  readonly tierThresholds: Readonly<{ mid: number; high: number }>;

  /**
   * Difficulty (puzzle rating) → tier bands, mirroring the content pipeline's TIER_BANDS.
   * The event log stores only the numeric difficulty, so scoring re-derives the tier here.
   */
  readonly tierBands: Readonly<{ lowMax: number; midMax: number }>;
}

/**
 * Version stamp for the tunables below — persisted on every round_event as
 * `engineConfigVersion`. BUMP THIS whenever any defaultConfig value changes.
 *
 * 2.0.0 — replaced the Elo rating engine with the monotonic points engine (seed 0,
 * streak bonus, tier-gated difficulty).
 */
export const ENGINE_CONFIG_VERSION = '2.0.0';

export const defaultConfig: PointsConfig = {
  tierBase: { low: 10, mid: 20, high: 30 },
  speedBonusMax: 10,
  hintPenaltyPerHint: 3,
  minSolvePoints: 5,

  streakStep: 2,
  streakBonusMax: 20,

  tierThresholds: { mid: 100, high: 300 },

  tierBands: { lowMax: 1200, midMax: 1600 },
};
