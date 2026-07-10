/**
 * Sabd rating engine — SHARED CONTRACT types (§2 of the design doc).
 * Field names and shapes are shared across sessions — do not change.
 */

/** The two paid hints. The free always-visible description is NOT counted. */
export type PaidHint = 'position' | 'letters';

export type GameMode = 'solo' | '1v1';

export type WordTier = 'easy' | 'mid' | 'hard';

/** Word entry — input from the content pipeline. Only `difficulty` is used by this engine. */
export interface WordEntry {
  id: string;
  word: string;
  topic: string;
  length: number;
  /** The word's rating ("puzzle rating"). */
  difficulty: number;
  tier: WordTier;
  description: string;
  hints: {
    position: { index: number; letter: string };
    letters: { correct: string; decoy: string };
  };
}

/** RoundResult — input to the engine, produced by the game loop. */
export interface RoundResult {
  /** Did the player get the word before the clock hit 0. */
  solved: boolean;
  timeLimitSec: number;
  /** Wall time consumed. */
  timeUsedSec: number;
  /** Subset of ["position","letters"] (the 2 paid hints; max 2). */
  hintsUsed: PaidHint[];
  /** The word's `difficulty` (solo) OR the opponent's rating (1v1). */
  opponentRating: number;
  playerRating: number;
  gamesPlayed: number;
  mode: GameMode;
  /** Player opted into a harder-than-rating word / higher opponent. */
  challengeMode: boolean;
}

/** Breakdown of the performance score components. */
export interface PerformanceBreakdown {
  solveBase: number;
  speedBonus: number;
  /** Negative or zero (e.g. -0.20 for one paid hint). */
  hintPenalty: number;
}

/** RatingUpdate — engine output. */
export interface RatingUpdate {
  /** Performance score s ∈ [0,1]. */
  performance: number;
  /** Expected score E from standard Elo. */
  expected: number;
  /** Rounded rating change (challenge multiplier already applied to gains). */
  delta: number;
  newPlayerRating: number;
  kFactor: number;
  breakdown: PerformanceBreakdown;
}
