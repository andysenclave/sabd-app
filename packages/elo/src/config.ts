/**
 * Sabd scoring engine — the config REGISTRY (single source of truth for tunables).
 *
 * The score is a monotonic point total: a solve awards points (never negative), a miss
 * awards nothing and breaks the streak. Every weight/band lives in a versioned config.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 4, PART A §1 — CONFIG-VERSIONED REPLAY (the load-bearing rule)
 * ─────────────────────────────────────────────────────────────────────────────
 * The score is derived by replaying the event log. Replay re-derives a word's tier
 * from its stored `wordRatingAtPlay`, then pays from that tier. So editing a shipped
 * config would make every past round replay differently — silently changing every
 * player's total.
 *
 *   A shipped engine config is IMMUTABLE. You never edit an entry in CONFIGS — you
 *   publish a NEW version. Replay looks up the config by the event's
 *   `engineConfigVersion` and scores that round under *those* rules.
 *
 * Each config carries its OWN `scale` AND its OWN tier bands. This is load-bearing:
 * `wordRatingAtPlay` on a 2.0.0 event is an old-scale number (e.g. 1380) banded by
 * 2.0.0's bands; a 3.0.0 event's is new-scale (e.g. 220) banded by 3.0.0's. A replay
 * that applies new bands to old-scale numbers corrupts every historical round.
 */

import type { WordTier } from './types.ts';

/**
 * One difficulty tier within a config, fully self-describing so a config's tier
 * vocabulary is not tied to the global `WordTier` union (3.0.0 has four tiers with
 * different names than 2.0.0). Bands are listed ascending by `maxRating`.
 */
export interface TierBand {
  /** Config-local tier name (e.g. 'low' in 2.0.0, 'veryEasy' in 3.0.0). */
  readonly tier: string;
  /** Inclusive upper *difficulty* bound for this tier; the top band uses Infinity. */
  readonly maxRating: number;
  /** Base points a solve of this tier awards (before speed/hints/streak). */
  readonly base: number;
  /**
   * Serve this tier to a player scoring *below* this value; the top band uses
   * Infinity. On the unified 3.0.0 scale this equals `maxRating` (difficulty speaks
   * the player's language); on the 2.0.0 fossil scale the two differ.
   */
  readonly serveBelow: number;
}

export interface PointsConfig {
  /** The version stamp this config is registered under (matches its CONFIGS key). */
  readonly version: string;
  /**
   * Which number system this config's ratings live in. `elo-legacy` = the retired
   * 800–2200 Elo scale; `unified` = 0–500+, the same units as the player score.
   */
  readonly scale: 'elo-legacy' | 'unified';
  /**
   * Difficulty/score tier bands, ascending by `maxRating`. Replaces the former
   * `tierBase` + `tierBands` + `tierThresholds` triple — one self-describing list so
   * a config can carry any number of tiers under any names.
   */
  readonly bands: readonly TierBand[];

  /** Max extra points for an instant solve; scales down to 0 as the clock is used. */
  readonly speedBonusMax: number;
  /** Points deducted per PAID hint used (max 2 paid hints). */
  readonly hintPenaltyPerHint: number;
  /** A solve never awards fewer than this (before the streak bonus is added). */
  readonly minSolvePoints: number;

  /** Extra points added per consecutive solve: bonus = streakStep * (streak - 1). */
  readonly streakStep: number;
  /** Cap on the per-round streak bonus so a long streak can't run away. */
  readonly streakBonusMax: number;
}

/**
 * ─── 2.0.0 — the points engine on the legacy Elo difficulty scale ────────────
 * Replaced the Elo rating engine with the monotonic points engine (seed 0, streak
 * bonus, tier-gated difficulty). Word difficulty is the fossil 800–2200 scale; the
 * player score climbs from 0. The two are bridged only by the tier lookup below.
 * FROZEN — never edit a value here; publish a new version instead.
 */
export const CONFIG_2_0_0: PointsConfig = Object.freeze({
  version: '2.0.0',
  scale: 'elo-legacy',
  bands: Object.freeze([
    Object.freeze({ tier: 'low', maxRating: 1200, base: 10, serveBelow: 100 }),
    Object.freeze({ tier: 'mid', maxRating: 1600, base: 20, serveBelow: 300 }),
    Object.freeze({ tier: 'high', maxRating: Infinity, base: 30, serveBelow: Infinity }),
  ]),
  speedBonusMax: 10,
  hintPenaltyPerHint: 3,
  minSolvePoints: 5,
  streakStep: 2,
  streakBonusMax: 20,
});

