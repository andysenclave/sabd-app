/**
 * The §9.6 test suite (event-log doc):
 *   replay determinism · idempotent append · crash mid-transaction leaves no
 *   half-state · corrupted cache self-heals on launch · full replay from 1200
 *   matches the cache after N rounds — plus fresh-install/upgrade migration paths.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { SEED_RATING, validateExportFile, validateRoundEvent } from '@sabd/contracts';
import {
  MIGRATIONS,
  getSchemaVersion,
  runMigrations,
  seedPlayer,
  getPlayer,
  updateCache,
  recordRound,
  countRounds,
  getRoundsAfter,
  getUnsynced,
  verifyRating,
  fullReplay,
  buildExport,
  getOrCreateInstallId,
  playedWordIds,
  topicStats,
  getSetting,
  setSetting,
  type RecordRoundInput,
  type SqlDriver,
} from '../src/index.ts';
import { NodeSqliteDriver, FailingDriver } from './nodeDriver.ts';

const silent = (): void => {};
let clock = 1_700_000_000_000;
const tick = (): number => (clock += 60_000);

function freshDb(): NodeSqliteDriver {
  const db = new NodeSqliteDriver();
  runMigrations(db);
  seedPlayer(db, randomUUID(), tick());
  return db;
}

function roundInput(overrides: Partial<RecordRoundInput> = {}): RecordRoundInput {
  return {
    roundId: randomUUID(),
    playedAt: tick(),
    word: { id: 'GAM-0001', difficulty: 1200, topic: 'Gaming' },
    wordBankVersion: '0.1.0',
    solved: true,
    timeLimitSec: 60,
    timeUsedSec: 20,
    hintsUsed: [],
    mode: 'solo',
    challengeMode: false,
    ...overrides,
  };
}

/** Play n rounds with varied outcomes; returns the db. */
function playRounds(db: SqlDriver, n: number): void {
  for (let i = 0; i < n; i++) {
    recordRound(
      db,
      roundInput({
        solved: i % 3 !== 2,
        timeUsedSec: 10 + (i % 5) * 9,
        hintsUsed: i % 4 === 1 ? ['position'] : i % 4 === 3 ? ['position', 'letters'] : [],
        word: { id: `GAM-${String(i + 1).padStart(4, '0')}`, difficulty: 900 + i * 37, topic: 'Gaming' },
      }),
    );
  }
}

// ─── Migrations (T9: fresh install + upgrade) ────────────────────────────────

test('fresh install: migrations run from zero and are idempotent', () => {
  const db = new NodeSqliteDriver();
  assert.equal(getSchemaVersion(db), 0);
  const applied = runMigrations(db);
  assert.equal(applied.length, MIGRATIONS.length);
  assert.equal(getSchemaVersion(db), MIGRATIONS[MIGRATIONS.length - 1]!.version);
  // second run = upgrade path with nothing to do
  assert.equal(runMigrations(db).length, 0);
});

const LATEST = MIGRATIONS[MIGRATIONS.length - 1]!.version;

test('upgrade: only migrations above the stored version run, in order', () => {
  const db = new NodeSqliteDriver();
  runMigrations(db); // at latest
  const fake = [
    ...MIGRATIONS,
    { version: LATEST + 1, name: 'add-col', sql: 'ALTER TABLE player ADD COLUMN test_col TEXT' },
  ];
  const applied = runMigrations(db, fake);
  assert.deepEqual(applied.map((m) => m.version), [LATEST + 1]);
  assert.equal(getSchemaVersion(db), LATEST + 1);
});

test('a failing migration rolls back atomically (version stays put)', () => {
  const db = new NodeSqliteDriver();
  runMigrations(db);
  const bad = [
    ...MIGRATIONS,
    { version: LATEST + 1, name: 'broken', sql: 'ALTER TABLE player ADD COLUMN ok TEXT; SYNTAX ERROR;' },
  ];
  assert.throws(() => runMigrations(db, bad));
  assert.equal(getSchemaVersion(db), LATEST);
  // the partial ALTER must not have survived
  assert.equal(db.all("SELECT name FROM pragma_table_info('player') WHERE name='ok'").length, 0);
});

// ─── Identity + seed ─────────────────────────────────────────────────────────

test('getOrCreateInstallId creates once, then returns the same identity', () => {
  const db = new NodeSqliteDriver();
  runMigrations(db);
  const first = getOrCreateInstallId(db, randomUUID, tick());
  const second = getOrCreateInstallId(db, randomUUID, tick());
  assert.equal(first.installId, second.installId);
  assert.equal(first.cachedRating, SEED_RATING);
  assert.equal(first.cachedGamesPlayed, 0);
  assert.equal(first.cachedAfterRoundId, null);
});

