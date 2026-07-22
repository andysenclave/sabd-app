/**
 * Profile-hub data — REAL numbers from the on-device event log, derived by the same
 * points engine the score is (never a second source of truth). All derivations are
 * pure functions over `RoundEvent[]` so they're unit-tested; `loadProfile()` is the
 * only db-touching part, web-guarded with representative sample data so the browser
 * preview shows a populated layout (device has the real thing).
 *
 * Each round is scored under ITS OWN config (config-versioned replay, PART A §1), so
 * the climb series and earnings match a full replay exactly.
 */

import type { RoundEvent, TopicId } from '@sabd/contracts';
import { BANK_TOPICS, SEED_RATING } from '@sabd/contracts';
import { applyPoints, requireConfig, type ScoreBreakdown } from '@sabd/elo';
import { eventToRoundResult } from '@sabd/storage';
import { themedHues } from '../theme/themed/themedTokens.ts';

const DAY_MS = 86_400_000;

export interface CategoryDatum {
  id: TopicId;
  name: string;
  bankTopic: string;
  score: number;
  streak: number;
  rounds: number;
  solved: number;
  solvePct: number;
  /** Points gained in the last 7 days (monotonic score is scale-independent). */
  gain7d: number;
}

export interface GapDatum {
  /** The weakest PLAYED category — the invitation, not a scold. */
  id: TopicId;
  /** Points to reach the next category up. */
  toPass: number;
  /** Name of the category just above. */
  passName: string;
}

export interface ProfileData {
  total: number;
  globalStreak: number;
  daysPlayed: number;
  /** Categories sorted strong → building. */
  categories: CategoryDatum[];
  /** Present when ≥2 categories are played and the weakest trails another. */
  gap: GapDatum | null;
}

const NAMES: Record<TopicId, string> = {
  gaming: 'GAMING',
  space: 'SPACE & SCI-FI',
  music: 'MUSIC',
  internet: 'INTERNET & TECH',
  food: 'FOOD & DRINK',
  world: 'WORLD & PLACES',
};

/** Fold a topic's events (replay order) into its running score, capturing the series. */
export function climbSeries(events: readonly RoundEvent[]): number[] {
  const ordered = orderForReplay(events);
  const series: number[] = [SEED_RATING];
  let rating: number = SEED_RATING;
  let streak = 0;
  for (const e of ordered) {
    const u = applyPoints({ rating, streak }, eventToRoundResult(e), requireConfig(e.engineConfigVersion));
    rating = u.newPlayerRating;
    streak = u.streak;
    series.push(rating);
  }
  return series;
}

/** The score a topic held as of `cutoff` (events strictly before it). */
function scoreAsOf(events: readonly RoundEvent[], cutoff: number): number {
  return foldFinal(events.filter((e) => e.playedAt < cutoff));
}

function foldFinal(events: readonly RoundEvent[]): number {
  let rating: number = SEED_RATING;
  let streak = 0;
  for (const e of orderForReplay(events)) {
    const u = applyPoints({ rating, streak }, eventToRoundResult(e), requireConfig(e.engineConfigVersion));
    rating = u.newPlayerRating;
    streak = u.streak;
  }
  return rating;
}

/** Deterministic replay order: playedAt, tie-break roundId (matches the engine). */
export function orderForReplay(events: readonly RoundEvent[]): RoundEvent[] {
  return [...events].sort((a, b) => a.playedAt - b.playedAt || (a.roundId < b.roundId ? -1 : 1));
}

/** Distinct calendar days that carry at least one round. */
export function daysPlayed(events: readonly RoundEvent[]): number {
  return new Set(events.map((e) => Math.floor(e.playedAt / DAY_MS))).size;
}

/** One recent round, its points split into the chips the Rewards feed shows. */
export interface Earning {
  roundId: string;
  wordId: string;
  topic: string;
  id: TopicId | null;
  playedAt: number;
  total: number;
  breakdown: ScoreBreakdown;
}

