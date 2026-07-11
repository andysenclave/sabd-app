/**
 * App storage bootstrap (event-log doc §9): open SQLite, run migrations, ensure the
 * installId exists (expo-crypto random UUID — NEVER a device id), verify the cached
 * rating against the log (log wins on divergence), and hand back the driver.
 *
 * A module singleton: the round loop (T15) and Settings/export (T23) both go through
 * `getStorage()`.
 */

import { openDatabaseSync } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { runMigrations, getOrCreateInstallId, verifyRating, type SqlDriver } from '@sabd/storage';

import { ExpoSqliteDriver } from './expoDriver.ts';
import type { Storage } from './db.types.ts';

export type { Storage } from './db.types.ts';

let instance: Storage | null = null;

export function initStorage(dbName = 'sabd.db'): Storage {
  if (instance) return instance;

  const db: SqlDriver = new ExpoSqliteDriver(openDatabaseSync(dbName));
  runMigrations(db);
  const player = getOrCreateInstallId(db, randomUUID, Date.now());
  const verify = verifyRating(db); // self-heals + warns via console on divergence
  if (verify.healed) {
    console.warn(`storage: cache self-healed on launch → rating ${verify.rating}`);
  }

  instance = { db, player, verify };
  return instance;
}

export function getStorage(): Storage {
  if (!instance) throw new Error('getStorage: initStorage() has not run');
  return instance;
}
