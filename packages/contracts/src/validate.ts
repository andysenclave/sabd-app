/**
 * @sabd/contracts — dependency-free runtime validators.
 *
 * Small on purpose: no zod, no ajv. These run in the RN app (export self-check, T23),
 * in the content pipeline (T6/T7), and in the node analysis script (T28). Each returns
 * a discriminated result carrying a flat list of dotted-path error strings.
 */

import type {
  BankTier,
  CategoryScore,
  ClaimCodeResponse,
  ClaimResponse,
  ExportFile,
  GameMode,
  PaidHint,
  PlayerSnapshot,
  RoundEvent,
  RoundResult,
  SyncDownResponse,
  SyncUploadRequest,
  SyncUploadResponse,
  TopicId,
  UnifiedTier,
  WordEntry,
  WordSlice,
  WordSliceManifest,
  WordSliceRef,
  WordTier,
} from './types.ts';

export const WORD_TIERS: readonly WordTier[] = ['low', 'mid', 'high'];
/** Phase 4: the unified (0–500) scale's four tiers, ascending. */
export const UNIFIED_TIERS: readonly UnifiedTier[] = ['veryEasy', 'easy', 'medium', 'hard'];
/** Every tier name a bank entry may carry, across both scales. */
export const BANK_TIERS: readonly BankTier[] = [...WORD_TIERS, ...UNIFIED_TIERS];
export const PAID_HINTS: readonly PaidHint[] = ['position', 'letters'];
export const GAME_MODES: readonly GameMode[] = ['solo', '1v1'];
export const TOPIC_IDS: readonly TopicId[] = [
  'gaming',
  'space',
  'music',
  'internet',
  'food',
  'world',
];

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly string[] };

/** Internal accumulator — collects dotted-path errors, then narrows on `ok`. */
class Checker {
  readonly errors: string[] = [];

  fail(path: string, message: string): void {
    this.errors.push(`${path}: ${message}`);
  }

  isObject(v: unknown, path: string): v is Record<string, unknown> {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      this.fail(path, `expected object, got ${describe(v)}`);
      return false;
    }
    return true;
  }

  string(v: unknown, path: string): v is string {
    if (typeof v !== 'string') {
      this.fail(path, `expected string, got ${describe(v)}`);
      return false;
    }
    return true;
  }

  nonEmptyString(v: unknown, path: string): v is string {
    if (!this.string(v, path)) return false;
    if (v.length === 0) {
      this.fail(path, 'expected non-empty string');
      return false;
    }
    return true;
  }

  number(v: unknown, path: string): v is number {
    if (typeof v !== 'number' || Number.isNaN(v)) {
      this.fail(path, `expected number, got ${describe(v)}`);
      return false;
    }
    return true;
  }

  integer(v: unknown, path: string): v is number {
    if (!this.number(v, path)) return false;
    if (!Number.isInteger(v)) {
      this.fail(path, `expected integer, got ${v}`);
      return false;
    }
    return true;
  }

  boolean(v: unknown, path: string): v is boolean {
    if (typeof v !== 'boolean') {
      this.fail(path, `expected boolean, got ${describe(v)}`);
      return false;
    }
    return true;
  }

  oneOf<T extends string>(v: unknown, allowed: readonly T[], path: string): v is T {
    if (typeof v !== 'string' || !allowed.includes(v as T)) {
      this.fail(path, `expected one of [${allowed.join(', ')}], got ${describe(v)}`);
      return false;
    }
    return true;
  }
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function result<T>(c: Checker, value: T): ValidationResult<T> {
  return c.errors.length === 0
    ? { ok: true, value }
    : { ok: false, errors: [...c.errors] };
}

// ─── WordEntry ───────────────────────────────────────────────────────────────

