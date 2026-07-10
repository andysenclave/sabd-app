import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyResult,
  defaultConfig,
  expectedScore,
  kFactor,
  updateWordRating,
  type PlayerState,
  type RoundResult,
} from '../src/index.ts';

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

const settled1300: PlayerState = { rating: 1300, gamesPlayed: 41 };

describe('expectedScore — §3.1', () => {
  it('is 0.5 for an even match', () => {
    assert.equal(expectedScore(1300, 1300), 0.5);
  });

  it('matches the standard Elo formula for a 300-point gap', () => {
    const e = expectedScore(1300, 1600);
    assert.ok(Math.abs(e - 1 / (1 + 10 ** (300 / 400))) < 1e-15);
    assert.ok(e < 0.16 && e > 0.15);
  });

  it('is symmetric: E(a,b) + E(b,a) = 1', () => {
    assert.ok(Math.abs(expectedScore(1300, 1600) + expectedScore(1600, 1300) - 1) < 1e-15);
  });
});

describe('kFactor — §3.3', () => {
  it('provisional K=40 below 30 games, regardless of rating', () => {
    assert.equal(kFactor(1300, 0), 40);
    assert.equal(kFactor(1300, 29), 40);
    assert.equal(kFactor(2400, 29), 40);
  });

  it('settled K=32 under 2000 rating', () => {
    assert.equal(kFactor(1300, 30), 32);
    assert.equal(kFactor(1999, 100), 32);
  });

  it('high-rated K=24 at 2000 and above', () => {
    assert.equal(kFactor(2000, 30), 24);
    assert.equal(kFactor(2400, 500), 24);
  });
});

describe('applyResult — §3.4', () => {
  it('even match, instant no-hint solve ⇒ big gain of K/2 (+16)', () => {
    const u = applyResult(settled1300, round());
    assert.equal(u.performance, 1.0);
    assert.equal(u.expected, 0.5);
    assert.equal(u.kFactor, 32);
    assert.equal(u.delta, 16);
    assert.equal(u.newPlayerRating, 1316);
  });

  it('even match, timeout ⇒ loss of K/2 (-16)', () => {
    const u = applyResult(settled1300, round({ solved: false, timeUsedSec: 60 }));
    assert.equal(u.performance, 0);
    assert.equal(u.delta, -16);
    assert.equal(u.newPlayerRating, 1284);
  });

  it('beating a much-higher word (1600) instantly ⇒ large gain (+27)', () => {
    const u = applyResult(settled1300, round({ opponentRating: 1600 }));
    assert.equal(u.delta, 27);
    assert.equal(u.newPlayerRating, 1327);
    // Larger than the even-match gain.
    assert.ok(u.delta > 16);
  });

  it('losing (timeout) to a much-lower word (1000) ⇒ large drop (-27)', () => {
    const u = applyResult(
      settled1300,
      round({ opponentRating: 1000, solved: false, timeUsedSec: 60 }),
    );
    assert.equal(u.delta, -27);
    assert.equal(u.newPlayerRating, 1273);
    assert.ok(u.delta < -16);
  });

  it('provisional player (K=40) gains more than a settled one for the same round', () => {
    const provisional = applyResult({ rating: 1300, gamesPlayed: 10 }, round());
    const settled = applyResult(settled1300, round());
    assert.equal(provisional.kFactor, 40);
    assert.equal(provisional.delta, 20);
    assert.equal(settled.kFactor, 32);
    assert.equal(settled.delta, 16);
  });

  it('uses the reduced K=24 for high-rated settled players', () => {
    const u = applyResult({ rating: 2100, gamesPlayed: 200 }, round({ opponentRating: 2100 }));
    assert.equal(u.kFactor, 24);
    assert.equal(u.delta, 12);
  });

  it('output carries the performance breakdown from §3.2', () => {
    const u = applyResult(
      settled1300,
      round({ timeUsedSec: 30, hintsUsed: ['position'] }),
    );
    assert.equal(u.breakdown.solveBase, 0.5);
    assert.ok(Math.abs(u.breakdown.speedBonus - 0.25) < 1e-12);
    assert.ok(Math.abs(u.breakdown.hintPenalty - -0.2) < 1e-12);
  });

  it('never drops the rating below the configured floor', () => {
    const u = applyResult(
      { rating: 105, gamesPlayed: 50 },
      round({ opponentRating: 105, solved: false, timeUsedSec: 60 }),
    );
    assert.equal(u.delta, -16);
    assert.equal(u.newPlayerRating, defaultConfig.ratingFloor);
  });
});

describe('challenge modifier — §4 (gains only)', () => {
  it('multiplies a gain by 1.25: +16 becomes +20', () => {
    const u = applyResult(settled1300, round({ challengeMode: true }));
    assert.equal(u.delta, 20);
    assert.equal(u.newPlayerRating, 1320);
  });

  it('does NOT soften a loss: -16 stays -16', () => {
    const u = applyResult(
      settled1300,
      round({ challengeMode: true, solved: false, timeUsedSec: 60 }),
    );
    assert.equal(u.delta, -16);
    assert.equal(u.newPlayerRating, 1284);
  });

  it('leaves a zero delta untouched', () => {
    // s = 0.5 exactly (solve at the buzzer, no hints) vs an even opponent ⇒ delta 0.
    const u = applyResult(settled1300, round({ challengeMode: true, timeUsedSec: 60 }));
    assert.equal(u.delta, 0);
    assert.equal(u.newPlayerRating, 1300);
  });

  it('respects a tuned multiplier from config', () => {
    const config = { ...defaultConfig, challengeMultiplier: 1.5 };
    const u = applyResult(settled1300, round({ challengeMode: true }), config);
    assert.equal(u.delta, 24);
  });
});

describe('updateWordRating — §3.5 (Phase 2, off by default)', () => {
  it('is a no-op with the default config (applied: false, rating unchanged)', () => {
    const u = updateWordRating(1600, 1300, 1.0);
    assert.equal(u.applied, false);
    assert.equal(u.newWordRating, 1600);
    assert.equal(u.delta, 0);
  });

  it('when enabled, a crushed word loses rating (wordResult = 1 - s, K = 16)', () => {
    const config = { ...defaultConfig, wordRatingUpdatesEnabled: true };
    // Word 1600 vs player 1300: E_word ≈ 0.849. Player scored s = 1 ⇒ wordResult = 0.
    const u = updateWordRating(1600, 1300, 1.0, config);
    assert.equal(u.applied, true);
    assert.equal(u.kFactor, 16);
    assert.equal(u.delta, Math.round(16 * (0 - expectedScore(1600, 1300))));
    assert.equal(u.newWordRating, 1600 + u.delta);
    assert.ok(u.delta < 0);
  });

  it('when enabled, a word that stonewalls the player gains rating', () => {
    const config = { ...defaultConfig, wordRatingUpdatesEnabled: true };
    // Word 1000 vs player 1300, player timed out (s = 0) ⇒ wordResult = 1.
    const u = updateWordRating(1000, 1300, 0, config);
    assert.ok(u.delta > 0);
    assert.equal(u.delta, Math.round(16 * (1 - expectedScore(1000, 1300))));
  });
});
