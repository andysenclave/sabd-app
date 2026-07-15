/**
 * T11–T13: idempotent ingestion (duplicate/partial/out-of-order batches), server
 * replay as the rating truth (identical to the client fold from identical events —
 * the anti-cheat foundation), epoch filtering, and the reinstall-restore sync-down.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import type { RoundEvent } from '@sabd/contracts';
import { ROUND_EVENT_SCHEMA_VERSION, SEED_RATING, validatePlayerSnapshot } from '@sabd/contracts';
import { ENGINE_CONFIG_VERSION } from '@sabd/elo';
import { replayEvents } from '@sabd/storage';
import { computeSnapshot, handleGetMe, handleUploadRounds, MemoryEventStore } from '../src/index.ts';

const INSTALL = 'install-a';
const NOW = 1_800_000_000_000;

let clock = 1_752_000_000_000;
function event(overrides: Partial<RoundEvent> = {}): RoundEvent {
  clock += 60_000;
  return {
    roundId: randomUUID(),
    schemaVersion: ROUND_EVENT_SCHEMA_VERSION,
    installId: INSTALL,
    playedAt: clock,
    wordId: `GAM-${String(clock % 10_000).padStart(4, '0')}`,
    wordRatingAtPlay: 900,
    wordBankVersion: '1.0.0',
    topic: 'Gaming',
    solved: true,
    timeLimitSec: 60,
    timeUsedSec: 20,
    hintsUsed: [],
    mode: 'solo',
    playerRatingBefore: 0,
    engineConfigVersion: ENGINE_CONFIG_VERSION,
    syncedAt: null,
    ...overrides,
  };
}

function upload(store: MemoryEventStore, events: RoundEvent[]) {
  return handleUploadRounds(
    store,
    { installId: INSTALL, schemaVersion: ROUND_EVENT_SCHEMA_VERSION, events },
    NOW,
  );
}

test('upload → accepted; re-upload of the same batch → all duplicates, same snapshot', async () => {
  const store = new MemoryEventStore();
  const events = [event(), event({ solved: false }), event({ topic: 'Music' })];

  const first = await upload(store, events);
  assert.ok(first.ok);
  assert.equal(first.body.acceptedRoundIds.length, 3);
  assert.equal(first.body.duplicateRoundIds.length, 0);
  assert.equal(validatePlayerSnapshot(first.body.snapshot).ok, true);

  const second = await upload(store, events);
  assert.ok(second.ok);
  assert.equal(second.body.acceptedRoundIds.length, 0);
  assert.equal(second.body.duplicateRoundIds.length, 3);
  assert.deepEqual(second.body.snapshot.global, first.body.snapshot.global);
  assert.deepEqual(second.body.snapshot.categories, first.body.snapshot.categories);
});

test('partial + out-of-order batches converge to the same snapshot as one upload', async () => {
  const events = [event(), event(), event({ solved: false }), event(), event({ topic: 'Music' })];

  const oneShot = new MemoryEventStore();
  const whole = await upload(oneShot, events);
  assert.ok(whole.ok);

  // Network dropped mid-batch, retried with overlap, later batch arrived first.
  const choppy = new MemoryEventStore();
  const r1 = await upload(choppy, [events[3]!, events[4]!]); // later rounds first
  const r2 = await upload(choppy, [events[0]!, events[1]!]);
  const r3 = await upload(choppy, [events[1]!, events[2]!, events[3]!]); // overlap
  assert.ok(r1.ok && r2.ok && r3.ok);
  assert.equal(r3.body.duplicateRoundIds.length, 2);

  assert.deepEqual(r3.body.snapshot.global, whole.body.snapshot.global);
  assert.deepEqual(r3.body.snapshot.categories, whole.body.snapshot.categories);
});

test('T12 DoD: server replay equals the CLIENT fold from identical events', async () => {
  const events = [
    event(),
    event({ solved: false }),
    event({ wordRatingAtPlay: 1400 }),
    event({ wordRatingAtPlay: 1800, hintsUsed: ['position'] }),
    event({ timeUsedSec: 55 }),
  ];
  const snapshot = computeSnapshot(INSTALL, events, NOW);

  // The client fold: @sabd/storage replayEvents over the same list, seed 0.
  const client = replayEvents(events, { rating: SEED_RATING, streak: 0, gamesPlayed: 0 }, undefined, () => {});
  assert.equal(snapshot.global.score, client.rating);
  assert.equal(snapshot.global.streak, client.streak);
  assert.equal(snapshot.global.gamesPlayed, client.gamesPlayed);

  // Per-category too — Gaming only (all fixture events are Gaming here).
  const gaming = snapshot.categories.find((c) => c.topic === 'Gaming')!;
  assert.equal(gaming.score, client.rating);
});

test('anti-cheat: a tampered client rating is simply ignored — replay wins', async () => {
  const store = new MemoryEventStore();
  // Client claims a monster playerRatingBefore; the field is stored (drift
  // diagnostics) but the snapshot comes from replaying outcomes only.
  const r = await upload(store, [event({ playerRatingBefore: 99_999 })]);
  assert.ok(r.ok);
  const honest = computeSnapshot(INSTALL, [event({ playedAt: clock })], NOW).global.score;
  assert.equal(r.body.snapshot.global.score, honest);
  assert.ok(r.body.snapshot.global.score < 100);
});

test('epoch: Elo-era events (engineConfigVersion 1.x) are stored but never scored', async () => {
  const store = new MemoryEventStore();
  const eloEra = [event({ engineConfigVersion: '1.0.0' }), event({ engineConfigVersion: '1.2.0' })];
  const pointsEra = [event(), event()];
  const r = await upload(store, [...eloEra, ...pointsEra]);
  assert.ok(r.ok);

  assert.equal(r.body.snapshot.totalRounds, 4); // all stored (calibration data)
  assert.equal(r.body.snapshot.global.gamesPlayed, 2); // only points-era scored
  const expected = computeSnapshot(INSTALL, pointsEra, NOW).global.score;
  assert.equal(r.body.snapshot.global.score, expected);
});

test('a bad event is rejected by roundId; the rest of the batch lands', async () => {
  const store = new MemoryEventStore();
  const good = event();
  const foreign = event({ installId: 'someone-else' });
  const malformed = { ...event(), solved: 'yes' } as unknown as RoundEvent;

  const r = await upload(store, [good, foreign, malformed]);
  assert.ok(r.ok);
  assert.deepEqual(r.body.acceptedRoundIds, [good.roundId]);
  assert.equal(r.body.rejectedRoundIds.length, 2);
  assert.ok(r.body.rejectedRoundIds.includes(foreign.roundId));
});

test('a bad envelope rejects the whole request with 400', async () => {
  const store = new MemoryEventStore();
  const r = await handleUploadRounds(store, { events: [event()] }, NOW); // no installId
  assert.ok(!r.ok);
  assert.equal(r.error.status, 400);
});

test('GET /me: unknown install is a valid empty account, not a 404', async () => {
  const r = await handleGetMe(new MemoryEventStore(), 'fresh-install', false, NOW);
  assert.ok(r.ok);
  assert.equal(r.body.snapshot.global.score, 0);
  assert.equal(r.body.snapshot.totalRounds, 0);
  assert.equal(r.body.events, undefined);
});

test('T13 reinstall restore: includeEvents returns the full log, replayable locally', async () => {
  const store = new MemoryEventStore();
  const events = [event(), event({ solved: false }), event()];
  await upload(store, events);

  const r = await handleGetMe(store, INSTALL, true, NOW);
  assert.ok(r.ok);
  assert.equal(r.body.events?.length, 3);

  // The restored log replays (client-side) to exactly the server's snapshot.
  const client = replayEvents(r.body.events!, { rating: SEED_RATING, streak: 0, gamesPlayed: 0 }, undefined, () => {});
  assert.equal(client.rating, r.body.snapshot.global.score);
  assert.equal(client.streak, r.body.snapshot.global.streak);
});

test('per-category streaks are independent in the server snapshot too', async () => {
  const store = new MemoryEventStore();
  const r = await upload(store, [
    event({ topic: 'Gaming' }),
    event({ topic: 'Music', solved: false }), // breaks global + Music, not Gaming
    event({ topic: 'Gaming' }),
  ]);
  assert.ok(r.ok);
  const gaming = r.body.snapshot.categories.find((c) => c.topic === 'Gaming')!;
  const music = r.body.snapshot.categories.find((c) => c.topic === 'Music')!;
  assert.equal(gaming.streak, 2);
  assert.equal(music.streak, 0);
  assert.equal(r.body.snapshot.global.streak, 1);
  // Global ≠ sum of categories (locked owner decision).
  assert.notEqual(r.body.snapshot.global.score, gaming.score + music.score);
});
