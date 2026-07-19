/**
 * P4-T7/T8: confidence-weighted calibration (from 5 players), the F8/F9/F10/F11
 * guards, and the CRITICAL tier-at-play freeze: re-rating a word must not move any
 * historical score. Unified scale (post-3.0.0 flip): veryEasy 0–50, easy 51–150,
 * medium 151–350, hard 351+.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import type { RoundEvent, WordEntry } from '@sabd/contracts';
import { ROUND_EVENT_SCHEMA_VERSION, SEED_RATING } from '@sabd/contracts';
import { ENGINE_CONFIG_VERSION } from '@sabd/elo';
import { replayEvents } from '@sabd/storage';
import {
  aggregateWords,
  applyCorrections,
  calibrationEvents,
  confidenceWeight,
  defaultCalibration,
  proposeCorrections,
} from '../src/index.ts';

let clock = 1_752_000_000_000;
function event(
  wordId: string,
  difficulty: number,
  solved: boolean,
  overrides: Partial<RoundEvent> = {},
): RoundEvent {
  clock += 60_000;
  return {
    roundId: randomUUID(),
    schemaVersion: ROUND_EVENT_SCHEMA_VERSION,
    installId: overrides.installId ?? randomUUID(), // distinct player by default (F8)
    playedAt: clock,
    wordId,
    wordRatingAtPlay: difficulty,
    wordBankVersion: '2.1.0',
    topic: 'Gaming',
    solved,
    timeLimitSec: 60,
    timeUsedSec: 30,
    hintsUsed: [],
    mode: 'solo',
    playerRatingBefore: overrides.playerRatingBefore ?? 200,
    engineConfigVersion: ENGINE_CONFIG_VERSION,
    syncedAt: null,
    ...overrides,
  };
}

function word(id: string, difficulty: number): WordEntry {
  return {
    id,
    word: 'PIXEL',
    topic: 'Gaming',
    length: 5,
    difficulty,
    tier: difficulty <= 50 ? 'veryEasy' : difficulty <= 150 ? 'easy' : difficulty <= 350 ? 'medium' : 'hard',
    description: 'Test',
    hints: { position: { index: 0, letter: 'P' }, letters: { correct: 'L', decoy: 'T' } },
  };
}

/** n distinct players, each attempting `wordId` once, with `solves` of them solving.
 *  Player scores spread across `spread` so the confounding guard is satisfied. */
function players(wordId: string, difficulty: number, solves: number, total: number, spread = 200): RoundEvent[] {
  return Array.from({ length: total }, (_, i) =>
    event(wordId, difficulty, i < solves, {
      installId: `p-${i}`,
      playerRatingBefore: Math.round((i / Math.max(1, total - 1)) * spread),
    }),
  );
}

// ─── aggregation (F8 unique players, F9 first attempts, F11 scale filter) ─────

test('aggregateWords counts unique players and first-attempt solve rate', () => {
  // One player attempts GAM-1 three times: fail, fail, solve. Raw solveRate 1/3,
  // but the FIRST-attempt signal is a fail → 0/1.
  const p = 'grinder';
  const evts = [
    event('GAM-1', 40, false, { installId: p }),
    event('GAM-1', 40, false, { installId: p }),
    event('GAM-1', 40, true, { installId: p }),
  ];
  const s = aggregateWords(evts)[0]!;
  assert.equal(s.attempts, 3);
  assert.equal(s.uniquePlayers, 1); // F8 — one human, not three
  assert.equal(Number(s.solveRate.toFixed(2)), 0.33);
  assert.equal(s.firstAttemptSolveRate, 0); // F9 — the clean signal is the first try
});

test('F11 — calibrationEvents drops pre-3.0.0 (non-unified) evidence', () => {
  const kept = event('GAM-1', 40, true);
  const dropped2 = event('GAM-1', 40, true, { engineConfigVersion: '2.0.0' });
  const dropped1 = event('GAM-1', 40, true, { engineConfigVersion: '1.0.0' });
  const out = calibrationEvents([kept, dropped2, dropped1]);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.roundId, kept.roundId);
});

// ─── confidence weighting (the P4-T7 core) ───────────────────────────────────

test('F8 — a lone grinder cannot move a word (below the 5-player floor)', () => {
  const evts = Array.from({ length: 40 }, () => event('GAM-1', 40, false, { installId: 'solo' }));
  const proposal = proposeCorrections(aggregateWords(evts), [word('GAM-1', 40)]);
  assert.equal(proposal.autoNudges.length + proposal.flagged.length, 0);
  assert.equal(proposal.belowFloor, 1); // 40 attempts but 1 player → no signal
});

test('correction magnitude scales with sample size: tiny at 5, decisive at 200', () => {
  const w = word('GAM-1', 250); // medium, target 55%
  // Badly under-solved (10%) at two sample sizes.
  const small = proposeCorrections(aggregateWords(players('GAM-1', 250, 1, 5)), [w]);
  const large = proposeCorrections(aggregateWords(players('GAM-1', 250, 20, 200)), [w]);
  const s = [...small.autoNudges, ...small.flagged][0]!;
  const l = [...large.autoNudges, ...large.flagged][0]!;
  const smallMove = s.newDifficulty - 250;
  const largeMove = l.newDifficulty - 250;
  assert.ok(smallMove >= 1 && smallMove <= 3, `5 players should move ~1–2, got ${smallMove}`);
  assert.ok(largeMove >= 15, `200 players should move decisively, got ${largeMove}`);
  assert.ok(largeMove > smallMove);
});

