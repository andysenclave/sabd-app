/**
 * Sabd rating engine — tunable constants (single source of truth).
 *
 * Every weight/band the design doc marks as tunable lives here. The engine
 * functions accept an optional config override so playtest tuning never
 * requires touching the math.
 */

export interface EloConfig {
  /** Base score awarded for any solve (§3.2 `solveBase`). */
  readonly solveBase: number;
  /** Max additional score for an instant solve (§3.2 `speedBonus` weight). */
  readonly speedBonusMax: number;
  /** Penalty per PAID hint used (§3.2 `hintPenalty` weight). Max 2 paid hints. */
  readonly hintPenaltyPerHint: number;
  /** Lower clamp for a solved round's performance score. */
  readonly solvedFloor: number;
  /** Upper clamp for the performance score. */
  readonly performanceCeiling: number;

  /** Elo logistic divisor (standard Elo uses 400). */
  readonly eloDivisor: number;

  /** K-factor bands (§3.3). */
  readonly kProvisional: number;
  /** Games played below this count ⇒ provisional K. */
  readonly provisionalGames: number;
  readonly kStandard: number;
  readonly kHighRated: number;
  /** Rating at/above which the high-rated (lower) K applies. */
  readonly highRatedThreshold: number;

  /** Challenge-mode multiplier — applies to GAINS ONLY (§4). */
  readonly challengeMultiplier: number;

  /** Ratings never drop below this floor. */
  readonly ratingFloor: number;

  /** K used by the Phase-2 word-rating self-correction (§3.5). */
  readonly wordK: number;
  /** Phase-2 flag: word rating self-correction is OFF by default. */
  readonly wordRatingUpdatesEnabled: boolean;
}

/**
 * Version stamp for the tunables below — persisted on every round_event as
 * `engineConfigVersion` (event-log doc §4.2). A round played under hintPenalty 0.20
 * cannot be honestly replayed under 0.15; the stamp lets replay resolve which config
 * was live. BUMP THIS whenever any defaultConfig value changes.
 */
export const ENGINE_CONFIG_VERSION = '1.0.0';

export const defaultConfig: EloConfig = {
  solveBase: 0.5,
  speedBonusMax: 0.5,
  hintPenaltyPerHint: 0.2,
  solvedFloor: 0.05,
  performanceCeiling: 1.0,

  eloDivisor: 400,

  kProvisional: 40,
  provisionalGames: 30,
  kStandard: 32,
  kHighRated: 24,
  highRatedThreshold: 2000,

  challengeMultiplier: 1.25,

  ratingFloor: 100,

  wordK: 16,
  wordRatingUpdatesEnabled: false,
};
