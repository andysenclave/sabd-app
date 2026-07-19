/**
 * @sabd/wordbank — the loaded, typed word bank + a thin query surface.
 *
 * The data is a GENERATED TS module (`generated/word-bank.generated.ts`) produced by the
 * content pipeline's `publish` step from `data/clean/sabd-wordbank.json`. Shipping it as a
 * module (not a raw JSON import) keeps it portable across the RN app (Metro), node scripts,
 * and web without JSON-import-attribute differences.
 *
 * Regenerate with:  pnpm --filter @sabd/content-pipeline build-bank -- --version=1.0.0
 */

import type { WordEntry } from '@sabd/contracts';
import { validateWordEntry } from '@sabd/contracts';
import {
  WORD_BANK,
  WORD_BANK_VERSION,
  WORD_BANK_GENERATED_AT,
} from './generated/word-bank.generated.ts';
import {
  UNIFIED_WORD_BANK,
  UNIFIED_WORD_BANK_VERSION,
  UNIFIED_WORD_BANK_SCALE,
  UNIFIED_WORD_BANK_GENERATED_AT,
} from './generated/word-bank-unified.generated.ts';

export const wordBankVersion: string = WORD_BANK_VERSION;
export const wordBankGeneratedAt: string | null = WORD_BANK_GENERATED_AT;

/** All entries, immutable. */
export const words: readonly WordEntry[] = WORD_BANK;

const byId: ReadonlyMap<string, WordEntry> = new Map(words.map((w) => [w.id, w]));

/** Look up a single entry by id. */
export function getWord(id: string): WordEntry | undefined {
  return byId.get(id);
}

/** All entries for a topic (matched on the display `topic` string). */
export function wordsByTopic(topic: string): readonly WordEntry[] {
  return words.filter((w) => w.topic === topic);
}

/** Distinct topic display names present in the bank, in stable order. */
export function topics(): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    if (!seen.has(w.topic)) {
      seen.add(w.topic);
      out.push(w.topic);
    }
  }
  return out;
}

/** Total entry count. */
export const size: number = words.length;

/**
 * ─── The UNIFIED bank (Phase 4, P4-T4) ───────────────────────────────────────
 * The 0–500-scale, four-tier bank (veryEasy/easy/medium/hard, bottom-weighted).
 * Published ALONGSIDE the legacy bank: the app keeps serving the legacy bank under
 * engine config 2.0.0 until the gated 3.0.0 flip (edge-case F7 — veryEasy is now
 * stocked, but the flip is a deliberate step, not a side effect of this export).
 * `unifiedBankScale` is the F5 self-description — selection must only run a bank
 * whose scale matches the active config.
 */

export const unifiedBankVersion: string = UNIFIED_WORD_BANK_VERSION;
export const unifiedBankScale: string = UNIFIED_WORD_BANK_SCALE;
export const unifiedBankGeneratedAt: string | null = UNIFIED_WORD_BANK_GENERATED_AT;

/** All unified-bank entries, immutable. */
export const unifiedWords: readonly WordEntry[] = UNIFIED_WORD_BANK;

/** All unified-bank entries for a topic (matched on the display `topic` string). */
export function unifiedWordsByTopic(topic: string): readonly WordEntry[] {
  return unifiedWords.filter((w) => w.topic === topic);
}

/**
 * Validate every unified-bank entry against the WordEntry contract. Same shape as
 * `validateBank()`; the per-scale band/tier coherence beyond the contract shape is
 * enforced by the pipeline's merge audit and the package tests.
 */
export function validateUnifiedBank(): readonly string[] {
  const errors: string[] = [];
  for (const w of unifiedWords) {
    const r = validateWordEntry(w, w.id ?? 'unknown');
    if (!r.ok) errors.push(...r.errors);
  }
  return errors;
}

/**
 * Validate every entry against the WordEntry contract. Returns a flat list of
 * `id → error` strings (empty = clean). Used by tests and by the content-review pass.
 * Not run at import time so the app never crashes on load.
 */
export function validateBank(): readonly string[] {
  const errors: string[] = [];
  for (const w of words) {
    const r = validateWordEntry(w, w.id ?? 'unknown');
    if (!r.ok) errors.push(...r.errors);
  }
  return errors;
}

export type { WordEntry } from '@sabd/contracts';
