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
 * Phase 4 (PART A §2): the four-tier vocabulary of the UNIFIED difficulty scale
 * (0–500, same units as the player score — engine config `3.0.0`). Bands:
 * veryEasy 0–50, easy 51–150, medium 151–350, hard 351+. The legacy trio above
 * stays the vocabulary of the Elo-era scale (config `2.0.0`) — code paths bound to
 * the ACTIVE config (selection, slices, calibration) keep using `WordTier` until
 * the gated 3.0.0 flip (edge-case F7).
 */
export type UnifiedTier = 'veryEasy' | 'easy' | 'medium' | 'hard';

/** Either scale's tier vocabulary — what a bank entry may carry (see `BankScale`). */
export type BankTier = WordTier | UnifiedTier;

/**
 * Which number system a bank's difficulties live in (edge-case F5: a bank/slice is
 * self-describing so a cached file can never be mis-banded). `elo-legacy` = 800–2200,
 * three tiers; `unified` = 0–500, four tiers. Mirrors `PointsConfig['scale']`.
 */
export type BankScale = 'elo-legacy' | 'unified';

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
  /**
   * The word's rating ("puzzle rating"). Which scale it lives on is declared by the
   * bank/slice that carries the entry (`BankScale`), never guessed per-entry.
   */
  difficulty: number;
  /** Legacy trio on an `elo-legacy` bank; unified four on a `unified` bank. */
  tier: BankTier;
  description: string;
  /**
   * A SECOND clue for the same word (owner request, 2026-07-19) — same authoring
   * rules as `description` (5–12 words, evocative, no leak) but a different angle.
   * Reserved for a future feature (clue shuffling or an extra help option — the
   * consumer is deliberately undecided; nothing reads it yet). Optional because
   * legacy (`elo-legacy`) bank entries predate it; every unified-bank entry carries
   * one (enforced by @sabd/wordbank tests, not by this shape check).
   */
  altDescription?: string;
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

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 3 — sync + word-slice contracts (architect roadmap T1/T2).
 * ─────────────────────────────────────────────────────────────────────────────
 * Versioning semantics for everything below live in `packages/contracts/VERSIONING.md`.
 */

/**
 * Canonical bank topic display string per TopicId — the value that appears in
 * `WordEntry.topic` and `RoundEvent.topic`. Single source of truth: the mobile Home
 * grid, the wordbank publisher, and the server's per-category replay all consume this
 * mapping (T1 DoD: zero duplicate definitions).
 */
export const BANK_TOPICS: Readonly<Record<TopicId, string>> = {
  gaming: 'Gaming',
  space: 'Space & Sci-Fi',
  music: 'Music',
  internet: 'Internet & Tech Culture',
  food: 'Food & Drink',
  world: 'World & Places',
} as const;

/** Reverse lookup: bank topic display string → TopicId (undefined for unknown topics). */
export function topicIdForBankTopic(topic: string): TopicId | undefined {
  for (const id of Object.keys(BANK_TOPICS) as TopicId[]) {
    if (BANK_TOPICS[id] === topic) return id;
  }
  return undefined;
}

/**
 * One category's scoring state — a pure replay outcome (points engine over that
 * topic's post-epoch events, seed 0, own streak). Appears in sync payloads; never
 * stored authoritatively anywhere (the event log is the truth, client and server
 * each derive it by replay).
 */
export interface CategoryScore {
  /** Bank topic display string, exactly as in `RoundEvent.topic` (see BANK_TOPICS). */
  topic: string;
  /** Monotonic point total for this topic (≥ 0). */
  score: number;
  /** Current consecutive-solve streak in this topic (0 after any miss). */
  streak: number;
  /** Post-epoch rounds folded into this score. */
  gamesPlayed: number;
}

/**
 * The server's authoritative scoring snapshot for an install — the response body of
 * `GET /v1/me` (sync-down, T13) and the tail of every upload response (T12).
 * Computed by replaying the install's stored events through @sabd/elo server-side;
 * NEVER trusted from a client. Global is an independent replay across all topics
 * with its own streak — NOT the sum of the categories (locked owner decision).
 */
export interface PlayerSnapshot {
  installId: string;
  /**
   * The account this install is bound to, when it has claimed/created one (P4-T9).
   * Null (or absent) for a pure-anonymous install. When set, the snapshot is the
   * MERGED replay across every install bound to the account, not just `installId`.
   */
  accountId?: string | null;
  /** Engine tunables the server replayed under. */
  engineConfigVersion: string;
  /** Independent all-topics replay (own streak) — not a sum of `categories`. */
  global: { score: number; streak: number; gamesPlayed: number };
  /** One entry per topic with ≥ 1 post-epoch round on the server. */
  categories: CategoryScore[];
  /** Total events the server holds for this install (or account, when bound). */
  totalRounds: number;
  /** Epoch ms when the server computed this snapshot. */
  computedAt: number;
}