/** The most recent `n` SOLVED rounds with their component breakdown (Rewards feed). */
export function recentEarnings(events: readonly RoundEvent[], n: number): Earning[] {
  const solved = orderForReplay(events).filter((e) => e.solved);
  // Streak-dependent bonus needs the running streak, so fold forward capturing each.
  const out: Earning[] = [];
  let streak = 0;
  let rating: number = SEED_RATING;
  for (const e of orderForReplay(events)) {
    const u = applyPoints({ rating, streak }, eventToRoundResult(e), requireConfig(e.engineConfigVersion));
    if (e.solved) {
      out.push({
        roundId: e.roundId,
        wordId: e.wordId,
        topic: e.topic,
        id: topicIdOf(e.topic),
        playedAt: e.playedAt,
        total: u.delta,
        breakdown: u.breakdown,
      });
    }
    rating = u.newPlayerRating;
    streak = u.streak;
  }
  void solved;
  return out.slice(-n).reverse();
}

function topicIdOf(bankTopic: string): TopicId | null {
  for (const id of Object.keys(BANK_TOPICS) as TopicId[]) {
    if (BANK_TOPICS[id] === bankTopic) return id;
  }
  return null;
}

/**
 * Build the whole profile from the post-epoch event log + the cached global totals
 * (the global score/streak are an independent replay, not a sum — kept authoritative
 * from the cache the storage layer maintains).
 */
export function buildProfile(
  events: readonly RoundEvent[],
  global: { total: number; streak: number },
  now: number,
): ProfileData {
  const cutoff7d = now - 7 * DAY_MS;
  const cats: CategoryDatum[] = (Object.keys(BANK_TOPICS) as TopicId[]).map((id) => {
    const bankTopic = BANK_TOPICS[id];
    const topicEvents = events.filter((e) => e.topic === bankTopic);
    const series = climbSeries(topicEvents);
    const score = series[series.length - 1] ?? 0;
    const rounds = topicEvents.length;
    const solved = topicEvents.filter((e) => e.solved).length;
    return {
      id,
      name: NAMES[id],
      bankTopic,
      score,
      streak: trailingStreak(topicEvents),
      rounds,
      solved,
      solvePct: rounds > 0 ? Math.round((solved / rounds) * 100) : 0,
      gain7d: score - scoreAsOf(topicEvents, cutoff7d),
    };
  });

  cats.sort((a, b) => b.score - a.score);

  return {
    total: global.total,
    globalStreak: global.streak,
    daysPlayed: daysPlayed(events),
    categories: cats,
    gap: computeGap(cats),
  };
}

/** The live trailing streak of a topic (consecutive solves at the tail). */
function trailingStreak(events: readonly RoundEvent[]): number {
  const ordered = orderForReplay(events);
  let streak = 0;
  for (const e of ordered) streak = e.solved ? streak + 1 : 0;
  return streak;
}

/** The weakest PLAYED category and what it needs to pass the next one up. */
export function computeGap(sortedDesc: readonly CategoryDatum[]): GapDatum | null {
  const played = sortedDesc.filter((c) => c.rounds > 0);
  if (played.length < 2) return null;
  const weakest = played[played.length - 1]!;
  const above = played[played.length - 2]!;
  const toPass = above.score - weakest.score;
  if (toPass <= 0) return null;
  return { id: weakest.id, toPass, passName: shortName(above.id) };
}

function shortName(id: TopicId): string {
  return { gaming: 'Gaming', space: 'Space', music: 'Music', internet: 'Internet', food: 'Food', world: 'World' }[id];
}

// ─── 13b · category detail ────────────────────────────────────────────────────

export interface CategoryDetail {
  id: TopicId;
  name: string;
  score: number;
  games: number;
  solvePct: number;
  streak: number;
  bestStreak: number;
  /** Cumulative score per round, starting at 0 (the monotonic climb). */
  series: number[];
  /** Round indices to ring as milestones (tier crossings / best-streak peaks). */
  milestones: number[];
  /** Versus record — Phase 5; zeroed until 1v1 ships. */
  versus: { wins: number; losses: number; last5: boolean[] } | null;
}

/** One category's full detail, folded from its post-epoch events. */
export function buildCategoryDetail(id: TopicId, allEvents: readonly RoundEvent[]): CategoryDetail {
  const bankTopic = BANK_TOPICS[id];
  const events = orderForReplay(allEvents.filter((e) => e.topic === bankTopic));
  const series = climbSeries(events);
  const games = events.length;
  const solved = events.filter((e) => e.solved).length;
  return {
    id,
    name: NAMES[id],
    score: series[series.length - 1] ?? 0,
    games,
    solvePct: games > 0 ? Math.round((solved / games) * 100) : 0,
    streak: trailingStreak(events),
    bestStreak: bestStreak(events),
    series,
    milestones: milestoneIndices(events),
    versus: null, // 1v1 is Phase 5
  };
}

