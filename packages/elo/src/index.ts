/**
 * Sabd scoring engine — public API.
 *
 * Pure, standalone, framework-agnostic. Zero runtime dependencies, ESM,
 * fully deterministic (no I/O, no globals, no Date.now(), no randomness).
 *
 * The package is still named `@sabd/elo` for historical reasons; the engine is now a
 * monotonic points model (see points.ts), not Elo. Renaming the package is deferred.
 */

export {
  CONFIGS,
  CONFIG_2_0_0,
  CONFIG_3_0_0,
  configForVersion,
  defaultConfig,
  ENGINE_CONFIG_VERSION,
  isPointsEraConfig,
  requireConfig,
  UnknownConfigVersionError,
  type PointsConfig,
  type TierBand,
} from './config.ts';

export type {
  GameMode,
  PaidHint,
  RatingUpdate,
  RoundResult,
  ScoreBreakdown,
  WordEntry,
  WordTier,
} from './types.ts';

export {
  LEGACY_SCALE,
  UNIFIED_SCALE,
  rescaleLegacyDifficulty,
} from './rescale.ts';

export {
  applyPoints,
  bandForDifficulty,
  bandForScore,
  countPaidHints,
  tierForDifficulty,
  tierForScore,
  type PlayerState,
} from './points.ts';