export function validateWordEntry(input: unknown, path = 'wordEntry'): ValidationResult<WordEntry> {
  const c = new Checker();
  if (!c.isObject(input, path)) return { ok: false, errors: [...c.errors] };

  c.nonEmptyString(input['id'], `${path}.id`);
  c.nonEmptyString(input['word'], `${path}.word`);
  c.nonEmptyString(input['topic'], `${path}.topic`);
  // Either scale's vocabulary — the carrying bank/slice declares which (BankScale);
  // per-scale band coherence is the content pipeline's job, not this shape check.
  c.oneOf(input['tier'], BANK_TIERS, `${path}.tier`);
  c.nonEmptyString(input['description'], `${path}.description`);
  // Optional second clue (legacy entries predate it); when present it must be real.
  if (input['altDescription'] !== undefined) {
    c.nonEmptyString(input['altDescription'], `${path}.altDescription`);
  }

  const lengthOk = c.integer(input['length'], `${path}.length`);
  c.number(input['difficulty'], `${path}.difficulty`);

  // length must match the word (a common content bug — guard it).
  if (lengthOk && typeof input['word'] === 'string' && input['word'].length !== input['length']) {
    c.fail(`${path}.length`, `length ${String(input['length'])} != word.length ${input['word'].length}`);
  }

  const hints = input['hints'];
  if (c.isObject(hints, `${path}.hints`)) {
    const pos = hints['position'];
    if (c.isObject(pos, `${path}.hints.position`)) {
      c.integer(pos['index'], `${path}.hints.position.index`);
      c.nonEmptyString(pos['letter'], `${path}.hints.position.letter`);
    }
    const letters = hints['letters'];
    if (c.isObject(letters, `${path}.hints.letters`)) {
      c.nonEmptyString(letters['correct'], `${path}.hints.letters.correct`);
      c.nonEmptyString(letters['decoy'], `${path}.hints.letters.decoy`);
    }
  }

  return result(c, input as unknown as WordEntry);
}

export function isWordEntry(input: unknown): input is WordEntry {
  return validateWordEntry(input).ok;
}

// ─── RoundResult ─────────────────────────────────────────────────────────────

export function validateRoundResult(
  input: unknown,
  path = 'roundResult',
): ValidationResult<RoundResult> {
  const c = new Checker();
  if (!c.isObject(input, path)) return { ok: false, errors: [...c.errors] };

  c.boolean(input['solved'], `${path}.solved`);
  c.number(input['timeLimitSec'], `${path}.timeLimitSec`);
  c.number(input['timeUsedSec'], `${path}.timeUsedSec`);
  c.number(input['wordDifficulty'], `${path}.wordDifficulty`);
  c.oneOf(input['mode'], GAME_MODES, `${path}.mode`);
  validateHintsUsed(c, input['hintsUsed'], `${path}.hintsUsed`);

  return result(c, input as unknown as RoundResult);
}

function validateHintsUsed(c: Checker, v: unknown, path: string): void {
  if (!Array.isArray(v)) {
    c.fail(path, `expected array, got ${describe(v)}`);
    return;
  }
  if (v.length > PAID_HINTS.length) c.fail(path, `at most ${PAID_HINTS.length} hints`);
  const seen = new Set<unknown>();
  v.forEach((h, i) => {
    c.oneOf(h, PAID_HINTS, `${path}[${i}]`);
    if (seen.has(h)) c.fail(`${path}[${i}]`, `duplicate hint ${describe(h)}`);
    seen.add(h);
  });
}

// ─── RoundEvent (LOCKED — event-log doc §4, schema v1) ───────────────────────

export function validateRoundEvent(input: unknown, path = 'roundEvent'): ValidationResult<RoundEvent> {
  const c = new Checker();
  if (!c.isObject(input, path)) return { ok: false, errors: [...c.errors] };

  c.nonEmptyString(input['roundId'], `${path}.roundId`);
  c.integer(input['schemaVersion'], `${path}.schemaVersion`);
  c.nonEmptyString(input['installId'], `${path}.installId`);
  c.number(input['playedAt'], `${path}.playedAt`);

  c.nonEmptyString(input['wordId'], `${path}.wordId`);
  c.number(input['wordRatingAtPlay'], `${path}.wordRatingAtPlay`);
  c.nonEmptyString(input['wordBankVersion'], `${path}.wordBankVersion`);
  c.nonEmptyString(input['topic'], `${path}.topic`);

  c.boolean(input['solved'], `${path}.solved`);
  c.number(input['timeLimitSec'], `${path}.timeLimitSec`);
  c.number(input['timeUsedSec'], `${path}.timeUsedSec`);
  validateHintsUsed(c, input['hintsUsed'], `${path}.hintsUsed`);
  c.oneOf(input['mode'], GAME_MODES, `${path}.mode`);

  c.number(input['playerRatingBefore'], `${path}.playerRatingBefore`);
  c.nonEmptyString(input['engineConfigVersion'], `${path}.engineConfigVersion`);

  if (input['anomaly'] !== undefined) c.boolean(input['anomaly'], `${path}.anomaly`);
  if (input['syncedAt'] !== null) c.number(input['syncedAt'], `${path}.syncedAt`);

  return result(c, input as unknown as RoundEvent);
}

