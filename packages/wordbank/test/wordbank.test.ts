import { test } from 'node:test';
import assert from 'node:assert/strict';

import { UNIFIED_TIERS } from '@sabd/contracts';
import {
  words,
  size,
  getWord,
  wordsByTopic,
  topics,
  wordBankVersion,
  validateBank,
  unifiedWords,
  unifiedWordsByTopic,
  unifiedBankVersion,
  unifiedBankScale,
  validateUnifiedBank,
} from '../src/index.ts';

test('bank loads with a version stamp', () => {
  assert.ok(size > 0);
  assert.equal(words.length, size);
  assert.match(wordBankVersion, /^\d+\.\d+\.\d+$/);
});

test('every entry satisfies the WordEntry contract', () => {
  const errors = validateBank();
  assert.deepEqual(errors, [], `bank has ${errors.length} contract violations:\n${errors.join('\n')}`);
});

test('getWord round-trips a real id', () => {
  const first = words[0];
  assert.ok(first);
  assert.equal(getWord(first.id)?.id, first.id);
  assert.equal(getWord('does-not-exist'), undefined);
});

test('wordsByTopic + topics agree with the data', () => {
  const ts = topics();
  assert.ok(ts.length >= 1);
  for (const t of ts) {
    const inTopic = wordsByTopic(t);
    assert.ok(inTopic.length > 0);
    assert.ok(inTopic.every((w) => w.topic === t));
  }
  // topic counts partition the bank
  const total = ts.reduce((n, t) => n + wordsByTopic(t).length, 0);
  assert.equal(total, size);
});

// ─── The unified bank (Phase 4, P4-T4/T5/T6) ─────────────────────────────────

const UNIFIED_BANDS: Record<string, [number, number]> = {
  veryEasy: [0, 50],
  easy: [51, 150],
  medium: [151, 350],
  hard: [351, 500],
};

test('unified bank loads, self-describes its scale, and passes the contract', () => {
  assert.ok(unifiedWords.length >= 1200, `expected 1200+, got ${unifiedWords.length}`);
  assert.match(unifiedBankVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(unifiedBankScale, 'unified'); // F5: a bank is self-describing
  const errors = validateUnifiedBank();
  assert.deepEqual(errors, [], `unified bank has ${errors.length} contract violations:\n${errors.join('\n')}`);
});

test('P4-T4 — every topic holds 200+ words on the four-tier scale', () => {
  const ts = [...new Set(unifiedWords.map((w) => w.topic))];
  assert.equal(ts.length, 6);
  for (const t of ts) {
    assert.ok(unifiedWordsByTopic(t).length >= 200, `${t}: only ${unifiedWordsByTopic(t).length} words`);
  }
});

test('P4-T5 — stock audit: no tier below 15% of its topic (hard is genuinely stocked)', () => {
  for (const t of [...new Set(unifiedWords.map((w) => w.topic))]) {
    const inTopic = unifiedWordsByTopic(t);
    for (const tier of UNIFIED_TIERS) {
      const n = inTopic.filter((w) => w.tier === tier).length;
      const share = n / inTopic.length;
      assert.ok(share >= 0.15, `${t}/${tier}: ${n} words (${(share * 100).toFixed(1)}% < 15%)`);
    }
  }
});

test('unified difficulties sit inside their tier bands (band coherence)', () => {
  for (const w of unifiedWords) {
    const band = UNIFIED_BANDS[w.tier];
    assert.ok(band, `${w.id} ${w.word}: tier ${w.tier} is not a unified tier`);
    assert.ok(
      w.difficulty >= band[0] && w.difficulty <= band[1],
      `${w.id} ${w.word}: difficulty ${w.difficulty} outside ${w.tier} band ${band[0]}–${band[1]}`,
    );
  }
});

test('P4-T6 — hint integrity + description rules hold across the whole unified bank', () => {
  for (const w of unifiedWords) {
    // position hint points at a real slot and the letter matches
    const pos = w.hints.position;
    assert.ok(pos.index >= 0 && pos.index < w.word.length, `${w.id}: position.index out of range`);
    assert.equal(pos.letter, w.word[pos.index], `${w.id}: position.letter mismatch`);
    // correct letter is in the word; the decoy is NOT
    assert.ok(w.word.includes(w.hints.letters.correct), `${w.id}: correct letter not in word`);
    assert.ok(!w.word.includes(w.hints.letters.decoy), `${w.id}: decoy letter IS in word`);
    // description: ≤12 words, and no token contains the answer
    const tokens = w.description.trim().split(/\s+/);
    assert.ok(tokens.length <= 12, `${w.id}: description has ${tokens.length} words`);
    const leak = w.description
      .toUpperCase()
      .split(/[^A-Z]+/)
      .some((tok) => tok.includes(w.word));
    assert.ok(!leak, `${w.id} ${w.word}: description leaks the word`);
  }
});

test('no duplicate words within a topic; ids are unique bank-wide', () => {
  const ids = new Set<string>();
  const perTopic = new Map<string, Set<string>>();
  for (const w of unifiedWords) {
    assert.ok(!ids.has(w.id), `duplicate id ${w.id}`);
    ids.add(w.id);
    const seen = perTopic.get(w.topic) ?? new Set<string>();
    assert.ok(!seen.has(w.word), `duplicate word ${w.word} in ${w.topic}`);
    seen.add(w.word);
    perTopic.set(w.topic, seen);
  }
});