// ─── recordRound / appendRound ───────────────────────────────────────────────

test('recordRound applies the engine and moves the cache atomically', () => {
  const db = freshDb();
  const outcome = recordRound(db, roundInput({ timeUsedSec: 0 })); // instant solve
  assert.equal(outcome.inserted, true);
  assert.ok(outcome.update.delta > 0);
  const player = getPlayer(db)!;
  assert.equal(player.cachedRating, SEED_RATING + outcome.update.delta);
  assert.equal(player.cachedGamesPlayed, 1);
  assert.equal(player.cachedAfterRoundId, outcome.event.roundId);
  // the persisted event round-trips through the contract validator
  const [stored] = getRoundsAfter(db, null);
  assert.equal(validateRoundEvent(stored).ok, true);
});

test('idempotent append: double-firing onRoundEnd cannot double-count', () => {
  const db = freshDb();
  const input = roundInput({ timeUsedSec: 0 });
  const first = recordRound(db, input);
  const ratingAfterFirst = getPlayer(db)!.cachedRating;

  const second = recordRound(db, input); // same roundId — duplicate
  assert.equal(second.inserted, false);
  assert.equal(countRounds(db), 1);
  assert.equal(getPlayer(db)!.cachedRating, ratingAfterFirst);
  assert.equal(getPlayer(db)!.cachedGamesPlayed, 1);
  assert.equal(first.event.roundId, second.event.roundId);
});

test('crash mid-transaction leaves no half-state (event inserted, cache update dies)', () => {
  const inner = new NodeSqliteDriver();
  runMigrations(inner);
  seedPlayer(inner, randomUUID(), tick());

  // run #1 inside recordRound's transaction = event INSERT, run #2 = cache UPDATE.
  const crashing = new FailingDriver(inner, 2);
  assert.throws(() => recordRound(crashing, roundInput()), /simulated crash/);

  // NEITHER landed: no event row, cache untouched.
  assert.equal(countRounds(inner), 0);
  const player = getPlayer(inner)!;
  assert.equal(player.cachedRating, SEED_RATING);
  assert.equal(player.cachedGamesPlayed, 0);
  assert.equal(player.cachedAfterRoundId, null);
});

test('challenge rounds are rejected under schema v1 (not replayable)', () => {
  const db = freshDb();
  assert.throws(() => recordRound(db, roundInput({ challengeMode: true })), /challengeMode/);
  assert.equal(countRounds(db), 0);
});

// ─── Replay: determinism, self-heal, full replay ─────────────────────────────

test('replay is deterministic: two identical logs produce the identical rating', () => {
  const a = freshDb();
  const b = freshDb();
  // identical inputs (fix the uuids so both logs match)
  for (let i = 0; i < 12; i++) {
    const shared = roundInput({
      roundId: `fixed-${i}`,
      solved: i % 3 !== 2,
      timeUsedSec: 5 + i * 4,
      hintsUsed: i % 2 ? ['letters'] : [],
      word: { id: `GAM-${i}`, difficulty: 1000 + i * 50, topic: 'Gaming' },
    });
    recordRound(a, shared);
    recordRound(b, shared);
  }
  assert.equal(getPlayer(a)!.cachedRating, getPlayer(b)!.cachedRating);
  const ra = fullReplay(a, silent);
  const rb = fullReplay(b, silent);
  assert.equal(ra.rating, rb.rating);
});

test('verifyRating: clean launch replays nothing and does not heal', () => {
  const db = freshDb();
  playRounds(db, 5);
  const v = verifyRating(db, silent);
  assert.equal(v.replayed, 0);
  assert.equal(v.healed, false);
});