export function isRoundEvent(input: unknown): input is RoundEvent {
  return validateRoundEvent(input).ok;
}

// ─── ExportFile (playtest-analysis doc §2) ───────────────────────────────────

export function validateExportFile(input: unknown, path = 'export'): ValidationResult<ExportFile> {
  const c = new Checker();
  if (!c.isObject(input, path)) return { ok: false, errors: [...c.errors] };

  c.nonEmptyString(input['installId'], `${path}.installId`);
  c.integer(input['schemaVersion'], `${path}.schemaVersion`);
  c.number(input['exportedAt'], `${path}.exportedAt`);

  const rounds = input['rounds'];
  if (!Array.isArray(rounds)) {
    c.fail(`${path}.rounds`, `expected array, got ${describe(rounds)}`);
  } else {
    rounds.forEach((r, i) => {
      const rr = validateRoundEvent(r, `${path}.rounds[${i}]`);
      if (!rr.ok) c.errors.push(...rr.errors);
    });
  }

  return result(c, input as unknown as ExportFile);
}

// ─── Phase 3: sync payloads (T1) ─────────────────────────────────────────────

/** score/streak/gamesPlayed are all non-negative integers (monotonic points engine). */
function nonNegativeInteger(c: Checker, v: unknown, path: string): void {
  if (!c.integer(v, path)) return;
  if ((v as number) < 0) c.fail(path, `expected >= 0, got ${String(v)}`);
}

export function validateCategoryScore(
  input: unknown,
  path = 'categoryScore',
): ValidationResult<CategoryScore> {
  const c = new Checker();
  if (!c.isObject(input, path)) return { ok: false, errors: [...c.errors] };

  c.nonEmptyString(input['topic'], `${path}.topic`);
  nonNegativeInteger(c, input['score'], `${path}.score`);
  nonNegativeInteger(c, input['streak'], `${path}.streak`);
  nonNegativeInteger(c, input['gamesPlayed'], `${path}.gamesPlayed`);

  return result(c, input as unknown as CategoryScore);
}

export function validatePlayerSnapshot(
  input: unknown,
  path = 'snapshot',
): ValidationResult<PlayerSnapshot> {
  const c = new Checker();
  if (!c.isObject(input, path)) return { ok: false, errors: [...c.errors] };

  c.nonEmptyString(input['installId'], `${path}.installId`);
  c.nonEmptyString(input['engineConfigVersion'], `${path}.engineConfigVersion`);
  nonNegativeInteger(c, input['totalRounds'], `${path}.totalRounds`);
  c.number(input['computedAt'], `${path}.computedAt`);

  const global = input['global'];
  if (c.isObject(global, `${path}.global`)) {
    nonNegativeInteger(c, global['score'], `${path}.global.score`);
    nonNegativeInteger(c, global['streak'], `${path}.global.streak`);
    nonNegativeInteger(c, global['gamesPlayed'], `${path}.global.gamesPlayed`);
  }

  const categories = input['categories'];
  if (!Array.isArray(categories)) {
    c.fail(`${path}.categories`, `expected array, got ${describe(categories)}`);
  } else {
    categories.forEach((cat, i) => {
      const r = validateCategoryScore(cat, `${path}.categories[${i}]`);
      if (!r.ok) c.errors.push(...r.errors);
    });
  }

  return result(c, input as unknown as PlayerSnapshot);
}

