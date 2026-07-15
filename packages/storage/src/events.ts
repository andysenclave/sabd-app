/**
 * The append-only event log (event-log doc §4/§9). Never UPDATE, never DELETE —
 * the single exception is stamping `synced_at` after a successful upload (§7.1),
 * which Phase 2's manual loop never does.
 */

import type { CategoryScore, RoundEvent } from '@sabd/contracts';
import { SEED_RATING } from '@sabd/contracts';
import type { SqlDriver } from './driver.ts';
import { eventToParams, rowToEvent, INSERT_EVENT_SQL, type RoundEventRow } from './rows.ts';
import { getPlayer, updateCache } from './player.ts';
import { replayEvents } from './replay.ts';

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
  cacheAfter: { rating: number; gamesPlayed: number; streak: number },
): AppendResult {
  return db.transaction(() => {
    const { changes } = db.run(INSERT_EVENT_SQL, eventToParams(event));
    if (changes === 0) return { inserted: false }; // duplicate → success, no cache touch
    updateCache(db, cacheAfter.rating, cacheAfter.gamesPlayed, cacheAfter.streak, event.roundId);
    return { inserted: true };
  });
}

/**
 * Rowid of a round, for "events after X" range queries. Returns 0 (before every row)
 * when the id is null or missing — so a null epoch means "count from the first round".
 */
function rowidOf(db: SqlDriver, roundId: string | null): number {
  if (roundId === null) return 0;
  return db.get<{ rowid: number }>('SELECT rowid FROM round_event WHERE round_id = ?', [roundId])?.rowid ?? 0;
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
  /**
   * This topic's OWN score: the points engine replayed only over this topic's rounds
   * (with its own streak), from 0 — independent of the player's global score and of
   * every other topic. Only rounds after the scoring epoch count.
   */
  rating: number;
  /** This topic's OWN live streak (from the same per-topic replay). */
  streak: number;
}

/** This topic's post-epoch rounds, in replay order. */
function topicEventsAfterEpoch(db: SqlDriver, topic: string, epochRowid: number): RoundEvent[] {
  return db
    .all<RoundEventRow>('SELECT * FROM round_event WHERE topic = ? AND rowid > ? ORDER BY rowid', [
      topic,
      epochRowid,
    ])
    .map(rowToEvent);
}

/** Per-topic aggregates for the Home grid, derived from the log (post-epoch only). */
export function topicStats(db: SqlDriver): TopicStats[] {
  const epochRowid = rowidOf(db, getPlayer(db)?.scoreEpochRoundId ?? null);
  // Only topics that actually have a post-epoch round — a topic whose only rounds
  // predate the reset shows as unplayed, not as "played, 0".
  const topics = db.all<{ topic: string }>(
    'SELECT DISTINCT topic FROM round_event WHERE rowid > ? ORDER BY topic',
    [epochRowid],
  );
  return topics.map(({ topic }) => {
    const events = topicEventsAfterEpoch(db, topic, epochRowid);
    const outcome = replayEvents(events, { rating: SEED_RATING, streak: 0, gamesPlayed: 0 });
    return {
      topic,
      rounds: events.length,
      solved: events.filter((e) => e.solved).length,
      rating: outcome.rating,
      streak: outcome.streak,
    };
  });
}

/**
 * The per-category scoring state in the SHARED CONTRACT shape (Phase-3 T3) — what the
 * sync layer compares against the server's PlayerSnapshot.categories and what the
 * profile screen (T18) reads. Same replay as topicStats, contract field names.
 */
export function categoryScores(db: SqlDriver): CategoryScore[] {
  return topicStats(db).map(({ topic, rounds, rating, streak }) => ({
    topic,
    score: rating,
    streak,
    gamesPlayed: rounds,
  }));
}

/**
 * A single topic's current score (post-epoch replay). Drives difficulty selection:
 * the harder your score in a topic, the harder the words that topic serves. Returns
 * SEED_RATING (0) for a topic never played since the epoch.
 */
export function topicRating(db: SqlDriver, topic: string): number {
  const epochRowid = rowidOf(db, getPlayer(db)?.scoreEpochRoundId ?? null);
  const events = topicEventsAfterEpoch(db, topic, epochRowid);
  return replayEvents(events, { rating: SEED_RATING, streak: 0, gamesPlayed: 0 }).rating;
}
