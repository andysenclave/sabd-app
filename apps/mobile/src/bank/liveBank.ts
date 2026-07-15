/**
 * The live word bank (T10) — the bundled bank with downloaded slices layered on top.
 *
 * Merge semantics: a downloaded slice REPLACES the bundled words of its
 * (topic × tier) cell — it is authoritative for that cell (a correction may remove
 * or re-tier a word; a union would resurrect it). Cells with no downloaded slice
 * fall back to the bundled bank, so a fresh offline install plays exactly Phase-2
 * behaviour. Selection (selectWord.ts) reads ONLY bankWords()/bankTopics().
 */

import type { WordEntry, WordSlice } from '@sabd/contracts';
import { BANK_TOPICS, topicIdForBankTopic } from '@sabd/contracts';
import { words as bundledWords, wordBankVersion as bundledVersion } from '@sabd/wordbank';

/** cellKey = `${topicId}/${tier}` */
const overrides = new Map<string, WordSlice>();

function cellOf(w: WordEntry): string | null {
  const topicId = topicIdForBankTopic(w.topic);
  return topicId === null || topicId === undefined ? null : `${topicId}/${w.tier}`;
}

let merged: readonly WordEntry[] | null = null;

/** The current playable bank. Memoized; invalidated when a slice lands. */
export function bankWords(): readonly WordEntry[] {
  if (merged !== null) return merged;
  if (overrides.size === 0) {
    merged = bundledWords;
    return merged;
  }
  const out: WordEntry[] = [];
  // Bundled words whose cell is NOT overridden…
  for (const w of bundledWords) {
    const cell = cellOf(w);
    if (cell === null || !overrides.has(cell)) out.push(w);
  }
  // …plus every overridden cell's downloaded words.
  for (const slice of overrides.values()) out.push(...slice.words);
  merged = out;
  return merged;
}

/** Bank topics that currently have words (drives which Home cards are playable). */
export function bankTopics(): ReadonlySet<string> {
  return new Set(bankWords().map((w) => w.topic));
}

/** Apply downloaded slices (boot: everything on disk; after sync: the updated ones). */
export function applySlices(slices: readonly WordSlice[]): void {
  for (const s of slices) {
    // Only canonical cells can override; validateWordSlice already guarantees this.
    if (BANK_TOPICS[s.topicId] !== s.topic) continue;
    overrides.set(`${s.topicId}/${s.tier}`, s);
  }
  if (slices.length > 0) merged = null; // invalidate the memo
}

/** Installed slice versions, for the sync pass's "what changed" comparison. */
export function installedVersions(): ReadonlyMap<string, number> {
  return new Map([...overrides.entries()].map(([cell, s]) => [cell, s.sliceVersion]));
}

/** Numeric semver compare (no prerelease handling — bank versions are plain x.y.z). */
function semverGt(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

/** The bank version the player is effectively on (highest slice version wins the label). */
export function effectiveBankVersion(): string {
  let v = bundledVersion;
  for (const s of overrides.values()) {
    if (semverGt(s.wordBankVersion, v)) v = s.wordBankVersion;
  }
  return v;
}

/** Test/debug only. */
export function resetLiveBank(): void {
  overrides.clear();
  merged = null;
}
