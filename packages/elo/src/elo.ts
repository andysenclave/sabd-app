/**
 * Sabd rating engine — Elo math (§3.1, §3.3, §3.4, §3.5, §4 of the design doc).
 * Pure, deterministic functions. No I/O, no globals, no Date.now(), no randomness.
 */

import { defaultConfig, type EloConfig } from './config.ts';
import { computePerformance } from './performance.ts';
import type { RatingUpdate, RoundResult } from './types.ts';

/** Player state — authoritative rating/games for applyResult. */
export interface PlayerState {
  rating: number;
  gamesPlayed: number;
}

/**
 * §3.1 — Expected score (standard Elo):
 *   E = 1 / (1 + 10 ^ ((opponentRating - playerRating) / 400))
 */
export function expectedScore(
  playerRating: number,
  opponentRating: number,
  config: EloConfig = defaultConfig,
): number {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / config.eloDivisor));
}

/**
 * §3.3 — K-factor (volatility):
 *   gamesPlayed < 30  ⇒ K = 40   (provisional)
 *   rating < 2000     ⇒ K = 32
 *   rating >= 2000    ⇒ K = 24
 */
export function kFactor(
  rating: number,
  gamesPlayed: number,
  config: EloConfig = defaultConfig,
): number {
  if (gamesPlayed < config.provisionalGames) return config.kProvisional;
  if (rating < config.highRatedThreshold) return config.kStandard;
  return config.kHighRated;
}

/**
 * §3.4 + §4 — Apply a round result to the player's rating.
 *
 *   delta           = round(K * (s - E))
 *   challenge mode  : gains only ⇒ delta = round(delta * challengeMultiplier)
 *   newPlayerRating = max(ratingFloor, playerRating + delta)
 *
 * `playerState` is authoritative for rating/gamesPlayed; the copies inside
 * `result` are carried by the shared contract for the game loop's convenience.
 */
export function applyResult(
  playerState: PlayerState,
  result: RoundResult,
  config: EloConfig = defaultConfig,
): RatingUpdate {
  const { s, breakdown } = computePerformance(result, config);
  const expected = expectedScore(playerState.rating, result.opponentRating, config);
  const k = kFactor(playerState.rating, playerState.gamesPlayed, config);

  let delta = Math.round(k * (s - expected));

  // §4 — challenge modifier applies to GAINS ONLY (real risk: losses stay full).
  if (result.challengeMode && delta > 0) {
    delta = Math.round(delta * config.challengeMultiplier);
  }

  const newPlayerRating = Math.max(config.ratingFloor, playerState.rating + delta);

  return {
    performance: s,
    expected,
    delta,
    newPlayerRating,
    kFactor: k,
    breakdown,
  };
}

/** Output of the Phase-2 word-rating self-correction. */
export interface WordRatingUpdate {
  newWordRating: number;
  delta: number;
  /** Expected score from the WORD's perspective. */
  expected: number;
  kFactor: number;
  /** True when the update actually ran (config.wordRatingUpdatesEnabled). */
  applied: boolean;
}

/**
 * §3.5 — Word rating self-correction (PHASE 2 — off by default).
 *
 * Same Elo formula from the word's side with small K = 16 and
 * wordResult = 1 - s. Pure; gated behind `config.wordRatingUpdatesEnabled`
 * (default false) — when disabled it returns the word rating unchanged with
 * `applied: false`. The server decides when to persist.
 */
export function updateWordRating(
  wordRating: number,
  playerRating: number,
  playerPerformance: number,
  config: EloConfig = defaultConfig,
): WordRatingUpdate {
  const expected = expectedScore(wordRating, playerRating, config);

  if (!config.wordRatingUpdatesEnabled) {
    return {
      newWordRating: wordRating,
      delta: 0,
      expected,
      kFactor: config.wordK,
      applied: false,
    };
  }

  const wordResult = 1 - playerPerformance;
  const delta = Math.round(config.wordK * (wordResult - expected));
  const newWordRating = Math.max(config.ratingFloor, wordRating + delta);

  return { newWordRating, delta, expected, kFactor: config.wordK, applied: true };
}
