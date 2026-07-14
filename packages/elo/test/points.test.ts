/**
 * Scoring engine — monotonic points, streak bonus, tier-gated difficulty.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyPoints,
  countPaidHints,
  defaultConfig,
  tierForDifficulty,
  tierForScore,
  type PlayerState,
  type RoundResult,
} from '../src/index.ts';

const solve = (overrides: Partial<RoundResult> = {}): RoundResult => ({
  solved: true,
  timeLimitSec: 60,
  timeUsedSec: 60, // buzzer-beater by default → no speed bonus
  hintsUsed: [],
  wordDifficulty: 1000, // low tier
  mode: 'solo',
  ...overrides,
});

// ─── tier derivation ─────────────────────────────────────────────────────────

test('tierForDifficulty maps by the content-pipeline bands', () => {
  assert.equal(tierForDifficulty(800), 'low');
  assert.equal(tierForDifficulty(1200), 'low');
  assert.equal(tierForDifficulty(1201), 'mid');
  assert.equal(tierForDifficulty(1600), 'mid');
  assert.equal(tierForDifficulty(1601), 'high');
  assert.equal(tierForDifficulty(2200), 'high');
});

test('tierForScore rises with score and never regresses within the bands', () => {
  assert.equal(tierForScore(0), 'low');
  assert.equal(tierForScore(99), 'low');
  assert.equal(tierForScore(100), 'mid');
  assert.equal(tierForScore(299), 'mid');
  assert.equal(tierForScore(300), 'high');
  assert.equal(tierForScore(99999), 'high');
});

test('countPaidHints dedupes and caps at 2', () => {
  assert.equal(countPaidHints({ hintsUsed: [] }), 0);
  assert.equal(countPaidHints({ hintsUsed: ['position', 'position'] }), 1);
  assert.equal(countPaidHints({ hintsUsed: ['position', 'letters'] }), 2);
});

// ─── points math ─────────────────────────────────────────────────────────────

test('a buzzer-beater low-tier solve (no streak) awards exactly the tier base', () => {
  const u = applyPoints({ rating: 0, streak: 0 }, solve());
  assert.equal(u.breakdown.tierBase, 10);
  assert.equal(u.breakdown.speedBonus, 0);
  assert.equal(u.breakdown.hintPenalty, 0);
  assert.equal(u.breakdown.streakBonus, 0);
  assert.equal(u.delta, 10);
  assert.equal(u.newPlayerRating, 10);
  assert.equal(u.streak, 1);
});

test('instant solve adds the full speed bonus; higher tiers pay more', () => {
  const low = applyPoints({ rating: 0, streak: 0 }, solve({ timeUsedSec: 0, wordDifficulty: 1000 }));
  assert.equal(low.delta, 10 + 10); // tierBase 10 + speedBonusMax 10
  const high = applyPoints({ rating: 0, streak: 0 }, solve({ timeUsedSec: 0, wordDifficulty: 1800 }));
  assert.equal(high.delta, 30 + 10);
});

test('hints subtract, but a solve never drops below minSolvePoints', () => {
  // low tier 10, half clock → speed +5, two hints → -6 ⇒ 9
  const oneHalf = applyPoints({ rating: 0, streak: 0 }, solve({ timeUsedSec: 30, hintsUsed: ['position', 'letters'] }));
  assert.equal(oneHalf.delta, 9);
  // low tier 10, buzzer (speed 0), two hints -6 ⇒ 4, floored to minSolvePoints 5
  const floored = applyPoints({ rating: 0, streak: 0 }, solve({ timeUsedSec: 60, hintsUsed: ['position', 'letters'] }));
  assert.equal(floored.delta, defaultConfig.minSolvePoints);
});

test('streak adds an escalating bonus (+2, +4, +6…) capped at streakBonusMax', () => {
  assert.equal(applyPoints({ rating: 0, streak: 0 }, solve()).breakdown.streakBonus, 0); // 1st solve
  assert.equal(applyPoints({ rating: 0, streak: 1 }, solve()).breakdown.streakBonus, 2); // 2nd
  assert.equal(applyPoints({ rating: 0, streak: 2 }, solve()).breakdown.streakBonus, 4); // 3rd
  // cap: a very long streak stops growing at streakBonusMax
  assert.equal(applyPoints({ rating: 0, streak: 50 }, solve()).breakdown.streakBonus, defaultConfig.streakBonusMax);
});

test('a miss earns nothing, leaves the score untouched, and resets the streak', () => {
  const u = applyPoints({ rating: 137, streak: 5 }, solve({ solved: false }));
  assert.equal(u.delta, 0);
  assert.equal(u.newPlayerRating, 137); // never drops
  assert.equal(u.streak, 0);
  assert.deepEqual(u.breakdown, { tierBase: 0, speedBonus: 0, hintPenalty: 0, streakBonus: 0 });
});

test('the score is monotonic across a mixed session', () => {
  let state: PlayerState = { rating: 0, streak: 0 };
  const outcomes = [true, true, false, true, true, true, false].map((solved, i) => {
    const u = applyPoints(state, solve({ solved, timeUsedSec: 20 + i, wordDifficulty: 1000 + i * 200 }));
    state = { rating: u.newPlayerRating, streak: u.streak };
    return u;
  });
  let prev = 0;
  for (const u of outcomes) {
    assert.ok(u.newPlayerRating >= prev, `score dropped: ${prev} → ${u.newPlayerRating}`);
    assert.ok(u.delta >= 0);
    prev = u.newPlayerRating;
  }
});

test('timeLimitSec must be positive on a solve', () => {
  assert.throws(() => applyPoints({ rating: 0, streak: 0 }, solve({ timeLimitSec: 0 })), /timeLimitSec/);
});
