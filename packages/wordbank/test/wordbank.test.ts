import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  words,
  size,
  getWord,
  wordsByTopic,
  topics,
  wordBankVersion,
  validateBank,
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
