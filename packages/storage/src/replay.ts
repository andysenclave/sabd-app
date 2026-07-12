/**
 * Replay (event-log doc §5/§6) — the score is `reduce(applyPoints)` over the log.
 *
 * All math comes from @sabd/elo; nothing is reimplemented here (standing order:
 * scoring math in a component or in storage is a defect).
 *
 * The fold carries the solve streak alongside the score, so a streak that spans the
 * snapshot boundary survives an incremental verify. Only rounds AFTER the scoring epoch
 * count: pre-reset (Elo-era) rounds stay on disk but never fold into the score.
 *
 * If an event carries an engineConfigVersion other than the current one, we warn and
 * replay under the current config — a config registry becomes necessary only after a
 * second tuning change ships.
 */

import type { RoundEvent, RoundResult } from '@sabd/contracts';
import { SEED_RATING } from '@sabd/contracts';
import { applyPoints, defaultConfig, ENGINE_CONFIG_VERSION, type PointsConfig } from '@sabd/elo';
import type { SqlDriver } from './driver.ts';
import { getPlayer, updateCache } from './player.ts';
import { getRoundsAfter } from './events.ts';

export function eventToRoundResult(e: RoundEvent): RoundResult {
  return {
    solved: e.solved,
    timeLimitSec: e.timeLimitSec,
    timeUsedSec: e.timeUsedSec,
    hintsUsed: e.hintsUsed,
    wordDifficulty: e.wordRatingAtPlay,
    mode: e.mode,
  };
}

export interface ReplayState {
  rating: number;
  streak: number;
  gamesPlayed: number;
}

export interface ReplayOutcome {
  rating: number;
  streak: number;
  gamesPlayed: number;
  /** round_id of the last event folded in; null when no events were replayed. */
  lastRoundId: string | null;
  configMismatches: number;
}

/** Fold a list of events into a score + streak, starting from the given state. Pure. */
export function replayEvents(
  events: readonly RoundEvent[],
  start: ReplayState,
  config: PointsConfig = defaultConfig,
  warn: (msg: string) => void = console.warn,
): ReplayOutcome {
  let rating = start.rating;
  let streak = start.streak;
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
    const update = applyPoints({ rating, streak }, eventToRoundResult(e), config);
    rating = update.newPlayerRating;
    streak = update.streak;
    gamesPlayed += 1;
    lastRoundId = e.roundId;
  }

  return { rating, streak, gamesPlayed, lastRoundId, configMismatches };
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
    { rating: player.cachedRating, streak: player.cachedStreak, gamesPlayed: player.cachedGamesPlayed },
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
    updateCache(db, outcome.rating, outcome.gamesPlayed, outcome.streak, outcome.lastRoundId);
  });
  return { healed: diverged, replayed: tail.length, rating: outcome.rating };
}

/**
 * fullReplay (§5, debug action) — recompute from the 0 seed over every round AFTER the
 * scoring epoch and reconcile the cache. Catches deep drift the snapshot can't see.
 */
export function fullReplay(
  db: SqlDriver,
  warn: (msg: string) => void = console.warn,
): VerifyResult {
  const player = getPlayer(db);
  if (!player) throw new Error('fullReplay: no player row — seedPlayer must run first');

  const scored = getRoundsAfter(db, player.scoreEpochRoundId);
  const outcome = replayEvents(
    scored,
    { rating: SEED_RATING, streak: 0, gamesPlayed: 0 },
    defaultConfig,
    warn,
  );

  const diverged =
    outcome.rating !== player.cachedRating || outcome.gamesPlayed !== player.cachedGamesPlayed;
  if (diverged) {
    warn(
      `fullReplay: cache said ${player.cachedRating} (${player.cachedGamesPlayed} games), ` +
        `log says ${outcome.rating} (${outcome.gamesPlayed} games) — log wins`,
    );
    db.transaction(() => {
      updateCache(db, outcome.rating, outcome.gamesPlayed, outcome.streak, outcome.lastRoundId);
    });
  }
  return { healed: diverged, replayed: scored.length, rating: outcome.rating };
}
