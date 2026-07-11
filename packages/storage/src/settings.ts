/**
 * App settings/flags — a tiny kv table (migration 002). JSON-encoded values so
 * booleans/numbers round-trip without per-key parsing code.
 *
 * Known keys (the app owns the vocabulary):
 *   hapticsEnabled  boolean (default true)
 *   onboardingSeen  boolean (default false)
 */

import type { SqlDriver } from './driver.ts';

export function getSetting<T>(db: SqlDriver, key: string, fallback: T): T {
  const row = db.get<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key]);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export function setSetting<T>(db: SqlDriver, key: string, value: T): void {
  db.run(
    'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, JSON.stringify(value)],
  );
}
