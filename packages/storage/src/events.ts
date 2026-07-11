/**
 * The append-only event log (event-log doc §4/§9). Never UPDATE, never DELETE —
 * the single exception is stamping `synced_at` after a successful upload (§7.1),
 * which Phase 2's manual loop never does.
 */

import type { RoundEvent } from '@sabd/contracts';
import type { SqlDriver } from './driver.ts';
import { eventToParams, rowToEvent, INSERT_EVENT_SQL, type RoundEventRow } from './rows.ts';
import { updateCache } from './player.ts';

export interface AppendResult {
  /** False when round_id already existed — the caller treats that as success. */
  inserted: boolean;
}

/**
 * appendRound — event insert + cache update in ONE transaction (§5, non-negotiable).
 * A crash must never produce a rating the log can't explain.
 *
 * Idempotent on round_id: a duplicate append (double-fired onRoundEnd) inserts
 * nothing AND leaves the cache untouched, so replaying the same round twice cannot
 * double-count.
 */
export function appendRound(
  db: SqlDriver,
  event: RoundEvent,
  cacheAfter: { rating: number; gamesPlayed: number },
): AppendResult {
  return db.transaction(() => {
    const { changes } = db.run(INSERT_EVENT_SQL, eventToParams(event));
    if (changes === 0) return { inserted: false }; // duplicate → success, no cache touch
    updateCache(db, cacheAfter.rating, cacheAfter.gamesPlayed, event.roundId);
    return { inserted: true };
  });
}

/**
 * Rounds after the snapshot pointer, in INSERT order (rowid) — the append order is
 * the replay order; `played_at` is a client clock and may tie or jump.
 * `afterRoundId = null` returns the whole log.
 */
export function getRoundsAfter(db: SqlDriver, afterRoundId: string | null): RoundEvent[] {
  const rows =
    afterRoundId === null
      ? db.all<RoundEventRow>('SELECT * FROM round_event ORDER BY rowid')
      : db.all<RoundEventRow>(
          `SELECT * FROM round_event
           WHERE rowid > (SELECT rowid FROM round_event WHERE round_id = ?)
           ORDER BY rowid`,
          [afterRoundId],
        );
  return rows.map(rowToEvent);
}

/** Everything never uploaded (§7.1). In Phase 2 this is the whole log. */
export function getUnsynced(db: SqlDriver): RoundEvent[] {
  return db
    .all<RoundEventRow>('SELECT * FROM round_event WHERE synced_at IS NULL ORDER BY rowid')
    .map(rowToEvent);
}

/** Stamp synced_at after a successful upload. NOT used by the Phase-2 manual loop. */
export function markSynced(db: SqlDriver, roundIds: string[], syncedAt: number): void {
  db.transaction(() => {
    for (const id of roundIds) {
      db.run('UPDATE round_event SET synced_at = ? WHERE round_id = ? AND synced_at IS NULL', [
        syncedAt,
        id,
      ]);
    }
  });
}

export function countRounds(db: SqlDriver): number {
  return db.get<{ n: number }>('SELECT COUNT(*) AS n FROM round_event')?.n ?? 0;
}

/** Every word this install has faced — the persisted `seenIds` (word selection, T11). */
export function playedWordIds(db: SqlDriver): Set<string> {
  const rows = db.all<{ word_id: string }>('SELECT DISTINCT word_id FROM round_event');
  return new Set(rows.map((r) => r.word_id));
}

export interface TopicStats {
  topic: string;
  rounds: number;
  solved: number;
  /** playerRatingBefore of the LATEST round in this topic — "where you stood last time". */
  lastRatingBefore: number;
}

/** Per-topic aggregates for the Home grid, derived from the log. */
export function topicStats(db: SqlDriver): TopicStats[] {
  return db.all<TopicStats>(
    `SELECT topic,
            COUNT(*)    AS rounds,
            SUM(solved) AS solved,
            (SELECT player_rating_before FROM round_event r2
              WHERE r2.topic = round_event.topic
              ORDER BY r2.rowid DESC LIMIT 1) AS lastRatingBefore
     FROM round_event
     GROUP BY topic`,
  );
}
