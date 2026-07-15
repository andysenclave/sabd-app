/**
 * @sabd/contracts — the shared schema law for Sabd.
 * Types are pure (safe to `import type` from any runtime, including the RN app and the
 * elo engine, without pulling a runtime dependency). Validators are dependency-free.
 */

export type {
  CategoryScore,
  ExportFile,
  GameMode,
  HintId,
  PaidHint,
  PlayerSnapshot,
  RatingUpdate,
  RoundEvent,
  RoundResult,
  ScoreBreakdown,
  SyncDownResponse,
  SyncUploadRequest,
  SyncUploadResponse,
  TopicId,
  WordEntry,
  WordSlice,
  WordSliceManifest,
  WordSliceRef,
  WordTier,
} from './types.ts';

export {
  BANK_TOPICS,
  ROUND_EVENT_SCHEMA_VERSION,
  SEED_RATING,
  WORD_SLICE_SCHEMA_VERSION,
  topicIdForBankTopic,
} from './types.ts';

export {
  GAME_MODES,
  PAID_HINTS,
  TOPIC_IDS,
  WORD_TIERS,
  isRoundEvent,
  isWordEntry,
  validateCategoryScore,
  validateExportFile,
  validatePlayerSnapshot,
  validateRoundEvent,
  validateRoundResult,
  validateSyncDownResponse,
  validateSyncUploadRequest,
  validateSyncUploadResponse,
  validateWordEntry,
  validateWordSlice,
  validateWordSliceManifest,
  validateWordSliceRef,
  type ValidationResult,
} from './validate.ts';
