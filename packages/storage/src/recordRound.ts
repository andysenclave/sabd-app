/**
 * recordRound — the storage side of the `onRoundEnd(result)` seam.
 *
 * Flow (event-log doc §5): read player → engine.applyPoints() → append event +
 * update cache in ONE transaction → return the RatingUpdate for the result screen.
 * All scoring math lives in @sabd/elo.
 */

import type { PaidHint, GameMode, RatingUpdate, RoundEvent, WordEntry } from '@sabd/contracts';
import { ROUND_EVENT_SCHEMA_VERSION } from '@sabd/contracts';
import { applyPoints, defaultConfig, ENGINE_CONFIG_VERSION, type PointsConfig } from '@sabd/elo';
import type { SqlDriver } from './driver.ts';
import { getPlayer } from './player.ts';
import { appendRound } from './events.ts';

export interface RecordRoundInput {
  /** Client-generated UUID (expo-crypto). The idempotency key. */
  roundId: string;
  /** Epoch ms, client clock. */
  playedAt: number;
  word: Pick<WordEntry, 'id' | 'difficulty' | 'topic'>;
  wordBankVersion: string;
  solved: boolean;
  timeLimitSec: number;
  timeUsedSec: number;
  hintsUsed: PaidHint[];
  mode: GameMode;
  /**
   * Challenge rounds are REJECTED in schema v1: challengeMode changes the rating but
   * is not persisted, so the log could not explain the resulting number. Challenge is
   * disabled in Phase 2; shipping it requires a schema bump (contract decision).
   */
  challengeMode: boolean;
  /** Clock-manipulation flag (wall vs. monotonic disagreement). */
  anomaly?: boolean;
}

export interface RecordRoundOutcome {
  update: RatingUpdate;
  event: RoundEvent;
  /** False when this roundId was already recorded (double-fire) — treated as success. */
  inserted: boolean;
}

export function recordRound(
  db: SqlDriver,
  input: RecordRoundInput,
  config: PointsConfig = defaultConfig,
): RecordRoundOutcome {
  if (input.challengeMode) {
    throw new Error(
      'recordRound: challengeMode is not persistable under round_event schema v1 — ' +
        'a challenge round could not be replayed. Challenge is Phase-3 scope.',
    );
  }

  const player = getPlayer(db);
  if (!player) throw new Error('recordRound: no player row — seedPlayer must run first');

  const update = applyPoints(
    { rating: player.cachedRating, streak: player.cachedStreak },
    {
      solved: input.solved,
      timeLimitSec: input.timeLimitSec,
      timeUsedSec: input.timeUsedSec,
      hintsUsed: input.hintsUsed,
      wordDifficulty: input.word.difficulty,
      mode: input.mode,
    },
    config,
  );

  const event: RoundEvent = {
    roundId: input.roundId,
    schemaVersion: ROUND_EVENT_SCHEMA_VERSION,
    installId: player.installId,
    playedAt: input.playedAt,
    wordId: input.word.id,
    wordRatingAtPlay: input.word.difficulty,
    wordBankVersion: input.wordBankVersion,
    topic: input.word.topic,
    solved: input.solved,
    timeLimitSec: input.timeLimitSec,
    timeUsedSec: input.timeUsedSec,
    hintsUsed: input.hintsUsed,
    mode: input.mode,
    playerRatingBefore: player.cachedRating,
    engineConfigVersion: ENGINE_CONFIG_VERSION,
    syncedAt: null,
  };
  if (input.anomaly !== undefined) event.anomaly = input.anomaly;

  const { inserted } = appendRound(db, event, {
    rating: update.newPlayerRating,
    gamesPlayed: player.cachedGamesPlayed + 1,
    streak: update.streak,
  });

  return { update, event, inserted };
}