/** The longest run of consecutive solves anywhere in the history. */
export function bestStreak(events: readonly RoundEvent[]): number {
  let best = 0;
  let run = 0;
  for (const e of orderForReplay(events)) {
    run = e.solved ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

/** Round indices where a tier boundary was crossed (a visible milestone). */
function milestoneIndices(events: readonly RoundEvent[]): number[] {
  const series = climbSeries(events);
  const bands = [50, 150, 350]; // unified tier edges
  const out: number[] = [];
  for (let i = 1; i < series.length; i++) {
    if (bands.some((b) => series[i - 1]! < b && series[i]! >= b)) out.push(i);
  }
  return out;
}

/** Six mini-climbs for the category switcher (each topic's series, thinned). */
export function miniClimbs(allEvents: readonly RoundEvent[]): { id: TopicId; name: string; score: number; series: number[] }[] {
  return (Object.keys(BANK_TOPICS) as TopicId[]).map((id) => {
    const series = climbSeries(allEvents.filter((e) => e.topic === BANK_TOPICS[id]));
    return { id, name: shortName(id).toUpperCase(), score: series[series.length - 1] ?? 0, series: thin(series, 8) };
  });
}

/** Down-sample a series to ~`k` points, always keeping the first and last. */
export function thin(series: number[], k: number): number[] {
  if (series.length <= k) return series.length > 0 ? series : [0];
  const out: number[] = [];
  for (let i = 0; i < k; i++) out.push(series[Math.round((i / (k - 1)) * (series.length - 1))]!);
  return out;
}

export function sampleCategoryDetail(id: TopicId): CategoryDetail {
  const s = sampleProfile().categories.find((c) => c.id === id) ?? sampleProfile().categories[0]!;
  const series = [0, 18, 42, 42, 76, 115, 115, 168, 220, 220, 290, 355, 410, s.score];
  return {
    id, name: NAMES[id], score: s.score, games: s.rounds, solvePct: s.solvePct,
    streak: s.streak, bestStreak: Math.max(s.streak, 12), series, milestones: [2, 7, 10],
    versus: id === 'gaming' ? { wins: 34, losses: 11, last5: [true, true, false, true, true] } : null,
  };
}

export function sampleMinis(): { id: TopicId; name: string; score: number; series: number[] }[] {
  return sampleProfile().categories.map((c) => ({
    id: c.id, name: shortName(c.id).toUpperCase(), score: c.score,
    series: thin([0, c.score * 0.15, c.score * 0.4, c.score * 0.6, c.score * 0.8, c.score], 6),
  }));
}

export function sampleRewards(): RewardsData {
  const earnings: Earning[] = [
    { roundId: 'r1', wordId: 'GAM-x', topic: BANK_TOPICS.gaming, id: 'gaming', playedAt: 0, total: 47,
      breakdown: { tierBase: 20, speedBonus: 9, hintPenalty: 0, streakBonus: 18 } },
    { roundId: 'r2', wordId: 'NET-x', topic: BANK_TOPICS.internet, id: 'internet', playedAt: 0, total: 28,
      breakdown: { tierBase: 20, speedBonus: 8, hintPenalty: 0, streakBonus: 0 } },
    { roundId: 'r3', wordId: 'MUS-x', topic: BANK_TOPICS.music, id: 'music', playedAt: 0, total: 16,
      breakdown: { tierBase: 10, speedBonus: 6, hintPenalty: -8, streakBonus: 8 } },
  ];
  const achievements = ACHIEVEMENTS.map((a, i) => ({ ...a, unlocked: i < 6 }));
  return {
    streak: streakMilestone(7),
    earnings,
    achievements,
    unlockedCount: achievements.filter((a) => a.unlocked).length,
    totalCount: achievements.length,
  };
}

export function sampleLeaderboard(): LeaderboardData {
  return {
    you: { rank: 24, total: 8412, score: 1747, delta: 2 },
    top: [
      { rank: 1, name: '@wordsmith_ka', score: 41220 },
      { rank: 2, name: '@lex_prime', score: 38905 },
      { rank: 3, name: '@riddle_ras', score: 35610 },
      { rank: 4, name: '@aanya_p', score: 33140 },
      { rank: 5, name: '@thekite', score: 31980 },
    ],
    neighbors: [
      { rank: 23, name: '@tanvi_04', score: 1798 },
      { rank: 24, name: '@you', score: 1747, isYou: true },
      { rank: 25, name: '@deepc', score: 1624 },
    ],
    yourScore: 1747,
  };
}

// ─── 13c · rewards ────────────────────────────────────────────────────────────

/** Global-streak badge ladder (days). */
export const STREAK_BADGES = [3, 5, 7, 10, 14, 21, 30, 60, 100];

export interface StreakMilestone {
  current: number;
  next: number | null;
  /** Progress to the next badge, 0–1. */
  pct: number;
  copy: string;
}

export function streakMilestone(streak: number): StreakMilestone {
  const next = STREAK_BADGES.find((b) => b > streak) ?? null;
  if (next === null) return { current: streak, next: null, pct: 1, copy: 'every badge earned — you set the pace now.' };
  // Absolute progress toward the next badge (streak 7 of 10 → 70%), matching the mockup.
  const pct = streak / next;
  const left = next - streak;
  return { current: streak, next, pct, copy: `${left} more ${left === 1 ? 'day' : 'days'} and the ${next}-day badge is yours.` };
}

export interface RewardsData {
  streak: StreakMilestone;
  earnings: Earning[];
  achievements: { icon: string; title: string; hue: number | null; unlocked: boolean }[];
  unlockedCount: number;
  totalCount: number;
}

/** The achievement roster (placeholder thresholds — architect FB-006, content-owned). */
export const ACHIEVEMENTS: { icon: string; title: string; hue: number | null }[] = [
  { icon: '◆', title: 'First Word', hue: null },
  { icon: '▲', title: '100 Club · Gaming', hue: themedHues.gaming },
  { icon: '◈', title: 'Speed Demon <15s', hue: themedHues.internet },
  { icon: '⚔', title: 'Duelist · 25W', hue: themedHues.music },
  { icon: '⬡', title: 'Polyglot · all 6', hue: themedHues.world },
  { icon: '●', title: 'Marathon · 60d', hue: null },
  { icon: '◇', title: 'Hot Streak ×10', hue: null },
  { icon: '△', title: '500 Master', hue: null },
  { icon: '◌', title: 'Night Owl', hue: null },
];

// ─── 13d · leaderboard ──────────────────────────────────────────────────────

export interface LeaderRow {
  rank: number;
  name: string;
  score: number;
  isYou?: boolean;
}
export interface LeaderboardData {
  /** Null until a ranking backend + handle exist (FB-007) — renders the guest state. */
  you: { rank: number; total: number; score: number; delta: number | null } | null;
  top: LeaderRow[];
  neighbors: LeaderRow[];
  yourScore: number;
}

// ─── Sample data for the web preview (device shows the real log) ──────────────

export function sampleProfile(): ProfileData {
  const cats: CategoryDatum[] = [
    { id: 'gaming', name: NAMES.gaming, bankTopic: BANK_TOPICS.gaming, score: 482, streak: 7, rounds: 143, solved: 126, solvePct: 88, gain7d: 34 },
    { id: 'internet', name: NAMES.internet, bankTopic: BANK_TOPICS.internet, score: 376, streak: 5, rounds: 120, solved: 100, solvePct: 83, gain7d: 28 },
    { id: 'space', name: NAMES.space, bankTopic: BANK_TOPICS.space, score: 311, streak: 3, rounds: 98, solved: 77, solvePct: 79, gain7d: 19 },
    { id: 'music', name: NAMES.music, bankTopic: BANK_TOPICS.music, score: 244, streak: 0, rounds: 84, solved: 62, solvePct: 74, gain7d: 12 },
    { id: 'world', name: NAMES.world, bankTopic: BANK_TOPICS.world, score: 205, streak: 1, rounds: 71, solved: 50, solvePct: 71, gain7d: 9 },
    { id: 'food', name: NAMES.food, bankTopic: BANK_TOPICS.food, score: 129, streak: 2, rounds: 52, solved: 33, solvePct: 63, gain7d: 6 },
  ];
  return { total: 1747, globalStreak: 7, daysPlayed: 64, categories: cats, gap: computeGap(cats) };
}