/**
 * ─── Accounts & transfer-code claim (P4-T9) ──────────────────────────────────
 * Anonymous play stays the default identity (the installId). An "account" is a
 * server-minted id that OWNS the merged history of one or more installs; a device
 * opts in by minting a single-use TRANSFER CODE and another device claims it. No
 * third-party provider (owner decision) — the code is the bearer credential.
 */

/** `POST /v1/account/code` response — a fresh single-use transfer code. */
export interface ClaimCodeResponse {
  /** The account the code claims into (created lazily binding the calling install). */
  accountId: string;
  /** Short, human-typeable, single-use. */
  code: string;
  /** Epoch ms after which the code no longer redeems. */
  expiresAt: number;
}

/** `POST /v1/account/claim` request — redeem a transfer code on another install. */
export interface ClaimRequest {
  installId: string;
  code: string;
}

/**
 * `POST /v1/account/claim` response. On success the caller adopts `events` locally
 * (same restore path as reinstall) and holds the merged `snapshot`. On failure
 * `reason` names a DESIGNED state — `already_claimed` is the F12 case (this install
 * already belongs to an account; the UI offers "keep playing here or contact support").
 */
export interface ClaimResponse {
  ok: boolean;
  accountId: string | null;
  snapshot?: PlayerSnapshot;
  events?: RoundEvent[];
  reason?: 'unknown_code' | 'already_claimed';
}

/**
 * `POST /v1/rounds` request (ingestion, T11). A batch of unsynced events for one
 * install. Idempotent on `roundId` — re-uploading a batch (or part of one) changes
 * nothing server-side. No auth: the anonymous installId is the identity (Phase 3).
 */
export interface SyncUploadRequest {
  installId: string;
  /** ROUND_EVENT_SCHEMA_VERSION of the events within. */
  schemaVersion: number;
  events: RoundEvent[];
}

/**
 * `POST /v1/rounds` response. Every uploaded roundId lands in exactly one of the
 * three lists; the client marks `syncedAt` for accepted + duplicate ids (duplicates
 * were already safely stored — that's idempotency, not an error).
 */
export interface SyncUploadResponse {
  /** Stored this request. */
  acceptedRoundIds: string[];
  /** Already stored by an earlier upload — safe to mark synced. */
  duplicateRoundIds: string[];
  /** Failed validation — NOT stored; client keeps them local and surfaces a diagnostic. */
  rejectedRoundIds: string[];
  /** Authoritative post-replay state; on divergence the client heals its cache from this. */
  snapshot: PlayerSnapshot;
}

/**
 * `GET /v1/me` response (sync-down, T13). `events` is present only when the client
 * asks (`?includeEvents=1` — the reinstall-restore path): the install's full stored
 * log, which the client re-appends locally so every local replay (global score,
 * per-category scores/streaks, seenIds for selection) restores from the truth
 * itself rather than trusting a number.
 */
export interface SyncDownResponse {
  snapshot: PlayerSnapshot;
  events?: RoundEvent[];
}

/**
 * ─── Word slices (T2/T8–T10) ─────────────────────────────────────────────────
 * The online word bank is published as versioned static files: one slice per
 * (topic × tier), plus one manifest per bank version. Tier slices supersede the
 * Elo-era overlapping rating bands: selection is tier-driven (`tierForScore` +
 * nearest-tier spill), so the natural download unit is the tier — spill coverage
 * comes from holding a topic's neighbouring tiers, not from overlapping cuts.
 */

export const WORD_SLICE_SCHEMA_VERSION = 1 as const;

/** One downloadable slice's entry in the manifest. */
export interface WordSliceRef {
  /** Identity key (URL-safe; slices are pathed by it). */
  topicId: TopicId;
  /** Bank topic display string (matches `WordEntry.topic`). */
  topic: string;
  /** A slice cell's tier — unified four post-3.0.0, legacy trio on old banks (BankScale). */
  tier: BankTier;
  /**
   * Monotonic per-slice content version — bumps ONLY when this slice's words
   * change, so an unchanged slice is never re-downloaded across bank versions.
   */
  sliceVersion: number;
  /** Fetch path, relative to the manifest's URL (content-addressed, immutable). */
  url: string;
  wordCount: number;
  /** Uncompressed byte size of the slice file. */
  bytes: number;
  /** SHA-256 (hex) of the slice file — integrity check before the atomic swap. */
  sha256: string;
}

/**
 * The manifest the client polls (stable URL, short cache). Lists every slice of one
 * published bank version.
 */
export interface WordSliceManifest {
  schemaVersion: number;
  /** The bank publish this manifest describes (semver — see VERSIONING.md). */
  wordBankVersion: string;
  /** ISO 8601 publish timestamp. */
  generatedAt: string;
  slices: WordSliceRef[];
}

/** A slice file's content — self-describing so a cached file can be trusted alone. */
export interface WordSlice {
  schemaVersion: number;
  wordBankVersion: string;
  topicId: TopicId;
  topic: string;
  /** A slice cell's tier — unified four post-3.0.0, legacy trio on old banks (BankScale). */
  tier: BankTier;
  sliceVersion: number;
  words: WordEntry[];
}
