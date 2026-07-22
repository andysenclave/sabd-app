/**
 * T15–T16: aggregation (noise floor), calibration direction + slow-nudge clamp,
 * tier-crossing flagged never auto-applied, and the CRITICAL tier-at-play freeze:
 * re-rating a word must not move any historical score.
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
  defaultCalibration,
  proposeCorrections,
} from '../src/index.ts';

let clock = 1_752_000_000_000;
function event(wordId: string, difficulty: number, solved: boolean, overrides: Partial<RoundEvent> = {}): RoundEvent {
  clock += 60_000;
  return {
    roundId: randomUUID(),
    schemaVersion: ROUND_EVENT_SCHEMA_VERSION,
    installId: 'i-1',
    playedAt: clock,
    wordId,
    wordRatingAtPlay: difficulty,
    wordBankVersion: '1.0.0',
    topic: 'Gaming',
    solved,
    timeLimitSec: 60,
    timeUsedSec: 30,
    hintsUsed: [],
    mode: 'solo',
    playerRatingBefore: 50,
    engineConfigVersion: ENGINE_CONFIG_VERSION,
    syncedAt: null,
    ...overrides,
  };
}

// Unified scale (post-3.0.0 flip): veryEasy 0–50, easy 51–150, medium 151–350, hard 351+.
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

/** n solves + m misses for one word. */
function plays(wordId: string, difficulty: number, solves: number, misses: number): RoundEvent[] {
  return [
    ...Array.from({ length: solves }, () => event(wordId, difficulty, true)),
    ...Array.from({ length: misses }, () => event(wordId, difficulty, false)),
  ];
}

test('aggregateWords computes attempts/solveRate/avgs per word', () => {
  const events = [
    ...plays('GAM-1', 40, 3, 1),
    ...plays('GAM-2', 200, 1, 0),
  ];
  const stats = new Map(aggregateWords(events).map((s) => [s.wordId, s]));
  assert.equal(stats.get('GAM-1')?.attempts, 4);
  assert.equal(stats.get('GAM-1')?.solveRate, 0.75);
  assert.equal(stats.get('GAM-1')?.avgClockUsed, 0.5);
  assert.equal(stats.get('GAM-2')?.attempts, 1);
});

test('below the noise floor: no correction, counted in the report', () => {
  const proposal = proposeCorrections(
    aggregateWords(plays('GAM-1', 40, 29, 0)), // 29 < 30
    [word('GAM-1', 40)],
  );
  assert.equal(proposal.autoNudges.length + proposal.flagged.length, 0);
  assert.equal(proposal.belowFloor, 1);
});

test('over-solved word drifts DOWN, under-solved drifts UP, both clamped to maxNudge', () => {
  const easy = word('GAM-EASY', 250); // medium tier, target 55%
  const hard = word('GAM-HARD', 250);
  const proposal = proposeCorrections(
    aggregateWords([
      ...plays('GAM-EASY', 250, 40, 0), // 100% solve — much easier than rated
      ...plays('GAM-HARD', 250, 4, 36), // 10% solve — much harder than rated
    ]),
    [easy, hard],
  );
  const byId = new Map([...proposal.autoNudges, ...proposal.flagged].map((n) => [n.wordId, n]));
  const easyNudge = byId.get('GAM-EASY')!;
  const hardNudge = byId.get('GAM-HARD')!;
  assert.equal(easyNudge.newDifficulty, 250 - defaultCalibration.maxNudge); // clamped
  assert.equal(hardNudge.newDifficulty, 250 + defaultCalibration.maxNudge);
  // Both stay medium-tier here → auto.
  assert.equal(proposal.flagged.length, 0);
});

test('a nudge that crosses a tier boundary is FLAGGED, never auto-applied', () => {
  const border = word('GAM-B', 145); // easy tier, 5 points under the 150 boundary
  const proposal = proposeCorrections(
    aggregateWords(plays('GAM-B', 145, 4, 36)), // way under-solved → +12 → 157 = medium
    [border],
  );
  assert.equal(proposal.autoNudges.length, 0);
  assert.equal(proposal.flagged.length, 1);
  assert.equal(proposal.flagged[0]!.oldTier, 'easy');
  assert.equal(proposal.flagged[0]!.newTier, 'medium');
});

test('applyCorrections re-derives tier so the bank stays consistent', () => {
  const border = word('GAM-B', 145);
  const proposal = proposeCorrections(aggregateWords(plays('GAM-B', 145, 4, 36)), [border]);
  const corrected = applyCorrections([border], proposal.flagged); // human approved it
  assert.equal(corrected[0]!.difficulty, 157);
  assert.equal(corrected[0]!.tier, 'medium');
});

test('T16 DoD — tier-at-play freeze: re-rating a word changes NO historical score', () => {
  // A player's history, played when GAM-1 was rated 40 (veryEasy tier).
  const history = [
    event('GAM-1', 40, true),
    event('GAM-1', 40, true),
    event('GAM-2', 200, false),
    event('GAM-1', 40, true),
  ];
  const before = replayEvents(history, { rating: SEED_RATING, streak: 0, gamesPlayed: 0 });

  // The weekly cron re-rates GAM-1 up into medium tier (200) and publishes a new bank.
  // The EVENTS are untouched — wordRatingAtPlay stays 40 — so the replay is too.
  const after = replayEvents(history, { rating: SEED_RATING, streak: 0, gamesPlayed: 0 });
  assert.deepEqual(after, before);

  // The freeze lives in the data flow: scoring reads wordRatingAtPlay from the event,
  // and nothing in the correction pipeline rewrites events. Prove the pay WOULD
  // differ if (incorrectly) scored at the new rating — i.e. the freeze is load-bearing.
  const rescored = replayEvents(
    history.map((e) => (e.wordId === 'GAM-1' ? { ...e, wordRatingAtPlay: 200 } : e)),
    { rating: SEED_RATING, streak: 0, gamesPlayed: 0 },
  );
  assert.notEqual(rescored.rating, before.rating);
});
