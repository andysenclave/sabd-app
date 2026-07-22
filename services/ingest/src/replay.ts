/**
 * Server-side replay (T12) — the rating truth. Recomputes global + per-category
 * scores by replaying an install's stored events through THE SAME @sabd/elo package
 * the client runs. Nothing numeric is ever trusted from a client.
 *
 * Epoch rule: only points-era events fold into a score. The 2026-07 scoring reset
 * (migration 003 on-device) coincides exactly with engine 2.0.0, and every event
 * stamps its engineConfigVersion — so "points-era" is derivable from data already
 * in the event: major version ≥ 2. Elo-era events are stored (they still feed word
 * calibration, T15/T16) but never scored.
 */

import type { CategoryScore, PlayerSnapshot, RoundEvent, RoundResult } from '@sabd/contracts';
import { SEED_RATING } from '@sabd/contracts';
import { applyPoints, ENGINE_CONFIG_VERSION, isPointsEraConfig, requireConfig } from '@sabd/elo';

/** Points-era = engineConfigVersion major ≥ 2 (see module note). */
export function isPointsEra(e: RoundEvent): boolean {
  return isPointsEraConfig(e.engineConfigVersion);
}

function eventToRoundResult(e: RoundEvent): RoundResult {
  return {
    solved: e.solved,
    timeLimitSec: e.timeLimitSec,
    timeUsedSec: e.timeUsedSec,
    hintsUsed: e.hintsUsed,
    // Tier-at-play freeze (T16 coupling rule): score from the difficulty the player
    // actually faced, never a later re-calibrated value.
    wordDifficulty: e.wordRatingAtPlay,
    mode: e.mode,
  };
}

interface Fold {
  score: number;
  streak: number;
  gamesPlayed: number;
}

function fold(events: readonly RoundEvent[]): Fold {
  let score: number = SEED_RATING;
  let streak = 0;
  let gamesPlayed = 0;
  for (const e of events) {
    // Config-versioned replay (PART A §1): each round scores under the config that
    // was live when it was played. `requireConfig` throws UnknownConfigVersionError
    // on an unregistered stamp (F1) — the worker quarantines the batch, never guesses.
    const config = requireConfig(e.engineConfigVersion);
    const update = applyPoints({ rating: score, streak }, eventToRoundResult(e), config);
    score = update.newPlayerRating;
    streak = update.streak;
    gamesPlayed += 1;
  }
  return { score, streak, gamesPlayed };
}

/**
 * The authoritative snapshot for an install. `events` must already be in replay
 * order (store.eventsForReplay guarantees it). Global and per-category folds are
 * independent replays — global is NOT a sum (locked owner decision).
 */
export function computeSnapshot(
  installId: string,
  events: readonly RoundEvent[],
  computedAt: number,
  accountId: string | null = null,
): PlayerSnapshot {
  const scored = events.filter(isPointsEra);

  const topics = [...new Set(scored.map((e) => e.topic))].sort();
  const categories: CategoryScore[] = topics.map((topic) => {
    const f = fold(scored.filter((e) => e.topic === topic));
    return { topic, score: f.score, streak: f.streak, gamesPlayed: f.gamesPlayed };
  });

  const global = fold(scored);

  return {
    installId,
    accountId,
    engineConfigVersion: ENGINE_CONFIG_VERSION,
    global: { score: global.score, streak: global.streak, gamesPlayed: global.gamesPlayed },
    categories,
    totalRounds: events.length,
    computedAt,
  };
}
