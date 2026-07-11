/**
 * Migrations — numbered, forward-only (event-log doc §9.2).
 *
 * The current schema version lives in SQLite's `PRAGMA user_version`. Each migration
 * runs in its own transaction; a fresh install replays all of them, an upgrade replays
 * only the ones above the stored version. Never edit a shipped migration — add a new one.
 */

import type { SqlDriver } from './driver.ts';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

/** 001 — the §4 schema, verbatim (player + round_event + indexes). */
const INIT_001 = `
CREATE TABLE player (
  install_id            TEXT PRIMARY KEY,
  created_at            INTEGER NOT NULL,
  cached_rating         INTEGER NOT NULL,
  cached_games_played   INTEGER NOT NULL,
  cached_after_round_id TEXT,
  user_id               TEXT
);

CREATE TABLE round_event (
  round_id              TEXT PRIMARY KEY,
  schema_version        INTEGER NOT NULL,
  install_id            TEXT NOT NULL,
  played_at             INTEGER NOT NULL,

  word_id               TEXT NOT NULL,
  word_rating_at_play   INTEGER NOT NULL,
  word_bank_version     TEXT NOT NULL,
  topic                 TEXT NOT NULL,

  solved                INTEGER NOT NULL,
  time_limit_sec        REAL    NOT NULL,
  time_used_sec         REAL    NOT NULL,
  hints_used            TEXT    NOT NULL,
  mode                  TEXT    NOT NULL,

  player_rating_before  INTEGER NOT NULL,
  engine_config_version TEXT    NOT NULL,

  anomaly               INTEGER,

  synced_at             INTEGER
);

CREATE INDEX idx_round_played   ON round_event(played_at);
CREATE INDEX idx_round_unsynced ON round_event(synced_at) WHERE synced_at IS NULL;
CREATE INDEX idx_round_word     ON round_event(word_id);
`;

/** 002 — app settings/flags (hapticsEnabled, onboardingSeen, …). */
const KV_002 = `
CREATE TABLE kv (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const MIGRATIONS: readonly Migration[] = [
  { version: 1, name: 'init', sql: INIT_001 },
  { version: 2, name: 'kv-settings', sql: KV_002 },
];

export function getSchemaVersion(db: SqlDriver): number {
  const row = db.get<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Bring the database to the latest schema. Returns the migrations that ran
 * (empty on an already-current database). Fresh install and upgrade are the
 * same code path — that is the point.
 */
export function runMigrations(
  db: SqlDriver,
  migrations: readonly Migration[] = MIGRATIONS,
): Migration[] {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  const current = getSchemaVersion(db);
  const applied: Migration[] = [];

  for (const m of sorted) {
    if (m.version <= current) continue;
    db.transaction(() => {
      db.exec(m.sql);
      // PRAGMA takes no bind params; version is a trusted integer from our own list.
      db.exec(`PRAGMA user_version = ${m.version}`);
    });
    applied.push(m);
  }
  return applied;
}
