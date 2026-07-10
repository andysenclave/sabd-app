import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  computePerformance,
  countPaidHints,
  defaultConfig,
  type RoundResult,
} from '../src/index.ts';

/** Baseline solved round: even match, settled player, full contract shape. */
function round(overrides: Partial<RoundResult> = {}): RoundResult {
  return {
    solved: true,
    timeLimitSec: 60,
    timeUsedSec: 0,
    hintsUsed: [],
    opponentRating: 1300,
    playerRating: 1300,
    gamesPlayed: 41,
    mode: 'solo',
    challengeMode: false,
    ...overrides,
  };
}

describe('computePerformance — §3.2', () => {
  it('instant no-hint solve scores 1.0 with full breakdown', () => {
    const { s, breakdown } = computePerformance(round());
    assert.equal(s, 1.0);
    assert.deepEqual(breakdown, { solveBase: 0.5, speedBonus: 0.5, hintPenalty: -0 });
  });

  it('timeout scores exactly 0.0 with a zeroed breakdown', () => {
    const { s, breakdown } = computePerformance(
      round({ solved: false, timeUsedSec: 60 }),
    );
    assert.equal(s, 0.0);
    assert.deepEqual(breakdown, { solveBase: 0, speedBonus: 0, hintPenalty: 0 });
  });

  it('half-clock 1-hint solve: 0.5 + 0.25 - 0.20 = 0.55', () => {
    const { s, breakdown } = computePerformance(
      round({ timeUsedSec: 30, hintsUsed: ['position'] }),
    );
    assert.ok(Math.abs(s - 0.55) < 1e-12);
    assert.equal(breakdown.solveBase, 0.5);
    assert.ok(Math.abs(breakdown.speedBonus - 0.25) < 1e-12);
    assert.ok(Math.abs(breakdown.hintPenalty - -0.2) < 1e-12);
  });

  it('hint penalty is monotonic: 0 > 1 > 2 paid hints, -0.20 per hint', () => {
    const s0 = computePerformance(round({ timeUsedSec: 30 })).s;
    const s1 = computePerformance(round({ timeUsedSec: 30, hintsUsed: ['position'] })).s;
    const s2 = computePerformance(
      round({ timeUsedSec: 30, hintsUsed: ['position', 'letters'] }),
    ).s;
    assert.ok(s0 > s1 && s1 > s2);
    assert.ok(Math.abs(s0 - s1 - 0.2) < 1e-12);
    assert.ok(Math.abs(s1 - s2 - 0.2) < 1e-12);
  });

  it('duplicate hints are counted once and capped at 2', () => {
    assert.equal(countPaidHints({ hintsUsed: ['position', 'position'] }), 1);
    assert.equal(
      countPaidHints({ hintsUsed: ['position', 'letters', 'position', 'letters'] }),
      2,
    );
  });

  it('clamps at the ceiling: config pushing s above 1.0 yields exactly 1.0', () => {
    const config = { ...defaultConfig, solveBase: 0.7 }; // instant ⇒ 0.7 + 0.5 = 1.2
    const { s } = computePerformance(round(), config);
    assert.equal(s, 1.0);
  });

  it('clamps at the solve floor: config pushing s below 0.05 yields exactly 0.05', () => {
    const config = { ...defaultConfig, hintPenaltyPerHint: 0.5 }; // 0.5 + 0 - 1.0 = -0.5
    const { s } = computePerformance(
      round({ timeUsedSec: 60, hintsUsed: ['position', 'letters'] }),
      config,
    );
    assert.equal(s, 0.05);
  });

  it('with default weights the slowest 2-hint solve stays above the floor (0.10)', () => {
    const { s } = computePerformance(
      round({ timeUsedSec: 60, hintsUsed: ['position', 'letters'] }),
    );
    assert.ok(Math.abs(s - 0.1) < 1e-12);
    assert.ok(s >= defaultConfig.solvedFloor);
  });

  it('clamps T at 1: overtime timeUsedSec never produces a negative speed bonus', () => {
    const { breakdown } = computePerformance(round({ timeUsedSec: 90 }));
    assert.equal(breakdown.speedBonus, 0);
  });

  it('rejects a non-positive time limit on a solved round', () => {
    assert.throws(() => computePerformance(round({ timeLimitSec: 0 })), RangeError);
  });

  it('is deterministic: identical input yields identical output', () => {
    const input = round({ timeUsedSec: 22.4, hintsUsed: ['position'] });
    assert.deepEqual(computePerformance(input), computePerformance(input));
  });
});
