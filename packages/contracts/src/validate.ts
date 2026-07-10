/**
 * @sabd/contracts — dependency-free runtime validators.
 *
 * Small on purpose: no zod, no ajv. These run in the RN app (export self-check, T23),
 * in the content pipeline (T6/T7), and in the node analysis script (T28). Each returns
 * a discriminated result carrying a flat list of dotted-path error strings.
 */

import type {
  ExportFile,
  GameMode,
  PaidHint,
  RoundEvent,
  RoundResult,
  TopicId,
  WordEntry,
  WordTier,
} from './types.ts';

export const WORD_TIERS: readonly WordTier[] = ['low', 'mid', 'high'];
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
  c.oneOf(input['tier'], WORD_TIERS, `${path}.tier`);
  c.nonEmptyString(input['description'], `${path}.description`);

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
  c.number(input['opponentRating'], `${path}.opponentRating`);
  c.number(input['playerRating'], `${path}.playerRating`);
  c.integer(input['gamesPlayed'], `${path}.gamesPlayed`);
  c.oneOf(input['mode'], GAME_MODES, `${path}.mode`);
  c.boolean(input['challengeMode'], `${path}.challengeMode`);
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
