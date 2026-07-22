/**
 * Profile-hub data derivations (P4-T10/11/12) — pure functions over the event log,
 * so the dashboards show numbers that match a full replay, not a second source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { RoundEvent } from '@sabd/contracts';
import { BANK_TOPICS, ROUND_EVENT_SCHEMA_VERSION } from '@sabd/contracts';
import { ENGINE_CONFIG_VERSION } from '@sabd/elo';
import {
  bestStreak,
  buildProfile,
  climbSeries,
  computeGap,
  daysPlayed,
  recentEarnings,
  streakMilestone,
  STREAK_BADGES,
  type CategoryDatum,
} from '../src/dashboard/data.ts';

const DAY = 86_400_000;
let clock = 1_700_000_000_000;

function ev(topic: string, solved: boolean, difficulty = 100, overrides: Partial<RoundEvent> = {}): RoundEvent {
  clock += 60_000;
  return {
    roundId: `r-${clock}-${Math.round(difficulty)}`,
    schemaVersion: ROUND_EVENT_SCHEMA_VERSION,
    installId: 'i',
    playedAt: overrides.playedAt ?? clock,
    wordId: `W-${clock}`,
    wordRatingAtPlay: difficulty,
    wordBankVersion: '2.1.0',
    topic,
    solved,
    timeLimitSec: 60,
    timeUsedSec: 30,
    hintsUsed: [],
    mode: 'solo',
    playerRatingBefore: 0,
    engineConfigVersion: ENGINE_CONFIG_VERSION,
    syncedAt: null,
    ...overrides,
  };
}

test('climbSeries is monotonic and starts at 0', () => {
  const events = [ev('Gaming', true), ev('Gaming', false), ev('Gaming', true)];
  const s = climbSeries(events);
  assert.equal(s[0], 0);
  assert.equal(s.length, events.length + 1);
  for (let i = 1; i < s.length; i++) assert.ok(s[i]! >= s[i - 1]!, `fell at ${i}`);
});

test('a category climb equals its own replayed score', () => {
  const events = [ev('Music', true, 100), ev('Music', true, 200), ev('Music', false, 100)];
  const s = climbSeries(events);
  // last value = folded score; a miss adds nothing.
  assert.equal(s[s.length - 1], s[s.length - 2]);
});

test('bestStreak finds the longest run, streak the trailing one', () => {
  const events = [ev('Gaming', true), ev('Gaming', true), ev('Gaming', true), ev('Gaming', false), ev('Gaming', true)];
  assert.equal(bestStreak(events), 3);
});

test('daysPlayed counts distinct calendar days', () => {
  const base = 1_700_000_000_000;
  const events = [
    ev('Gaming', true, 100, { playedAt: base }),
    ev('Gaming', true, 100, { playedAt: base + 1000 }), // same day
    ev('Gaming', true, 100, { playedAt: base + 2 * DAY }), // +2 days
  ];
  assert.equal(daysPlayed(events), 2);
});

test('computeGap picks the weakest PLAYED category and the gap to the next up', () => {
  const cats: CategoryDatum[] = [
    { id: 'gaming', name: 'G', bankTopic: BANK_TOPICS.gaming, score: 400, streak: 0, rounds: 10, solved: 9, solvePct: 90, gain7d: 0 },
    { id: 'world', name: 'W', bankTopic: BANK_TOPICS.world, score: 200, streak: 0, rounds: 8, solved: 5, solvePct: 62, gain7d: 0 },
    { id: 'food', name: 'F', bankTopic: BANK_TOPICS.food, score: 130, streak: 0, rounds: 5, solved: 3, solvePct: 60, gain7d: 0 },
    { id: 'music', name: 'M', bankTopic: BANK_TOPICS.music, score: 0, streak: 0, rounds: 0, solved: 0, solvePct: 0, gain7d: 0 },
  ];
  const gap = computeGap(cats);
  assert.ok(gap);
  assert.equal(gap.id, 'food'); // weakest PLAYED (music has 0 rounds → excluded)
  assert.equal(gap.toPass, 70); // 200 − 130
  assert.equal(gap.passName, 'World');
});

test('computeGap returns null with fewer than two played categories', () => {
  const one: CategoryDatum[] = [
    { id: 'gaming', name: 'G', bankTopic: BANK_TOPICS.gaming, score: 100, streak: 0, rounds: 3, solved: 3, solvePct: 100, gain7d: 0 },
  ];
  assert.equal(computeGap(one), null);
});

test('streakMilestone: absolute progress to the next badge, honest copy', () => {
  const m = streakMilestone(7);
  assert.equal(m.next, 10);
  assert.equal(m.pct, 0.7); // 7 / 10 — the mockup's 70%
  assert.match(m.copy, /3 more days/);
  // Past the top badge: everything earned.
  const top = streakMilestone(STREAK_BADGES[STREAK_BADGES.length - 1]! + 5);
  assert.equal(top.next, null);
  assert.equal(top.pct, 1);
});

test('recentEarnings breaks a solve into its real components, newest first', () => {
  const events = [
    ev('Gaming', true, 100, { timeUsedSec: 0 }), // fast → speed bonus
    ev('Gaming', true, 100, { timeUsedSec: 0 }), // streak building
  ];
  const earn = recentEarnings(events, 2);
  assert.equal(earn.length, 2);
  assert.ok(earn[0]!.breakdown.speedBonus > 0);
  assert.equal(earn[0]!.total, earn[0]!.breakdown.tierBase + earn[0]!.breakdown.speedBonus + earn[0]!.breakdown.streakBonus);
  // newest first (the second event has the higher streak bonus).
  assert.ok(earn[0]!.breakdown.streakBonus >= earn[1]!.breakdown.streakBonus);
});

test('buildProfile sorts strong → building and totals from the cache', () => {
  const events = [
    ev('Gaming', true, 100), ev('Gaming', true, 100),
    ev('Music', true, 100),
  ];
  const p = buildProfile(events, { total: 999, streak: 4 }, clock + DAY);
  assert.equal(p.total, 999);
  assert.equal(p.globalStreak, 4);
  assert.equal(p.categories[0]!.id, 'gaming'); // strongest first
  assert.ok(p.categories[0]!.score >= p.categories[1]!.score);
  assert.equal(p.categories.length, 6); // all six always present
});
