/**
 * T11 DoD — word selection over the real bank: window widening, randomness within
 * the window, persisted-seen exclusion, session no-repeat, graceful exhaustion.
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { words } from '@sabd/wordbank';
import { selectWord, resetSessionSeen, availableBankTopics } from '../src/round/selectWord.ts';

beforeEach(() => resetSessionSeen());

test('picks inside the ±150 window when it has candidates', () => {
  for (let i = 0; i < 10; i++) {
    resetSessionSeen();
    const w = selectWord({ rating: 1200 });
    assert.ok(w);
    assert.ok(Math.abs(w.difficulty - 1200) <= 150, `${w.id} (${w.difficulty}) outside window`);
  }
});

test('randomness: different rng values pick different words in the same window', () => {
  const low = selectWord({ rating: 1200, rng: () => 0 });
  resetSessionSeen();
  const high = selectWord({ rating: 1200, rng: () => 0.999 });
  assert.ok(low && high);
  assert.notEqual(low.id, high.id);
});

test('widens step-by-step when the window is empty (extreme rating), never crashes', () => {
  const rating = 5000;
  const w = selectWord({ rating });
  assert.ok(w);
  // The guarantee: the pick lies inside the FIRST window that has candidates —
  // i.e. the minimal ±150-multiple reaching the bank's hardest words. (Randomness
  // may pick any word in that band, not necessarily the absolute max.)
  const maxDifficulty = Math.max(...words.map((x) => x.difficulty));
  const minimalWindow = Math.ceil((rating - maxDifficulty) / 150) * 150;
  assert.ok(
    Math.abs(w.difficulty - rating) <= minimalWindow,
    `${w.id} (${w.difficulty}) outside the minimal window ${minimalWindow}`,
  );
});

test('never repeats within a session and respects the persisted exclude set', () => {
  const seen = new Set<string>();
  const persisted = new Set<string>([words[0]!.id, words[1]!.id]);
  for (;;) {
    const w = selectWord({ rating: 1200, exclude: persisted });
    if (w === null) break;
    assert.ok(!seen.has(w.id), `repeat: ${w.id}`);
    assert.ok(!persisted.has(w.id), `served an excluded word: ${w.id}`);
    seen.add(w.id);
  }
  assert.equal(seen.size, words.length - persisted.size); // exhausted everything else
});

test('topic filter serves only that topic; unknown topic exhausts gracefully', () => {
  const w = selectWord({ rating: 1200, topic: 'Gaming' });
  assert.equal(w?.topic, 'Gaming');
  assert.equal(selectWord({ rating: 1200, topic: 'No Such Topic' }), null);
});

test('availableBankTopics reflects the bank', () => {
  const topics = availableBankTopics();
  assert.ok(topics.has('Gaming'));
});
