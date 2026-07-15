/**
 * T14 client sync, end-to-end against the REAL server handlers (@sabd/ingest) and
 * the REAL client storage (@sabd/storage over node:sqlite) through a fake fetch:
 * upload → synced_at stamped; failure → queue intact, retry works; reinstall →
 * full log restored, cache/seenIds/streaks all back.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import {
  countRounds,
  getPlayer,
  getUnsynced,
  playedWordIds,
  recordRound,
  runMigrations,
  seedPlayer,
  topicRating,
  type RecordRoundInput,
  type SqlDriver,
} from '@sabd/storage';
import { handleGetMe, handleUploadRounds, MemoryEventStore } from '@sabd/ingest';
// Test-only reach into the storage package's node driver (same SQLite as device).
import { NodeSqliteDriver } from '../../../packages/storage/test/nodeDriver.ts';
import { syncPass, uploadUnsynced, type FetchJson } from '../src/sync/syncClient.ts';

const silent = (): void => {};
const INSTALL = 'install-e2e';
const BASE = 'https://ingest.example';
let clock = 1_752_000_000_000;
const tick = (): number => (clock += 60_000);

function freshDb(): NodeSqliteDriver {
  const db = new NodeSqliteDriver();
  runMigrations(db);
  seedPlayer(db, INSTALL, tick());
  return db;
}

function roundInput(overrides: Partial<RecordRoundInput> = {}): RecordRoundInput {
  return {
    roundId: randomUUID(),
    playedAt: tick(),
    word: { id: `GAM-${String(clock % 100_000)}`, difficulty: 1000, topic: 'Gaming' },
    wordBankVersion: '1.0.0',
    solved: true,
    timeLimitSec: 60,
    timeUsedSec: 20,
    hintsUsed: [],
    mode: 'solo',
    challengeMode: false,
    ...overrides,
  };
}

/** fetchJson that routes to the real handlers over a shared MemoryEventStore. */
function serverFetch(store: MemoryEventStore, opts: { failUploads?: boolean } = {}): FetchJson {
  return async (url, init) => {
    const u = new URL(url);
    if (init?.method === 'POST' && u.pathname === '/v1/rounds') {
      if (opts.failUploads) throw new Error('network down');
      const r = await handleUploadRounds(store, JSON.parse(init.body!), tick());
      if (!r.ok) throw new Error(`HTTP ${r.error.status}`);
      return r.body;
    }
    if (u.pathname === '/v1/me') {
      const r = await handleGetMe(
        store,
        init?.headers?.['X-Install-Id'] ?? '',
        u.searchParams.get('includeEvents') === '1',
        tick(),
      );
      if (!r.ok) throw new Error(`HTTP ${r.error.status}`);
      return r.body;
    }
    throw new Error(`404 ${url}`);
  };
}

function playRounds(db: SqlDriver, n: number): void {
  for (let i = 0; i < n; i++) {
    recordRound(db, roundInput({ solved: i % 3 !== 2 }));
  }
}

test('upload: all unsynced events land, get stamped, server agrees with local cache', async () => {
  const db = freshDb();
  playRounds(db, 5);
  assert.equal(getUnsynced(db).length, 5);

  const store = new MemoryEventStore();
  const summary = await uploadUnsynced(db, serverFetch(store), BASE, tick(), silent);

  assert.equal(summary.uploaded, 5);
  assert.equal(summary.rejected, 0);
  assert.equal(summary.diverged, false); // server replay == local cache
  assert.equal(getUnsynced(db).length, 0);
});

test('upload failure: queue intact, a later pass retries and succeeds (with duplicates)', async () => {
  const db = freshDb();
  playRounds(db, 3);
  const store = new MemoryEventStore();

  await assert.rejects(() => uploadUnsynced(db, serverFetch(store, { failUploads: true }), BASE, tick(), silent));
  assert.equal(getUnsynced(db).length, 3); // nothing lost

  const retry = await uploadUnsynced(db, serverFetch(store), BASE, tick(), silent);
  assert.equal(retry.uploaded, 3);
  assert.equal(getUnsynced(db).length, 0);

  // …and a re-upload after a lost response is pure duplicates, still marked synced.
  db.run('UPDATE round_event SET synced_at = NULL', []);
  const again = await uploadUnsynced(db, serverFetch(store), BASE, tick(), silent);
  assert.equal(again.uploaded, 3);
  assert.equal(getUnsynced(db).length, 0);
});

test('T13 e2e: uninstall/reinstall restores score, streaks, and seenIds after one sync', async () => {
  // Device 1: play, sync up.
  const db1 = freshDb();
  playRounds(db1, 6);
  const store = new MemoryEventStore();
  await syncPass(db1, serverFetch(store), BASE, tick(), silent);

  const before = {
    rating: getPlayer(db1)!.cachedRating,
    streak: getPlayer(db1)!.cachedStreak,
    gaming: topicRating(db1, 'Gaming'),
    seen: playedWordIds(db1),
  };
  assert.ok(before.rating > 0);

  // "Reinstall": fresh db, same installId, empty log.
  const db2 = freshDb();
  assert.equal(countRounds(db2), 0);
  const { restore } = await syncPass(db2, serverFetch(store), BASE, tick(), silent);

  assert.equal(restore?.restored, 6);
  assert.equal(getPlayer(db2)!.cachedRating, before.rating);
  assert.equal(getPlayer(db2)!.cachedStreak, before.streak);
  assert.equal(topicRating(db2, 'Gaming'), before.gaming);
  assert.deepEqual(playedWordIds(db2), before.seen); // selection exclusions survive
  assert.equal(getUnsynced(db2).length, 0); // restored events arrive already synced

  // Play continues seamlessly on the restored log.
  recordRound(db2, roundInput());
  assert.ok(getPlayer(db2)!.cachedRating > before.rating);
});

test('restore is a no-op for a genuinely new player (server has nothing)', async () => {
  const db = freshDb();
  const { restore, upload } = await syncPass(db, serverFetch(new MemoryEventStore()), BASE, tick(), silent);
  assert.equal(restore, null);
  assert.equal(upload.uploaded, 0);
  assert.equal(getPlayer(db)!.cachedRating, 0);
});
