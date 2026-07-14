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

/** RoundResult — input to the scoring engine, produced by the game loop. */
export interface RoundResult {
  /** Did the player get the word before the clock hit 0. */
  solved: boolean;
  timeLimitSec: number;
  /** Wall time consumed. */
  timeUsedSec: number;
  /** Subset of the 2 paid hints (max 2). */
  hintsUsed: PaidHint[];
  /** The word's `difficulty` (puzzle rating) — the tier the score awards is derived from it. */
  wordDifficulty: number;
  mode: GameMode;
}

/** Breakdown of the points awarded for a solved round (all zero on a miss). */
export interface ScoreBreakdown {
  /** Base points for the word's difficulty tier (low/mid/high). */
  tierBase: number;
  /** Extra points for a fast solve (≥ 0). */
  speedBonus: number;
  /** Points lost to paid hints (≤ 0). */
  hintPenalty: number;
  /** Extra points from the active solve streak (≥ 0). */
  streakBonus: number;
}

/**
 * RatingUpdate — scoring-engine output. The score is a monotonic point total:
 * `delta` is always ≥ 0 (0 on a miss), so `newPlayerRating` never decreases.
 */
export interface RatingUpdate {
  /** Points earned this round (≥ 0; exactly 0 on a miss). */
  delta: number;
  /** New score after this round (≥ 0, never below the previous score). */
  newPlayerRating: number;
  /** Solve streak AFTER this round — incremented on a solve, reset to 0 on a miss. */
  streak: number;
  breakdown: ScoreBreakdown;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * RoundEvent — LOCKED to `docs/sabd-event-log-and-sync.md` §4 (schema v1).
 * ─────────────────────────────────────────────────────────────────────────────
 * The append-only event log is the truth; the rating is derived by replaying these
 * through @sabd/elo. Logging scope is MINIMAL — exactly what Elo replay and
 * word-rating correction consume. Do not add exhaust (keystrokes, guesses, device
 * info); nothing consumes it and it becomes a liability once a userId attaches.
 *
 * Field names here are camelCase mirrors of the §4 snake_case columns; the storage
 * layer owns the row mapping (booleans ↔ 0/1, hintsUsed ↔ JSON text).
 *
 * NOT persisted in v1 (deliberate): `challengeMode` — it affects the rating, so an
 * event without it can't be faithfully replayed; Challenge is disabled in Phase 2 and
 * recording a challenge round is rejected. If Challenge ships, bump the schema version
 * and add the column (contract decision, not a refactor).
 */
export const ROUND_EVENT_SCHEMA_VERSION = 1 as const;

/**
 * New players (and every per-topic score) start here. The score is a monotonic point
 * total that only climbs from 0 — there is no matchmaking seed anymore.
 */
export const SEED_RATING = 0 as const;

export interface RoundEvent {
  /** Primary key — client-generated random UUID → idempotent append/upload. */
  roundId: string;
  /** Event shape version; bump when this shape changes. */
  schemaVersion: number;
  /** Random install UUID (expo-crypto). NEVER a device identifier. */
  installId: string;
  /** Epoch ms, client clock. */
  playedAt: number;

  /** e.g. "GAM-0142". */
  wordId: string;
  /**
   * The word's rating AT PLAY TIME (§4.1) — ratings drift once correction begins;
   * the number they actually faced is part of the event.
   */
  wordRatingAtPlay: number;
  /** Which bank served this word. */
  wordBankVersion: string;
  topic: string;

  solved: boolean;
  timeLimitSec: number;
  timeUsedSec: number;
  /** The paid hints used (max 2). */
  hintsUsed: PaidHint[];
  /** "solo" (1v1 later). */
  mode: GameMode;

  /** What they were rated facing this word (§4.3 — self-describing, drift-spotting). */
  playerRatingBefore: number;
  /**
   * Which engine tunables were live (§4.2) — a round played under hintPenalty 0.20
   * cannot be honestly replayed under 0.15.
   */
  engineConfigVersion: string;

  /**
   * Set when wall-clock and monotonic time deltas disagree wildly (clock
   * manipulation). Required by the architect orders, which take precedence over the
   * event-log doc's field list. Optional; absent means "no anomaly detected".
   */
  anomaly?: boolean;

  /** Epoch ms when uploaded; null = never. The Phase-2 manual loop leaves this null. */
  syncedAt: number | null;
}

/**
 * The "Send my data" export envelope (playtest-analysis doc §2):
 * one JSON file per friend, consumed by scripts/analyze-playtests.
 */
export interface ExportFile {
  installId: string;
  /** ROUND_EVENT_SCHEMA_VERSION of the rounds within. */
  schemaVersion: number;
  /** Epoch ms. */
  exportedAt: number;
  rounds: RoundEvent[];
}
