/**
 * Replay (event-log doc §5/§6) — the rating is `reduce(applyResult)` over the log.
 *
 * All math comes from @sabd/elo; nothing is reimplemented here (standing order:
 * rating math in a component or in storage is a defect).
 *
 * Schema v1 does not persist challengeMode (Challenge is disabled in Phase 2 and
 * recordRound rejects it), so every replayed round is challengeMode: false. If an
 * event carries an engineConfigVersion other than the current one, we warn and replay
 * under the current config — a config-registry becomes necessary only after the first
 * tuning change ships.
 */

import type { RoundEvent, RoundResult } from '@sabd/contracts';
import { SEED_RATING } from '@sabd/contracts';
import { applyResult, defaultConfig, ENGINE_CONFIG_VERSION, type EloConfig } from '@sabd/elo';
import type { SqlDriver } from './driver.ts';
import { getPlayer, updateCache } from './player.ts';
import { getRoundsAfter } from './events.ts';

export function eventToRoundResult(
  e: RoundEvent,
  playerRating: number,
  gamesPlayed: number,
): RoundResult {
  return {
    solved: e.solved,
    timeLimitSec: e.timeLimitSec,
    timeUsedSec: e.timeUsedSec,
    hintsUsed: e.hintsUsed,
    opponentRating: e.wordRatingAtPlay,
    playerRating,
    gamesPlayed,
    mode: e.mode,
    challengeMode: false, // not persisted in schema v1; recordRound rejects challenge rounds
  };
}

export interface ReplayOutcome {
  rating: number;
  gamesPlayed: number;
  /** round_id of the last event folded in; null when no events were replayed. */
  lastRoundId: string | null;
  configMismatches: number;
}

/** Fold a list of events into a rating, starting from the given state. Pure. */
export function replayEvents(
  events: readonly RoundEvent[],
  start: { rating: number; gamesPlayed: number },
  config: EloConfig = defaultConfig,
  warn: (msg: string) => void = console.warn,
): ReplayOutcome {
  let rating = start.rating;
  let gamesPlayed = start.gamesPlayed;
  let lastRoundId: string | null = null;
  let configMismatches = 0;

  for (const e of events) {
    if (e.engineConfigVersion !== ENGINE_CONFIG_VERSION) {
      configMismatches++;
      warn(
        `replay: round ${e.roundId} was played under engine config ${e.engineConfigVersion}, ` +
          `replaying under ${ENGINE_CONFIG_VERSION}`,
      );
    }
    const update = applyResult(
      { rating, gamesPlayed },
      eventToRoundResult(e, rating, gamesPlayed),
      config,
    );
    rating = update.newPlayerRating;
    gamesPlayed += 1;
    lastRoundId = e.roundId;
  }

  return { rating, gamesPlayed, lastRoundId, configMismatches };
}

export interface VerifyResult {
  /** True when the cache disagreed with the log and was overwritten (log wins). */
  healed: boolean;
  /** Rounds replayed past the snapshot pointer (usually 0). */
  replayed: number;
  rating: number;
}

/**
 * verifyRating (§5) — snapshot verification on launch. Replays only rounds after
 * `cached_after_round_id`; on divergence THE LOG WINS: overwrite the cache, warn.
 */
export function verifyRating(
  db: SqlDriver,
  warn: (msg: string) => void = console.warn,
): VerifyResult {
  const player = getPlayer(db);
  if (!player) throw new Error('verifyRating: no player row — seedPlayer must run first');

  const tail = getRoundsAfter(db, player.cachedAfterRoundId);
  if (tail.length === 0) {
    return { healed: false, replayed: 0, rating: player.cachedRating };
  }

  const outcome = replayEvents(
    tail,
    { rating: player.cachedRating, gamesPlayed: player.cachedGamesPlayed },
    defaultConfig,
    warn,
  );

  const diverged = outcome.rating !== player.cachedRating;
  if (diverged) {
    warn(
      `verifyRating: cache said ${player.cachedRating}, log says ${outcome.rating} — log wins`,
    );
  }
  // Fold the tail into the cache either way — the snapshot pointer was stale.
  db.transaction(() => {
    updateCache(db, outcome.rating, outcome.gamesPlayed, outcome.lastRoundId);
  });
  return { healed: diverged, replayed: tail.length, rating: outcome.rating };
}

/**
 * fullReplay (§5, debug action) — recompute from the 1200 seed over the ENTIRE log
 * and reconcile the cache. Catches deep drift the snapshot can't see.
 */
export function fullReplay(
  db: SqlDriver,
  warn: (msg: string) => void = console.warn,
): VerifyResult {
  const player = getPlayer(db);
  if (!player) throw new Error('fullReplay: no player row — seedPlayer must run first');

  const all = getRoundsAfter(db, null);
  const outcome = replayEvents(all, { rating: SEED_RATING, gamesPlayed: 0 }, defaultConfig, warn);

  const diverged =
    outcome.rating !== player.cachedRating || outcome.gamesPlayed !== player.cachedGamesPlayed;
  if (diverged) {
    warn(
      `fullReplay: cache said ${player.cachedRating} (${player.cachedGamesPlayed} games), ` +
        `log says ${outcome.rating} (${outcome.gamesPlayed} games) — log wins`,
    );
    db.transaction(() => {
      updateCache(db, outcome.rating, outcome.gamesPlayed, outcome.lastRoundId);
    });
  }
  return { healed: diverged, replayed: all.length, rating: outcome.rating };
}
