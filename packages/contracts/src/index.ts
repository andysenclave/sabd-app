/**
 * @sabd/contracts — the shared schema law for Sabd.
 * Types are pure (safe to `import type` from any runtime, including the RN app and the
 * elo engine, without pulling a runtime dependency). Validators are dependency-free.
 */

export type {
  GameMode,
  HintId,
  PaidHint,
  PerformanceBreakdown,
  RatingUpdate,
  RoundEvent,
  RoundResult,
  TopicId,
  WordEntry,
  WordTier,
} from './types.ts';

export { ROUND_EVENT_SCHEMA_VERSION } from './types.ts';

export {
  GAME_MODES,
  PAID_HINTS,
  TOPIC_IDS,
  WORD_TIERS,
  isRoundEvent,
  isWordEntry,
  validateRoundEvent,
  validateRoundResult,
  validateWordEntry,
  type ValidationResult,
} from './validate.ts';
