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
import {
  CLAIM_CODE_TTL_MS,
  computeSnapshot,
  handleClaim,
  handleCreateCode,
  handleDeleteAccount,
  handleGetMe,
  handleUploadRounds,
  MemoryEventStore,
} from '../src/index.ts';

const INSTALL = 'install-a';
const NOW = 1_800_000_000_000;

// Deterministic id/code minters for the account tests.
let idSeq = 0;
const mkAccountId = () => `acct-${++idSeq}`;
let codeSeq = 0;
const mkCode = () => `CODE-${++codeSeq}`;

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
  const client = replayEvents(events, { rating: SEED_RATING, streak: 0, gamesPlayed: 0 });
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

test('F1: a points-era event with an UNKNOWN config is quarantined (rejected, not stored)', async () => {
  const store = new MemoryEventStore();
  const good = event(); // active config, accepted
  // A device ahead of the server after an OTA, or a corrupted stamp: points-era
  // (major ≥ 2) but no registered config. Must NOT be stored — storing it would
  // poison every future replay of this install (computeSnapshot would throw).
  const ahead = event({ engineConfigVersion: '4.0.0' });
  const r = await upload(store, [good, ahead]);
  assert.ok(r.ok);

  assert.deepEqual(r.body.acceptedRoundIds, [good.roundId]);
  assert.ok(r.body.rejectedRoundIds.includes(ahead.roundId));
  assert.equal(r.body.snapshot.totalRounds, 1); // the poison never landed

  // The install stays replayable: a follow-up sync-down does not throw.
  const me = await handleGetMe(store, INSTALL, false, NOW);
  assert.ok(me.ok);
  assert.equal(me.body.snapshot.totalRounds, 1);
});

