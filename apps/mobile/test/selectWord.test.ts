/**
 * Word selection over the real bank — difficulty follows the SCORE (tier-gated),
 * randomness within the tier, persisted-seen exclusion, session no-repeat, graceful
 * exhaustion, and tier spill when the earned tier is used up.
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { tierForScore } from '@sabd/elo';
// Post-3.0.0 flip: the app serves the UNIFIED bank (four tiers) — selection reads it
// through liveBank, so the tests exercise the same source.
import { unifiedWords as words } from '@sabd/wordbank';
import { selectWord, resetSessionSeen, availableBankTopics, stockedBankTopics } from '../src/round/selectWord.ts';

beforeEach(() => resetSessionSeen());

test('a score-0 player is served veryEasy words (the cold-start fix)', () => {
  for (let i = 0; i < 10; i++) {
    resetSessionSeen();
    const w = selectWord({ score: 0 });
    assert.ok(w);
    assert.equal(w.tier, 'veryEasy', `${w.id} is ${w.tier}, expected veryEasy at score 0`);
  }
});

test('difficulty climbs with score across the four unified tiers', () => {
  assert.equal(tierForScore(0), 'veryEasy');
  assert.equal(selectWord({ score: 0 })?.tier, 'veryEasy');

  resetSessionSeen();
  assert.equal(tierForScore(100), 'easy');
  assert.equal(selectWord({ score: 100 })?.tier, 'easy');

  resetSessionSeen();
  assert.equal(tierForScore(200), 'medium');
  assert.equal(selectWord({ score: 200 })?.tier, 'medium');

  resetSessionSeen();
  assert.equal(tierForScore(500), 'hard');
  assert.equal(selectWord({ score: 500 })?.tier, 'hard');
});

test('randomness: different rng values pick different words in the same tier', () => {
  const low = selectWord({ score: 0, rng: () => 0 });
  resetSessionSeen();
  const high = selectWord({ score: 0, rng: () => 0.999 });
  assert.ok(low && high);
  assert.notEqual(low.id, high.id);
});

test('spills to the nearest tier once the earned tier is exhausted', () => {
  // Exhaust every veryEasy Gaming word, then a score-0 request must spill up.
  const veryEasyGaming = words.filter((w) => w.topic === 'Gaming' && w.tier === 'veryEasy');
  const seen = new Set(veryEasyGaming.map((w) => w.id));
  const w = selectWord({ score: 0, topic: 'Gaming', exclude: seen });
  assert.ok(w, 'should still serve a word by spilling to an adjacent tier');
  assert.notEqual(w.tier, 'veryEasy');
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
