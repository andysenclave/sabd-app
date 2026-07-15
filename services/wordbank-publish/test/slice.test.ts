/**
 * T8 slicing core: per-(topic × tier) cuts, per-slice monotonic versioning,
 * unchanged-slice reuse (immutability), contract validity of every output.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { WordEntry } from '@sabd/contracts';
import { BANK_TOPICS, TOPIC_IDS, validateWordSlice, validateWordSliceManifest } from '@sabd/contracts';
import { cutSlices, serializeSlice, sliceContentKey } from '../src/index.ts';

let seq = 0;
function word(topic: string, tier: 'low' | 'mid' | 'high', id?: string): WordEntry {
  const w = `W${String(++seq).padStart(3, '0')}`;
  return {
    id: id ?? `${topic.slice(0, 3).toUpperCase()}-${String(seq).padStart(4, '0')}`,
    word: w,
    topic,
    length: w.length,
    difficulty: tier === 'low' ? 900 : tier === 'mid' ? 1400 : 1800,
    tier,
    description: 'A test word, nothing more',
    hints: { position: { index: 0, letter: 'W' }, letters: { correct: 'W', decoy: 'X' } },
  };
}

const GAMING = BANK_TOPICS.gaming;
const MUSIC = BANK_TOPICS.music;

function smallBank(): WordEntry[] {
  return [
    word(GAMING, 'low'),
    word(GAMING, 'low'),
    word(GAMING, 'mid'),
    word(MUSIC, 'high'),
  ];
}

test('cutSlices produces one slice per (topicId × tier), all contract-valid', () => {
  const { manifest, slices } = cutSlices(smallBank(), '1.1.0', '2026-07-15T00:00:00.000Z', null, new Map());

  assert.equal(slices.length, TOPIC_IDS.length * 3);
  assert.equal(validateWordSliceManifest(manifest).ok, true);
  for (const s of slices) {
    assert.notEqual(s.fileJson, null); // first publish: every slice is new
    assert.equal(validateWordSlice(JSON.parse(s.fileJson!)).ok, true);
    assert.equal(s.ref.sliceVersion, 1);
    assert.equal(s.ref.url, `slices/${s.ref.topicId}/${s.ref.tier}/v1.json`);
  }

  const gamingLow = slices.find((s) => s.ref.topicId === 'gaming' && s.ref.tier === 'low')!;
  assert.equal(gamingLow.ref.wordCount, 2);
  // Empty slices are still published (client learns "empty", not "missing").
  const musicLow = slices.find((s) => s.ref.topicId === 'music' && s.ref.tier === 'low')!;
  assert.equal(musicLow.ref.wordCount, 0);
});

test('an unchanged slice keeps its ref verbatim and writes no file (immutability)', () => {
  const bank = smallBank();
  const first = cutSlices(bank, '1.1.0', '2026-07-15T00:00:00.000Z', null, new Map());

  // Second publish, same words, new bank version — as after a correction that
  // touched nothing (or only other topics).
  const prevKeys = new Map(
    first.slices.map((s) => [
      `${s.ref.topicId}/${s.ref.tier}`,
      sliceContentKey(JSON.parse(s.fileJson!).words),
    ]),
  );
  const second = cutSlices(bank, '1.1.1', '2026-07-16T00:00:00.000Z', first.manifest, prevKeys);

  assert.equal(second.manifest.wordBankVersion, '1.1.1');
  for (const s of second.slices) {
    assert.equal(s.fileJson, null, `${s.ref.url} should be unchanged`);
    assert.equal(s.ref.sliceVersion, 1);
  }
  // Refs are identical to the first publish — same url, same sha.
  assert.deepEqual(second.manifest.slices, first.manifest.slices);
});

test('a changed slice bumps ONLY its own version; word order does not count as change', () => {
  const bank = smallBank();
  const first = cutSlices(bank, '1.1.0', '2026-07-15T00:00:00.000Z', null, new Map());
  const prevKeys = new Map(
    first.slices.map((s) => [
      `${s.ref.topicId}/${s.ref.tier}`,
      sliceContentKey(JSON.parse(s.fileJson!).words),
    ]),
  );

  // Re-rate one gaming low word (difficulty nudge — the weekly correction case),
  // and shuffle the bank order (must NOT count as a change).
  const changed = [...bank].reverse().map((w) =>
    w.topic === GAMING && w.tier === 'low' && w.id === bank[0]!.id
      ? { ...w, difficulty: 950 }
      : w,
  );
  const second = cutSlices(changed, '1.1.1', '2026-07-16T00:00:00.000Z', first.manifest, prevKeys);

  const gamingLow = second.slices.find((s) => s.ref.topicId === 'gaming' && s.ref.tier === 'low')!;
  assert.notEqual(gamingLow.fileJson, null);
  assert.equal(gamingLow.ref.sliceVersion, 2);
  assert.equal(gamingLow.ref.url, 'slices/gaming/low/v2.json');

  const untouched = second.slices.filter((s) => !(s.ref.topicId === 'gaming' && s.ref.tier === 'low'));
  for (const s of untouched) {
    assert.equal(s.fileJson, null, `${s.ref.url} should be unchanged`);
    assert.equal(s.ref.sliceVersion, 1);
  }
});

test('a word crossing tiers moves between slices (both bump)', () => {
  const bank = smallBank();
  const first = cutSlices(bank, '1.1.0', '2026-07-15T00:00:00.000Z', null, new Map());
  const prevKeys = new Map(
    first.slices.map((s) => [
      `${s.ref.topicId}/${s.ref.tier}`,
      sliceContentKey(JSON.parse(s.fileJson!).words),
    ]),
  );

  // The gaming mid word is re-rated down into low (human-approved re-tiering).
  const moved = bank.map((w) =>
    w.topic === GAMING && w.tier === 'mid' ? { ...w, tier: 'low' as const, difficulty: 1100 } : w,
  );
  const second = cutSlices(moved, '1.2.0', '2026-07-16T00:00:00.000Z', first.manifest, prevKeys);

  const low = second.slices.find((s) => s.ref.topicId === 'gaming' && s.ref.tier === 'low')!;
  const mid = second.slices.find((s) => s.ref.topicId === 'gaming' && s.ref.tier === 'mid')!;
  assert.equal(low.ref.sliceVersion, 2);
  assert.equal(low.ref.wordCount, 3);
  assert.equal(mid.ref.sliceVersion, 2);
  assert.equal(mid.ref.wordCount, 0);
});

test('unknown-topic words are excluded from slices and reported', () => {
  const bank = [...smallBank(), word('Cooking', 'low', 'COO-0001')];
  const { manifest, unknownTopicWords } = cutSlices(bank, '1.1.0', '2026-07-15T00:00:00.000Z', null, new Map());

  assert.equal(unknownTopicWords.length, 1);
  assert.equal(unknownTopicWords[0]!.id, 'COO-0001');
  const total = manifest.slices.reduce((n, s) => n + s.wordCount, 0);
  assert.equal(total, smallBank().length); // the Cooking word is in no slice
});

test('serializeSlice is deterministic regardless of input word order', () => {
  const a = word(GAMING, 'low', 'GAM-A');
  const b = word(GAMING, 'low', 'GAM-B');
  const base = {
    schemaVersion: 1,
    wordBankVersion: '1.1.0',
    topicId: 'gaming' as const,
    topic: GAMING,
    tier: 'low' as const,
    sliceVersion: 1,
  };
  assert.equal(
    serializeSlice({ ...base, words: [a, b] }),
    serializeSlice({ ...base, words: [b, a] }),
  );
});

test('the REAL merged bank cuts into a valid manifest (uses packages/wordbank data)', async () => {
  const { words } = await import('@sabd/wordbank');
  const { manifest, slices, unknownTopicWords } = cutSlices(
    [...words],
    '1.0.0',
    '2026-07-15T00:00:00.000Z',
    null,
    new Map(),
  );

  assert.equal(validateWordSliceManifest(manifest).ok, true);
  assert.equal(unknownTopicWords.length, 0, 'real bank should have only canonical topics');
  const total = manifest.slices.reduce((n, s) => n + s.wordCount, 0);
  assert.equal(total, words.length);
  for (const s of slices) {
    if (s.fileJson !== null) assert.equal(validateWordSlice(JSON.parse(s.fileJson)).ok, true);
  }
});
