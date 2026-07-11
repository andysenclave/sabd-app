import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatRate, formatStat, median, percentile } from '../src/format.ts';

test('formatRate suppresses below n=5 — it must be impossible to print a bare percentage on n=2', () => {
  assert.equal(formatRate(1, 2), 'insufficient data (n=2)');
  assert.equal(formatRate(0, 4), 'insufficient data (n=4)');
});

test('formatRate prints a percentage with n at n>=5', () => {
  assert.equal(formatRate(3, 6), '50% (n=6)');
  assert.equal(formatRate(13, 21), `${Math.round((13 / 21) * 1000) / 10}% (n=21)`);
});

test('formatStat suppresses below n=5 regardless of value', () => {
  assert.equal(formatStat(42, 3), 'insufficient data (n=3)');
  assert.equal(formatStat(null, 10), 'insufficient data (n=10)');
});

test('formatStat prints the value with n at n>=5', () => {
  assert.equal(formatStat(12.345, 5, 1), '12.3 (n=5)');
});

test('median and percentile are correct on known distributions', () => {
  assert.equal(median([1, 2, 3, 4, 5]), 3);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90), 9);
  assert.equal(percentile([], 50), null);
});
