/**
 * Word selection over the real bank — difficulty follows the SCORE (tier-gated),
 * randomness within the tier, persisted-seen exclusion, session no-repeat, graceful
 * exhaustion, and tier spill when the earned tier is used up.
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { tierForScore } from '@sabd/elo';
import { words } from '@sabd/wordbank';
import { selectWord, resetSessionSeen, availableBankTopics, stockedBankTopics } from '../src/round/selectWord.ts';

beforeEach(() => resetSessionSeen());

test('a score-0 player is served low-tier words', () => {
  for (let i = 0; i < 10; i++) {
    resetSessionSeen();
    const w = selectWord({ score: 0 });
    assert.ok(w);
    assert.equal(w.tier, 'low', `${w.id} is ${w.tier}, expected low at score 0`);
  }
});

test('a mid-score player is served mid-tier, a high-score player high-tier', () => {
  const mid = selectWord({ score: 150 }); // tierForScore → mid
  assert.equal(tierForScore(150), 'mid');
  assert.equal(mid?.tier, 'mid');

  resetSessionSeen();
  const high = selectWord({ score: 500 }); // tierForScore → high
  assert.equal(tierForScore(500), 'high');
  assert.equal(high?.tier, 'high');
});

test('randomness: different rng values pick different words in the same tier', () => {
  const low = selectWord({ score: 0, rng: () => 0 });
  resetSessionSeen();
  const high = selectWord({ score: 0, rng: () => 0.999 });
  assert.ok(low && high);
  assert.notEqual(low.id, high.id);
});

test('spills to the nearest tier once the earned tier is exhausted', () => {
  // Exhaust every low-tier Gaming word, then a score-0 (low) request must spill up.
  const lowGaming = words.filter((w) => w.topic === 'Gaming' && w.tier === 'low');
  const seen = new Set(lowGaming.map((w) => w.id));
  const w = selectWord({ score: 0, topic: 'Gaming', exclude: seen });
  assert.ok(w, 'should still serve a word by spilling to an adjacent tier');
  assert.notEqual(w.tier, 'low');
});

test('never repeats within a session and respects the persisted exclude set', () => {
  const persisted = new Set<string>([words[0]!.id, words[1]!.id]);
  const seen = new Set<string>();
  for (;;) {
    const w = selectWord({ score: 250, exclude: persisted }); // any score — exhausts every tier
    if (w === null) break;
    assert.ok(!seen.has(w.id), `repeat: ${w.id}`);
    assert.ok(!persisted.has(w.id), `served an excluded word: ${w.id}`);
    seen.add(w.id);
  }
  assert.equal(seen.size, words.length - persisted.size); // exhausted everything else
});

test('topic filter serves only that topic; unknown topic exhausts gracefully', () => {
  const w = selectWord({ score: 0, topic: 'Gaming' });
  assert.equal(w?.topic, 'Gaming');
  assert.equal(selectWord({ score: 0, topic: 'No Such Topic' }), null);
});

test('availableBankTopics reflects the bank', () => {
  const topics = availableBankTopics();
  assert.ok(topics.has('Gaming'));
});

test('stockedBankTopics drops a topic once every word is seen (soft wall, T7)', () => {
  const gamingIds = words.filter((w) => w.topic === 'Gaming').map((w) => w.id);
  const stocked = stockedBankTopics(new Set(gamingIds));
  assert.ok(!stocked.has('Gaming')); // exhausted — the wall should not offer it
  assert.ok(stocked.has('Music')); // untouched topics remain on offer
});