export function validateClaimCodeResponse(
  input: unknown,
  path = 'claimCode',
): ValidationResult<ClaimCodeResponse> {
  const c = new Checker();
  if (!c.isObject(input, path)) return { ok: false, errors: [...c.errors] };
  c.nonEmptyString(input['accountId'], `${path}.accountId`);
  c.nonEmptyString(input['code'], `${path}.code`);
  c.number(input['expiresAt'], `${path}.expiresAt`);
  return result(c, input as unknown as ClaimCodeResponse);
}

export function validateClaimResponse(
  input: unknown,
  path = 'claim',
): ValidationResult<ClaimResponse> {
  const c = new Checker();
  if (!c.isObject(input, path)) return { ok: false, errors: [...c.errors] };
  c.boolean(input['ok'], `${path}.ok`);
  // accountId is string on success, null on rejection — both valid.
  if (input['accountId'] !== null) c.nonEmptyString(input['accountId'], `${path}.accountId`);
  if (input['snapshot'] !== undefined) {
    const r = validatePlayerSnapshot(input['snapshot'], `${path}.snapshot`);
    if (!r.ok) c.errors.push(...r.errors);
  }
  if (input['events'] !== undefined) {
    if (!Array.isArray(input['events'])) c.fail(`${path}.events`, 'expected array');
    else input['events'].forEach((e, i) => {
      const r = validateRoundEvent(e, `${path}.events[${i}]`);
      if (!r.ok) c.errors.push(...r.errors);
    });
  }
  return result(c, input as unknown as ClaimResponse);
}

export function validateSyncUploadRequest(
  input: unknown,
  path = 'syncUpload',
): ValidationResult<SyncUploadRequest> {
  const c = new Checker();
  if (!c.isObject(input, path)) return { ok: false, errors: [...c.errors] };

  c.nonEmptyString(input['installId'], `${path}.installId`);
  c.integer(input['schemaVersion'], `${path}.schemaVersion`);

  const events = input['events'];
  if (!Array.isArray(events)) {
    c.fail(`${path}.events`, `expected array, got ${describe(events)}`);
  } else {
    events.forEach((e, i) => {
      const r = validateRoundEvent(e, `${path}.events[${i}]`);
      if (!r.ok) c.errors.push(...r.errors);
      // Every event in the batch must belong to the batch's install — a mixed batch
      // is a client defect, and silently accepting it would misattribute rounds.
      else if (typeof input['installId'] === 'string' && r.value.installId !== input['installId']) {
        c.fail(`${path}.events[${i}].installId`, 'does not match batch installId');
      }
    });
  }

  return result(c, input as unknown as SyncUploadRequest);
}

export function validateSyncUploadResponse(
  input: unknown,
  path = 'syncUploadResponse',
): ValidationResult<SyncUploadResponse> {
  const c = new Checker();
  if (!c.isObject(input, path)) return { ok: false, errors: [...c.errors] };

  for (const key of ['acceptedRoundIds', 'duplicateRoundIds', 'rejectedRoundIds'] as const) {
    const ids = input[key];
    if (!Array.isArray(ids)) {
      c.fail(`${path}.${key}`, `expected array, got ${describe(ids)}`);
    } else {
      ids.forEach((id, i) => c.nonEmptyString(id, `${path}.${key}[${i}]`));
    }
  }

  const snap = validatePlayerSnapshot(input['snapshot'], `${path}.snapshot`);
  if (!snap.ok) c.errors.push(...snap.errors);

  return result(c, input as unknown as SyncUploadResponse);
}

export function validateSyncDownResponse(
  input: unknown,
  path = 'syncDown',
): ValidationResult<SyncDownResponse> {
  const c = new Checker();
  if (!c.isObject(input, path)) return { ok: false, errors: [...c.errors] };

  const snap = validatePlayerSnapshot(input['snapshot'], `${path}.snapshot`);
  if (!snap.ok) c.errors.push(...snap.errors);

  if (input['events'] !== undefined) {
    const events = input['events'];
    if (!Array.isArray(events)) {
      c.fail(`${path}.events`, `expected array, got ${describe(events)}`);
    } else {
      events.forEach((e, i) => {
        const r = validateRoundEvent(e, `${path}.events[${i}]`);
        if (!r.ok) c.errors.push(...r.errors);
      });
    }
  }

  return result(c, input as unknown as SyncDownResponse);
}