/**
 * ─── 3.0.0 — the unified scale (Phase 4, PART A §2) ──────────────────────────
 * Word difficulty is re-scaled to 0–500+ so a word's difficulty MEANS "the player
 * score this word suits" — `serveBelow` equals `maxRating`. A new tier `veryEasy`
 * greets score-0 players (the cold-start fix). FROZEN once shipped.
 *
 * NOT YET the active config: `ENGINE_CONFIG_VERSION` stays 2.0.0 until the bank is
 * re-scaled and the `veryEasy` tier is stocked (Phase 4 Lane 2 + edge-case F7).
 * Registered now so replay can already score 3.0.0 events written by ahead devices.
 */
export const CONFIG_3_0_0: PointsConfig = Object.freeze({
  version: '3.0.0',
  scale: 'unified',
  bands: Object.freeze([
    Object.freeze({ tier: 'veryEasy', maxRating: 50, base: 5, serveBelow: 50 }),
    Object.freeze({ tier: 'easy', maxRating: 150, base: 10, serveBelow: 150 }),
    Object.freeze({ tier: 'medium', maxRating: 350, base: 20, serveBelow: 350 }),
    Object.freeze({ tier: 'hard', maxRating: Infinity, base: 30, serveBelow: Infinity }),
  ]),
  speedBonusMax: 10,
  hintPenaltyPerHint: 3,
  minSolvePoints: 5,
  streakStep: 2,
  streakBonusMax: 20,
});

/**
 * The immutable config registry. Keyed by version stamp. **Append only — never
 * mutate an existing entry** (PART A §1). Replay resolves the rules that were live
 * when a round was played by looking its version up here.
 */
export const CONFIGS: Readonly<Record<string, PointsConfig>> = Object.freeze({
  '2.0.0': CONFIG_2_0_0,
  '3.0.0': CONFIG_3_0_0,
});

/**
 * Version stamp NEW round_events are written under. BUMP only when flipping the
 * active config (a gated, deliberate step — see CONFIG_3_0_0's note, F7).
 */
export const ENGINE_CONFIG_VERSION = '2.0.0';

/** The config new events are scored under — always the `ENGINE_CONFIG_VERSION` entry. */
export const defaultConfig: PointsConfig = CONFIG_2_0_0;

/**
 * Thrown when replay meets an `engineConfigVersion` that has no registered config
 * (a device ahead of the server after an OTA, or a corrupted stamp — edge-case F1).
 * Replay must fail loudly and quarantine the batch rather than guess a config or
 * skip the round (a skipped round changes the total invisibly).
 */
export class UnknownConfigVersionError extends Error {
  readonly version: string;
  constructor(version: string) {
    super(
      `unknown engineConfigVersion "${version}" — no registered scoring config. ` +
        `Refusing to guess (a wrong config silently corrupts the score).`,
    );
    this.name = 'UnknownConfigVersionError';
    this.version = version;
  }
}

/** The config a version was played under, or `undefined` if unregistered. */
export function configForVersion(version: string): PointsConfig | undefined {
  return CONFIGS[version];
}

/** Like {@link configForVersion} but throws {@link UnknownConfigVersionError} (F1). */
export function requireConfig(version: string): PointsConfig {
  const cfg = CONFIGS[version];
  if (!cfg) throw new UnknownConfigVersionError(version);
  return cfg;
}

/**
 * True when an event's `engineConfigVersion` belongs to the points era (major ≥ 2).
 * The 2026-07 scoring reset coincides exactly with engine 2.0.0, so "does this event
 * fold into a score" is derivable from data already in the event — Elo-era (1.x)
 * events stay on disk/server for calibration but are never scored. Used by the
 * client restore path and the server replay identically.
 */
export function isPointsEraConfig(version: string): boolean {
  const major = Number.parseInt(version, 10);
  return Number.isFinite(major) && major >= 2;
}

/** Re-export so `WordTier` is importable from the config module too. */
export type { WordTier };
