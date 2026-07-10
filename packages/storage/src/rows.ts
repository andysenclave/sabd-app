/**
 * Row mapping — the only place that knows how a logical RoundEvent (camelCase,
 * booleans, arrays) is laid out as a snake_case SQLite row (0/1 ints, JSON text).
 */

import type { GameMode, PaidHint, RoundEvent } from '@sabd/contracts';
import type { SqlValue } from './driver.ts';

export interface RoundEventRow {
  round_id: string;
  schema_version: number;
  install_id: string;
  played_at: number;
  word_id: string;
  word_rating_at_play: number;
  word_bank_version: string;
  topic: string;
  solved: number;
  time_limit_sec: number;
  time_used_sec: number;
  hints_used: string;
  mode: string;
  player_rating_before: number;
  engine_config_version: string;
  anomaly: number | null;
  synced_at: number | null;
}

export function eventToParams(e: RoundEvent): SqlValue[] {
  return [
    e.roundId,
    e.schemaVersion,
    e.installId,
    e.playedAt,
    e.wordId,
    e.wordRatingAtPlay,
    e.wordBankVersion,
    e.topic,
    e.solved ? 1 : 0,
    e.timeLimitSec,
    e.timeUsedSec,
    JSON.stringify(e.hintsUsed),
    e.mode,
    e.playerRatingBefore,
    e.engineConfigVersion,
    e.anomaly === undefined ? null : e.anomaly ? 1 : 0,
    e.syncedAt,
  ];
}

export const INSERT_EVENT_SQL = `
INSERT INTO round_event (
  round_id, schema_version, install_id, played_at,
  word_id, word_rating_at_play, word_bank_version, topic,
  solved, time_limit_sec, time_used_sec, hints_used, mode,
  player_rating_before, engine_config_version, anomaly, synced_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(round_id) DO NOTHING`;

export function rowToEvent(r: RoundEventRow): RoundEvent {
  const event: RoundEvent = {
    roundId: r.round_id,
    schemaVersion: r.schema_version,
    installId: r.install_id,
    playedAt: r.played_at,
    wordId: r.word_id,
    wordRatingAtPlay: r.word_rating_at_play,
    wordBankVersion: r.word_bank_version,
    topic: r.topic,
    solved: r.solved === 1,
    timeLimitSec: r.time_limit_sec,
    timeUsedSec: r.time_used_sec,
    hintsUsed: JSON.parse(r.hints_used) as PaidHint[],
    mode: r.mode as GameMode,
    playerRatingBefore: r.player_rating_before,
    engineConfigVersion: r.engine_config_version,
    syncedAt: r.synced_at,
  };
  if (r.anomaly !== null) event.anomaly = r.anomaly === 1;
  return event;
}
