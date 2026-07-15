/**
 * T19: the score-breakdown line — every non-zero component, real engine output.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyPoints } from '@sabd/elo';
import { breakdownLine } from '../src/round/breakdown.ts';

test('fast clean solve: base + speed only', () => {
  const u = applyPoints(
    { rating: 0, streak: 0 },
    { solved: true, timeLimitSec: 60, timeUsedSec: 0, hintsUsed: [], wordDifficulty: 1000, mode: 'solo' },
  );
  assert.equal(breakdownLine(u), 'BASE 10 · SPEED +10');
});

test('hinted streaky mid solve: all four components', () => {
  const u = applyPoints(
    { rating: 150, streak: 4 },
    { solved: true, timeLimitSec: 60, timeUsedSec: 30, hintsUsed: ['position'], wordDifficulty: 1400, mode: 'solo' },
  );
  assert.equal(breakdownLine(u), 'BASE 20 · SPEED +5 · HINTS -3 · STREAK +8');
});

test('buzzer-beater with both hints: base only (speed 0, hints shown)', () => {
  const u = applyPoints(
    { rating: 0, streak: 0 },
    { solved: true, timeLimitSec: 60, timeUsedSec: 60, hintsUsed: ['position', 'letters'], wordDifficulty: 1000, mode: 'solo' },
  );
  assert.equal(breakdownLine(u), 'BASE 10 · HINTS -6');
});