test('never overshoots: |nudge| never exceeds the full-confidence signal or maxNudge', () => {
  const w = word('GAM-1', 250);
  const proposal = proposeCorrections(aggregateWords(players('GAM-1', 250, 0, 200)), [w]); // 0% solve
  const n = [...proposal.autoNudges, ...proposal.flagged][0]!;
  const move = n.newDifficulty - 250;
  const fullSignal = defaultCalibration.gain * (0.55 - 0); // gain × error at weight 1
  assert.ok(move <= fullSignal, `${move} must not exceed full signal ${fullSignal}`);
  assert.ok(move <= defaultCalibration.maxNudge, `${move} must be clamped to maxNudge`);
});

test('confidenceWeight rises with players and with score spread', () => {
  const stats = (uniquePlayers: number, playerScoreSpread: number) => ({
    wordId: 'x', topic: 'Gaming', attempts: uniquePlayers, uniquePlayers,
    solveRate: 0.5, firstAttemptSolveRate: 0.5, avgClockUsed: 0.5, avgHints: 0,
    avgPlayerRating: 100, playerScoreSpread, lastRatingAtPlay: 100,
  });
  assert.ok(confidenceWeight(stats(5, 200), defaultCalibration) < confidenceWeight(stats(200, 200), defaultCalibration));
  // Narrow score spread is discounted (confounding guard) but never below the floor.
  assert.ok(confidenceWeight(stats(200, 5), defaultCalibration) < confidenceWeight(stats(200, 200), defaultCalibration));
  assert.ok(confidenceWeight(stats(200, 0), defaultCalibration) >= defaultCalibration.spreadFloor * (200 / defaultCalibration.saturation) - 1e-9);
});

test('over-solved word drifts DOWN, under-solved drifts UP, both clamped to maxNudge', () => {
  const easy = word('GAM-EASY', 250);
  const hard = word('GAM-HARD', 250);
  const proposal = proposeCorrections(
    aggregateWords([
      ...players('GAM-EASY', 250, 200, 200), // 100% solve — much easier than rated
      ...players('GAM-HARD', 250, 0, 200), // 0% solve — much harder than rated
    ]),
    [easy, hard],
  );
  const byId = new Map([...proposal.autoNudges, ...proposal.flagged].map((n) => [n.wordId, n]));
  assert.equal(byId.get('GAM-EASY')!.newDifficulty, 250 - defaultCalibration.maxNudge);
  assert.equal(byId.get('GAM-HARD')!.newDifficulty, 250 + defaultCalibration.maxNudge);
  assert.equal(proposal.flagged.length, 0); // both stay medium → auto
});

// ─── tier-crossing safety (F10) ──────────────────────────────────────────────

test('a nudge that crosses a tier boundary is FLAGGED, never auto-applied', () => {
  const border = word('GAM-B', 145); // easy, 5 under the 150 boundary
  const proposal = proposeCorrections(
    aggregateWords(players('GAM-B', 145, 0, 200)), // 0% solve → +25 → 170 = medium
    [border],
  );
  assert.equal(proposal.autoNudges.length, 0);
  assert.equal(proposal.flagged.length, 1);
  assert.equal(proposal.flagged[0]!.oldTier, 'easy');
  assert.equal(proposal.flagged[0]!.newTier, 'medium');
});

test('applyCorrections re-derives tier so the bank stays consistent', () => {
  const border = word('GAM-B', 145);
  const proposal = proposeCorrections(aggregateWords(players('GAM-B', 145, 0, 200)), [border]);
  const corrected = applyCorrections([border], proposal.flagged); // human approved it
  assert.equal(corrected[0]!.difficulty, 170);
  assert.equal(corrected[0]!.tier, 'medium');
});

// ─── P4-T8 — tier-at-play freeze ─────────────────────────────────────────────

test('T8 — re-rating a word changes NO historical score (tier-at-play freeze)', () => {
  // A player's history, played when GAM-1 was rated 40 (veryEasy tier).
  const history = [
    event('GAM-1', 40, true),
    event('GAM-1', 40, true),
    event('GAM-2', 200, false),
    event('GAM-1', 40, true),
  ];
  const before = replayEvents(history, { rating: SEED_RATING, streak: 0, gamesPlayed: 0 });

  // The weekly cron re-rates GAM-1 up into medium (200). The EVENTS are untouched —
  // wordRatingAtPlay stays 40 — so the replay is byte-identical.
  const after = replayEvents(history, { rating: SEED_RATING, streak: 0, gamesPlayed: 0 });
  assert.deepEqual(after, before);

  // Prove the pay WOULD differ if (incorrectly) scored at the new rating — the freeze
  // is load-bearing: veryEasy (base 5) vs medium (base 20).
  const rescored = replayEvents(
    history.map((e) => (e.wordId === 'GAM-1' ? { ...e, wordRatingAtPlay: 200 } : e)),
    { rating: SEED_RATING, streak: 0, gamesPlayed: 0 },
  );
  assert.notEqual(rescored.rating, before.rating);
});