test('verifyRating: a corrupted cache self-heals on launch — the log wins', () => {
  const db = freshDb();
  playRounds(db, 8);
  const honest = getPlayer(db)!;

  // Corrupt the cache: rating tampered AND pointer rolled back 3 rounds.
  const all = getRoundsAfter(db, null);
  const stalePointer = all[all.length - 4]!.roundId;
  updateCache(db, 9999, honest.cachedGamesPlayed - 3, stalePointer);

  const warnings: string[] = [];
  const v = verifyRating(db, (m) => warnings.push(m));
  assert.equal(v.replayed, 3);
  assert.equal(v.healed, true);
  assert.ok(warnings.some((w) => w.includes('log wins')));

  // Snapshot verify detects tail divergence but replays FROM the corrupted snapshot
  // base — catching deep drift is exactly why §5 keeps fullReplay as a second tier.
  const f = fullReplay(db, silent);
  assert.equal(f.healed, true);
  assert.equal(f.rating, honest.cachedRating); // the honest number, recomputed from 1200
  assert.equal(getPlayer(db)!.cachedRating, honest.cachedRating);

  // And once fully healed, a second full replay finds nothing to fix.
  const f2 = fullReplay(db, silent);
  assert.equal(f2.healed, false);
});

test('full replay from 1200 matches the cache after N rounds', () => {
  const db = freshDb();
  playRounds(db, 25);
  const cached = getPlayer(db)!.cachedRating;
  const f = fullReplay(db, silent);
  assert.equal(f.replayed, 25);
  assert.equal(f.healed, false); // cache already equals the replay — no drift
  assert.equal(f.rating, cached);
});

// ─── Log-derived queries (word selection + Home grid) ────────────────────────

test('playedWordIds returns the distinct words this install has faced', () => {
  const db = freshDb();
  playRounds(db, 6);
  const ids = playedWordIds(db);
  assert.equal(ids.size, 6);
  assert.ok(ids.has('GAM-0001'));
  // replaying an existing word id (different roundId) does not grow the set
  recordRound(db, roundInput({ word: { id: 'GAM-0001', difficulty: 900, topic: 'Gaming' } }));
  assert.equal(playedWordIds(db).size, 6);
});

test('topicStats aggregates per topic with the latest rating-before', () => {
  const db = freshDb();
  recordRound(db, roundInput({ solved: true, word: { id: 'GAM-1', difficulty: 1200, topic: 'Gaming' } }));
  recordRound(db, roundInput({ solved: false, word: { id: 'MUS-1', difficulty: 1100, topic: 'Music' } }));
  const r3 = recordRound(
    db,
    roundInput({ solved: true, word: { id: 'GAM-2', difficulty: 1300, topic: 'Gaming' } }),
  );

  const stats = new Map(topicStats(db).map((s) => [s.topic, s]));
  assert.equal(stats.get('Gaming')?.rounds, 2);
  assert.equal(stats.get('Gaming')?.solved, 2);
  assert.equal(stats.get('Music')?.rounds, 1);
  assert.equal(stats.get('Music')?.solved, 0);
  // Gaming's lastRatingBefore = what the player was rated entering their LATEST Gaming round.
  assert.equal(stats.get('Gaming')?.lastRatingBefore, r3.event.playerRatingBefore);
});

// ─── Settings kv (migration 002) ─────────────────────────────────────────────

test('settings kv: defaults, round-trip, overwrite; v1→v2 upgrade path works', () => {
  // Simulate an EXISTING install at schema v1, then upgrade.
  const db = new NodeSqliteDriver();
  runMigrations(db, MIGRATIONS.filter((m) => m.version === 1));
  assert.equal(getSchemaVersion(db), 1);
  seedPlayer(db, randomUUID(), tick());
  const applied = runMigrations(db); // upgrade to latest
  assert.deepEqual(applied.map((m) => m.version), [2]);

  assert.equal(getSetting(db, 'hapticsEnabled', true), true); // default
  setSetting(db, 'hapticsEnabled', false);
  assert.equal(getSetting(db, 'hapticsEnabled', true), false);
  setSetting(db, 'hapticsEnabled', true); // overwrite (upsert)
  assert.equal(getSetting(db, 'hapticsEnabled', false), true);
  setSetting(db, 'onboardingSeen', true);
  assert.equal(getSetting(db, 'onboardingSeen', false), true);
});

// ─── Export ──────────────────────────────────────────────────────────────────

test('export: envelope validates against the contract; synced_at untouched', () => {
  const db = freshDb();
  playRounds(db, 4);
  const file = buildExport(db, tick());
  assert.equal(validateExportFile(file).ok, true);
  assert.equal(file.rounds.length, 4);
  assert.ok(file.rounds.every((r) => r.syncedAt === null));
  assert.equal(getUnsynced(db).length, 4); // export does not stamp anything
});

test('export with zero rounds is a valid empty envelope (UI shows empty state)', () => {
  const db = freshDb();
  const file = buildExport(db, tick());
  assert.equal(validateExportFile(file).ok, true);
  assert.equal(file.rounds.length, 0);
});