test('P4-T2 coexistence: 2.0.0 and 3.0.0 events replay together, each under its era', async () => {
  const store = new MemoryEventStore();
  // A 3.0.0 event on the unified scale (rating 400 = hard, base 30) interleaved with
  // a 2.0.0 event (rating 900 = low, base 10). Both are registered → both scored.
  const v2 = event({ engineConfigVersion: '2.0.0', wordRatingAtPlay: 900 });
  const v3 = event({ engineConfigVersion: '3.0.0', wordRatingAtPlay: 400 });
  const r = await upload(store, [v2, v3]);
  assert.ok(r.ok);

  assert.equal(r.body.snapshot.totalRounds, 2);
  assert.equal(r.body.snapshot.global.gamesPlayed, 2); // both are points-era → both scored
  // Server truth must equal the client fold over the identical events (anti-cheat base).
  const client = replayEvents([v2, v3], { rating: SEED_RATING, streak: 0, gamesPlayed: 0 });
  assert.equal(r.body.snapshot.global.score, client.rating);
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
  const client = replayEvents(r.body.events!, { rating: SEED_RATING, streak: 0, gamesPlayed: 0 });
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

// ─── P4-T9: accounts + transfer-code claim ───────────────────────────────────

function uploadAs(store: MemoryEventStore, installId: string, events: RoundEvent[]) {
  return handleUploadRounds(
    store,
    { installId, schemaVersion: ROUND_EVENT_SCHEMA_VERSION, events },
    NOW,
  );
}

/** Assert a handler succeeded (transport-wise) and return its body — narrows the union. */
function must<T>(r: { ok: true; body: T } | { ok: false; error: unknown }): T {
  assert.ok(r.ok);
  return r.body;
}

test('P4-T9 DoD — new device claims a code and restores the merged history', async () => {
  const store = new MemoryEventStore();
  // Phone (install-a) plays some rounds.
  const phoneEvents = [
    event({ installId: 'install-a' }),
    event({ installId: 'install-a', topic: 'Music' }),
    event({ installId: 'install-a' }),
  ];
  await uploadAs(store, 'install-a', phoneEvents);
  const phoneScore = must(await handleGetMe(store, 'install-a', false, NOW)).snapshot.global.score;
  assert.ok(phoneScore > 0);

  // Phone mints a transfer code.
  const codeRes = await handleCreateCode(store, 'install-a', NOW, mkAccountId, mkCode);
  assert.ok(codeRes.ok);
  assert.equal(codeRes.body.expiresAt, NOW + CLAIM_CODE_TTL_MS);

  // Tablet (install-b, fresh) claims it.
  const claim = await handleClaim(store, { installId: 'install-b', code: codeRes.body.code }, NOW);
  assert.ok(claim.ok && claim.body.ok);
  assert.equal(claim.body.accountId, codeRes.body.accountId);
  // The merged snapshot equals the phone's, and the events replay to it locally.
  assert.equal(claim.body.snapshot!.global.score, phoneScore);
  assert.equal(claim.body.events!.length, 3);
  const local = replayEvents(claim.body.events!, { rating: SEED_RATING, streak: 0, gamesPlayed: 0 });
  assert.equal(local.rating, phoneScore);
});

test('after claim, BOTH installs get the merged account snapshot, and new rounds merge', async () => {
  const store = new MemoryEventStore();
  await uploadAs(store, 'install-a', [event({ installId: 'install-a' })]);
  const code = must(await handleCreateCode(store, 'install-a', NOW, mkAccountId, mkCode)).code;
  await handleClaim(store, { installId: 'install-b', code }, NOW);

  // Tablet plays a new round → it folds into the SAME account.
  await uploadAs(store, 'install-b', [event({ installId: 'install-b' })]);

  const fromPhone = must(await handleGetMe(store, 'install-a', false, NOW)).snapshot;
  const fromTablet = must(await handleGetMe(store, 'install-b', false, NOW)).snapshot;
  assert.equal(fromPhone.global.gamesPlayed, 2); // both installs' rounds
  assert.deepEqual(fromPhone.global, fromTablet.global); // one shared account view
  assert.equal(fromPhone.accountId, fromTablet.accountId);
});

test('F12 — an install that already owns a history cannot claim another account', async () => {
  const store = new MemoryEventStore();
  // install-a has account A; install-b has its own account B.
  const codeA = must(await handleCreateCode(store, 'install-a', NOW, mkAccountId, mkCode)).code;
  const acctB = must(await handleCreateCode(store, 'install-b', NOW, mkAccountId, mkCode)).accountId;

  // install-b (already bound to B) tries to claim A's code → rejected, unchanged.
  const claim = await handleClaim(store, { installId: 'install-b', code: codeA }, NOW);
  assert.ok(claim.ok);
  assert.equal(claim.body.ok, false);
  assert.equal(claim.body.reason, 'already_claimed');
  assert.equal(claim.body.accountId, acctB); // still its own account
});

test('a spent, expired, or unknown code is rejected as unknown_code', async () => {
  const store = new MemoryEventStore();
  const code = must(await handleCreateCode(store, 'install-a', NOW, mkAccountId, mkCode)).code;

  // Spent: first claim consumes it, a second (different install) fails.
  await handleClaim(store, { installId: 'install-b', code }, NOW);
  const spent = await handleClaim(store, { installId: 'install-c', code }, NOW);
  assert.equal(must(spent).reason, 'unknown_code');

  // Expired.
  const code2 = must(await handleCreateCode(store, 'install-x', NOW, mkAccountId, mkCode)).code;
  const expired = await handleClaim(store, { installId: 'install-y', code: code2 }, NOW + CLAIM_CODE_TTL_MS + 1);
  assert.equal(must(expired).reason, 'unknown_code');

  // Never issued.
  const unknown = await handleClaim(store, { installId: 'install-z', code: 'NOPE' }, NOW);
  assert.equal(must(unknown).reason, 'unknown_code');
});

test('re-claiming your OWN account code is an idempotent success', async () => {
  const store = new MemoryEventStore();
  const res = await handleCreateCode(store, 'install-a', NOW, mkAccountId, mkCode);
  const again = await handleClaim(store, { installId: 'install-a', code: must(res).code }, NOW);
  assert.ok(must(again).ok);
  assert.equal(must(again).accountId, must(res).accountId);
});

test('anonymous play is untouched: an unbound install snapshots on its own events', async () => {
  const store = new MemoryEventStore();
  await uploadAs(store, 'solo', [event({ installId: 'solo' })]);
  const me = await handleGetMe(store, 'solo', false, NOW);
  assert.ok(me.ok);
  assert.equal(me.body.snapshot.accountId, null); // no account, zero friction
  assert.equal(me.body.snapshot.global.gamesPlayed, 1);
});

test('F14 — account deletion erases every bound install\'s events', async () => {
  const store = new MemoryEventStore();
  await uploadAs(store, 'install-a', [event({ installId: 'install-a' })]);
  const code = must(await handleCreateCode(store, 'install-a', NOW, mkAccountId, mkCode)).code;
  await handleClaim(store, { installId: 'install-b', code }, NOW);
  await uploadAs(store, 'install-b', [event({ installId: 'install-b' })]);

  const del = await handleDeleteAccount(store, 'install-b');
  assert.ok(del.ok);
  assert.equal(del.body.deletedEvents, 2); // both installs' events
  assert.equal(del.body.deletedInstalls, 2);
  // Both installs are now empty anonymous accounts again.
  assert.equal(must(await handleGetMe(store, 'install-a', false, NOW)).snapshot.totalRounds, 0);
});