// ─── Phase 3: word slices (T2) ───────────────────────────────────────────────

const SHA256_HEX = /^[0-9a-f]{64}$/;

export function validateWordSliceRef(
  input: unknown,
  path = 'sliceRef',
): ValidationResult<WordSliceRef> {
  const c = new Checker();
  if (!c.isObject(input, path)) return { ok: false, errors: [...c.errors] };

  c.oneOf(input['topicId'], TOPIC_IDS, `${path}.topicId`);
  c.nonEmptyString(input['topic'], `${path}.topic`);
  c.oneOf(input['tier'], BANK_TIERS, `${path}.tier`);
  nonNegativeInteger(c, input['sliceVersion'], `${path}.sliceVersion`);
  c.nonEmptyString(input['url'], `${path}.url`);
  nonNegativeInteger(c, input['wordCount'], `${path}.wordCount`);
  nonNegativeInteger(c, input['bytes'], `${path}.bytes`);
  if (c.nonEmptyString(input['sha256'], `${path}.sha256`) && !SHA256_HEX.test(input['sha256'] as string)) {
    c.fail(`${path}.sha256`, 'expected 64 lowercase hex chars');
  }

  return result(c, input as unknown as WordSliceRef);
}

export function validateWordSliceManifest(
  input: unknown,
  path = 'manifest',
): ValidationResult<WordSliceManifest> {
  const c = new Checker();
  if (!c.isObject(input, path)) return { ok: false, errors: [...c.errors] };

  c.integer(input['schemaVersion'], `${path}.schemaVersion`);
  c.nonEmptyString(input['wordBankVersion'], `${path}.wordBankVersion`);
  c.nonEmptyString(input['generatedAt'], `${path}.generatedAt`);

  const slices = input['slices'];
  if (!Array.isArray(slices)) {
    c.fail(`${path}.slices`, `expected array, got ${describe(slices)}`);
  } else {
    const seen = new Set<string>();
    slices.forEach((s, i) => {
      const r = validateWordSliceRef(s, `${path}.slices[${i}]`);
      if (!r.ok) {
        c.errors.push(...r.errors);
        return;
      }
      // One slice per (topicId × tier) per manifest — duplicates make the client's
      // "which version do I hold" question unanswerable.
      const key = `${r.value.topicId}/${r.value.tier}`;
      if (seen.has(key)) c.fail(`${path}.slices[${i}]`, `duplicate slice for ${key}`);
      seen.add(key);
    });
  }

  return result(c, input as unknown as WordSliceManifest);
}

export function validateWordSlice(input: unknown, path = 'slice'): ValidationResult<WordSlice> {
  const c = new Checker();
  if (!c.isObject(input, path)) return { ok: false, errors: [...c.errors] };

  c.integer(input['schemaVersion'], `${path}.schemaVersion`);
  c.nonEmptyString(input['wordBankVersion'], `${path}.wordBankVersion`);
  c.oneOf(input['topicId'], TOPIC_IDS, `${path}.topicId`);
  c.nonEmptyString(input['topic'], `${path}.topic`);
  c.oneOf(input['tier'], BANK_TIERS, `${path}.tier`);
  nonNegativeInteger(c, input['sliceVersion'], `${path}.sliceVersion`);

  const words = input['words'];
  if (!Array.isArray(words)) {
    c.fail(`${path}.words`, `expected array, got ${describe(words)}`);
  } else {
    words.forEach((w, i) => {
      const r = validateWordEntry(w, `${path}.words[${i}]`);
      if (!r.ok) {
        c.errors.push(...r.errors);
        return;
      }
      // Slice coherence: every word must belong to the slice's topic and tier.
      if (typeof input['topic'] === 'string' && r.value.topic !== input['topic']) {
        c.fail(`${path}.words[${i}].topic`, `does not match slice topic ${String(input['topic'])}`);
      }
      if (typeof input['tier'] === 'string' && r.value.tier !== input['tier']) {
        c.fail(`${path}.words[${i}].tier`, `does not match slice tier ${String(input['tier'])}`);
      }
    });
  }

  return result(c, input as unknown as WordSlice);
}
