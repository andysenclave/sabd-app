/**
 * Phase 4, PART A §1 — config-versioned replay & the historical-total invariant.
 *
 * The load-bearing rule: a shipped config is immutable; replay scores each round
 * under the config that was live when it was played (its `engineConfigVersion`).
 * Re-banding tiers = publishing a NEW version, which leaves every past round's
 * total byte-identical. These tests pin that, plus the F1 quarantine behaviour.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyPoints,
  bandForDifficulty,
  bandForScore,
  CONFIGS,
  CONFIG_2_0_0,
  CONFIG_3_0_0,
  configForVersion,
  requireConfig,
  tierForScore,
  UnknownConfigVersionError,
  type PlayerState,
  type RoundResult,
} from '../src/index.ts';

// A minimal solve result on a given scale's rating.
const solve = (wordDifficulty: number, over: Partial<RoundResult> = {}): RoundResult => ({
  solved: true,
  timeLimitSec: 60,
  timeUsedSec: 60, // buzzer-beater → no speed bonus, so `delta` is purely tier + streak
  hintsUsed: [],
  wordDifficulty,
  mode: 'solo',
  ...over,
});

// A tiny event stand-in: just the fields a fold reads. Interleaves both eras.
interface MiniEvent {
  engineConfigVersion: string;
  wordRatingAtPlay: number;
  solved: boolean;
}

/** Fold a mixed-era log EXACTLY as replay does: each round under its own config. */
function foldUnderOwnConfig(events: readonly MiniEvent[]): PlayerState {
  let state: PlayerState = { rating: 0, streak: 0 };
  for (const e of events) {
    const cfg = requireConfig(e.engineConfigVersion);
    const u = applyPoints(state, solve(e.wordRatingAtPlay, { solved: e.solved }), cfg);
    state = { rating: u.newPlayerRating, streak: u.streak };
  }
  return state;
}

// ─── registry immutability (re-tiering can NEVER mutate a shipped config) ─────

test('CONFIGS and every shipped config (and its bands) are deeply frozen', () => {
  assert.ok(Object.isFrozen(CONFIGS));
  assert.ok(Object.isFrozen(CONFIG_2_0_0));
  assert.ok(Object.isFrozen(CONFIG_2_0_0.bands));
  assert.ok(Object.isFrozen(CONFIG_2_0_0.bands[0]));
  assert.ok(Object.isFrozen(CONFIG_3_0_0));
  assert.ok(Object.isFrozen(CONFIG_3_0_0.bands));
});

test('mutating a shipped config throws (strict mode) — you publish, never edit', () => {
  // @ts-expect-error — the whole point: the type is readonly and the object frozen.
  assert.throws(() => (CONFIG_2_0_0.bands[0].base = 999));
  // @ts-expect-error
  assert.throws(() => (CONFIGS['2.0.0'] = CONFIG_3_0_0));
});

// ─── config resolution & the F1 quarantine ───────────────────────────────────

test('configForVersion resolves registered versions and reports unknowns', () => {
  assert.equal(configForVersion('2.0.0'), CONFIG_2_0_0);
  assert.equal(configForVersion('3.0.0'), CONFIG_3_0_0);
  assert.equal(configForVersion('4.0.0'), undefined);
  assert.equal(configForVersion('1.0.0'), undefined); // Elo-era has no scoring config
});

test('F1 — requireConfig throws UnknownConfigVersionError, carrying the version', () => {
  assert.throws(
    () => requireConfig('9.9.9'),
    (err: unknown) => {
      assert.ok(err instanceof UnknownConfigVersionError);
      assert.equal(err.version, '9.9.9');
      return true;
    },
  );
});

// ─── each era bands under ITS OWN scale (the corruption the freeze prevents) ──

test('3.0.0 is the unified scale — serveBelow equals maxRating for every band', () => {
  for (const b of CONFIG_3_0_0.bands) {
    assert.equal(b.serveBelow, b.maxRating, `band ${b.tier}: difficulty should speak the score's language`);
  }
});

