/**
 * Sabd rating engine — public API (Phase 1).
 *
 * Pure, standalone, framework-agnostic. Zero runtime dependencies, ESM,
 * fully deterministic (no I/O, no globals, no Date.now(), no randomness).
 */

export { defaultConfig, type EloConfig } from './config.ts';

export type {
  GameMode,
  PaidHint,
  PerformanceBreakdown,
  RatingUpdate,
  RoundResult,
  WordEntry,
  WordTier,
} from './types.ts';

export {
  computePerformance,
  countPaidHints,
  type PerformanceResult,
} from './performance.ts';

export {
  applyResult,
  expectedScore,
  kFactor,
  updateWordRating,
  type PlayerState,
  type WordRatingUpdate,
} from './elo.ts';
