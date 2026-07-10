/**
 * @sabd/contracts — the SHARED CONTRACT (schema law), single source of truth.
 *
 * Every package (elo, content pipeline, apps, analysis script) imports these types.
 * There must be NO duplicated definition of WordEntry / RoundResult / RatingUpdate /
 * RoundEvent anywhere else in the repo (T3 DoD).
 *
 * Field names and shapes are law. Changing any of them is a contract-level decision
 * that is never made by the architect alone — stop and surface it.
 *
 * Canonicalization notes (resolved from pre-existing Phase-1 divergence):
 *  - `WordTier` is `low | mid | high`. The content pipeline's validator (TIER_BANDS),
 *    merge.js, the web UI, and all real wordbank data use these labels. The elo engine's
 *    former `easy | mid | hard` labels were on an unused field (the engine reads only
 *    `difficulty`) and are superseded here.
 *  - `RoundResult` is the full engine-input shape (from the elo contract). The web UI
 *    emits a subset; the app composes the remaining fields before calling the engine.
 */

/** The two PAID hints. The free, always-visible description is NOT a hint. */
export type PaidHint = 'position' | 'letters';

/** Legacy alias used by the web UI prototype. Prefer `PaidHint`. */
export type HintId = PaidHint;

export type GameMode = 'solo' | '1v1';

/** Difficulty tier. Canonical labels — see note above. */
export type WordTier = 'low' | 'mid' | 'high';

/**
 * The six canonical topics (token/Home identity keys, lowercase).
 * Note: `WordEntry.topic` is a display string (e.g. "Gaming") and stays `string` by
 * contract; `TopicId` is the identity key used by tokens and the Home grid.
 */
export type TopicId = 'gaming' | 'space' | 'music' | 'internet' | 'food' | 'world';

/** Word entry — output of the content pipeline, input to the round + engine. */
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
    /** `index` is 0-based — slot 0 is the first slot. */
    position: { index: number; letter: string };
    letters: { correct: string; decoy: string };
  };
}

/** RoundResult — input to the rating engine, produced by the game loop. */
export interface RoundResult {
  /** Did the player get the word before the clock hit 0. */
  solved: boolean;
  timeLimitSec: number;
  /** Wall time consumed. */
  timeUsedSec: number;
  /** Subset of the 2 paid hints (max 2). */
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

/** RatingUpdate — rating-engine output. */
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

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * RoundEvent — PROVISIONAL.  ⚠  NOT YET LOCKED.
 * ─────────────────────────────────────────────────────────────────────────────
 * The authoritative source (`docs/sabd-event-log-and-sync.md`) is MISSING from the
 * repo tree. This shape is a considered superset of RoundResult + the rating outcome
 * + an event envelope, sufficient for Lane 1 to typecheck and for early reasoning.
 *
 * It MUST be reconciled against the event-log doc before T9 (storage) / T10 (event
 * log core) / T23 (export). Treat any change here that lands from that doc as a
 * contract decision, not a refactor. Do not build persistence on this until confirmed.
 */
export const ROUND_EVENT_SCHEMA_VERSION = 1 as const;

export interface RoundEvent {
  /** Envelope schema version; bump on any breaking field change. */
  schemaVersion: number;
  /** Primary key — random UUID (expo-crypto). Idempotency hinge for appendRound. */
  roundId: string;
  /** Random install UUID (expo-crypto). NEVER a device identifier. */
  installId: string;

  /** What was played. */
  wordId: string;
  word: string;
  topic: string;

  /** Round outcome (mirror of RoundResult, denormalized into the event). */
  solved: boolean;
  timeLimitSec: number;
  timeUsedSec: number;
  hintsUsed: PaidHint[];
  challengeMode: boolean;
  mode: GameMode;

  /** Rating math (the derived value; the log is the truth it derives from). */
  opponentRating: number;
  playerRatingBefore: number;
  playerRatingAfter: number;
  gamesPlayedBefore: number;
  delta: number;

  /** Timing — epoch ms. `timeUsedSec` derives from a monotonic source where available. */
  startedAt: number;
  endedAt: number;
  /** Set when wall-clock and monotonic deltas disagree wildly (clock manipulation). */
  anomaly?: boolean;

  /** Provenance + sync bookkeeping. */
  wordBankVersion: string;
  /** Epoch ms when exported/synced; null until then. The manual loop leaves this untouched. */
  syncedAt: number | null;
}