test('a score-0 player is served veryEasy under 3.0.0 (the cold-start fix)', () => {
  assert.equal(tierForScore(0, CONFIG_3_0_0), 'veryEasy');
  assert.equal(tierForScore(49, CONFIG_3_0_0), 'veryEasy');
  assert.equal(tierForScore(50, CONFIG_3_0_0), 'easy');
  // Contrast: on the legacy config score 0 lands in 'low', the easiest THIRD of an
  // Elo-era bank — still too hard for a stranger's first word.
  assert.equal(tierForScore(0, CONFIG_2_0_0), 'low');
});

test('the SAME numeric rating bands differently per era — scale is load-bearing', () => {
  // Rating 400: under 2.0.0 (fossil scale) it is trivially 'low'; under 3.0.0
  // (unified) it is the top 'hard' tier. Banding one under the other corrupts pay.
  assert.equal(bandForDifficulty(400, CONFIG_2_0_0).tier, 'low'); // base 10
  assert.equal(bandForDifficulty(400, CONFIG_3_0_0).tier, 'hard'); // base 30
  assert.equal(bandForScore(400, CONFIG_2_0_0).tier, 'high');
  assert.equal(bandForScore(400, CONFIG_3_0_0).tier, 'hard');
});

// ─── DoD: MIXED-fixture replay is invariant under re-tiering (byte-identical) ──

test('DoD — a mixed 2.0.0/3.0.0 log scores each round under its own era', () => {
  // Interleaved as a mixed fleet would write (F3): some devices on 2.0.0, some 3.0.0.
  const log: MiniEvent[] = [
    { engineConfigVersion: '2.0.0', wordRatingAtPlay: 1000, solved: true }, //  low  → base 10
    { engineConfigVersion: '3.0.0', wordRatingAtPlay: 400, solved: true }, //  hard → base 30
    { engineConfigVersion: '2.0.0', wordRatingAtPlay: 1700, solved: true }, //  high → base 30
    { engineConfigVersion: '3.0.0', wordRatingAtPlay: 30, solved: true }, //  veryEasy → base 5
  ];

  const result = foldUnderOwnConfig(log);

  // Hand-computed, each under its OWN config, with the streak bonus (+0,+2,+4,+6):
  //   10+0  =10   → 10
  //   30+2  =32   → 42
  //   30+4  =34   → 76
  //    5+6  =11   → 87
  assert.equal(result.rating, 87);
  assert.equal(result.streak, 4);
});

test('DoD — replaying the SAME log twice is byte-identical (deterministic)', () => {
  const log: MiniEvent[] = [
    { engineConfigVersion: '3.0.0', wordRatingAtPlay: 220, solved: true },
    { engineConfigVersion: '2.0.0', wordRatingAtPlay: 1500, solved: false },
    { engineConfigVersion: '3.0.0', wordRatingAtPlay: 90, solved: true },
    { engineConfigVersion: '2.0.0', wordRatingAtPlay: 800, solved: true },
  ];
  assert.deepEqual(foldUnderOwnConfig(log), foldUnderOwnConfig(log));
});

test('DoD — re-tiering (mis-banding all rounds under one config) WOULD change the total', () => {
  // The negative control: prove per-event resolution matters. If replay had scored
  // every round under the active 2.0.0 config (the pre-Phase-4 behaviour), the 3.0.0
  // rounds (small ratings) would mis-band as 'low' and pay less — a different total.
  const log: MiniEvent[] = [
    { engineConfigVersion: '3.0.0', wordRatingAtPlay: 400, solved: true }, // hard(30) vs low(10)
    { engineConfigVersion: '3.0.0', wordRatingAtPlay: 300, solved: true }, // medium(20) vs low(10)
  ];
  const correct = foldUnderOwnConfig(log);

  let wrong: PlayerState = { rating: 0, streak: 0 };
  for (const e of log) {
    const u = applyPoints(wrong, solve(e.wordRatingAtPlay, { solved: e.solved }), CONFIG_2_0_0);
    wrong = { rating: u.newPlayerRating, streak: u.streak };
  }
  assert.notEqual(correct.rating, wrong.rating);
  assert.equal(correct.rating, 30 + (20 + 2)); // 52 under own eras
  assert.equal(wrong.rating, 10 + (10 + 2)); // 22 if mis-banded under 2.0.0
});
