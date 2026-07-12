/**
 * Sabd rating engine — shared contract types.
 *
 * These definitions now live in `@sabd/contracts` (the single source of truth, T3).
 * This module re-exports them so the engine's internal imports (`./types.ts`) and the
 * public surface in `index.ts` are unchanged. There is intentionally NO type definition
 * here — duplicating the contract is a defect.
 *
 * Type-only re-export: `verbatimModuleSyntax` + `erasableSyntaxOnly` erase it at runtime,
 * so the engine keeps zero runtime dependencies.
 */

export type {
  GameMode,
  PaidHint,
  RatingUpdate,
  RoundResult,
  ScoreBreakdown,
  WordEntry,
  WordTier,
} from '@sabd/contracts';
