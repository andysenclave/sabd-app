/**
 * The one db-touching seam for the profile hub. On web (no on-device SQLite) it
 * returns representative sample data so the browser preview shows a populated layout;
 * on device it reads the real post-epoch event log + cached global totals.
 */

import { Platform } from 'react-native';
import type { RoundEvent, TopicId } from '@sabd/contracts';
import { getPlayer, getRoundsAfter } from '@sabd/storage';
import { getStorage } from '../storage/db.ts';
import { BANK_TOPICS } from '@sabd/contracts';
import {
  ACHIEVEMENTS,
  buildCategoryDetail,
  buildProfile,
  daysPlayed,
  miniClimbs,
  recentEarnings,
  sampleCategoryDetail,
  sampleLeaderboard,
  sampleMinis,
  sampleProfile,
  sampleRewards,
  streakMilestone,
  type CategoryDetail,
  type LeaderboardData,
  type ProfileData,
  type RewardsData,
} from './data.ts';

/** Post-epoch events (the scored log) — the same set every replay folds. */
export function scoredEvents(): RoundEvent[] {
  if (Platform.OS === 'web') return [];
  const db = getStorage().db;
  const player = getPlayer(db);
  return getRoundsAfter(db, player?.scoreEpochRoundId ?? null);
}

export function loadProfile(now: number): ProfileData {
  if (Platform.OS === 'web') return sampleProfile();
  const db = getStorage().db;
  const player = getPlayer(db);
  return buildProfile(
    getRoundsAfter(db, player?.scoreEpochRoundId ?? null),
    { total: player?.cachedRating ?? 0, streak: player?.cachedStreak ?? 0 },
    now,
  );
}

export function loadCategory(id: TopicId): {
  detail: CategoryDetail;
  minis: { id: TopicId; name: string; score: number; series: number[] }[];
} {
  if (Platform.OS === 'web') return { detail: sampleCategoryDetail(id), minis: sampleMinis() };
  const events = scoredEvents();
  return { detail: buildCategoryDetail(id, events), minis: miniClimbs(events) };
}

export function loadRewards(): RewardsData {
  if (Platform.OS === 'web') return sampleRewards();
  const db = getStorage().db;
  const player = getPlayer(db);
  const events = scoredEvents();
  // Only the replay-derivable achievements are unlocked; the rest of the roster is a
  // placeholder pending the content-owned list + per-badge rule (FB-006).
  const topicsPlayed = new Set(events.map((e) => e.topic));
  const allSix = (Object.values(BANK_TOPICS) as string[]).every((t) => topicsPlayed.has(t));
  const derived: Record<string, boolean> = {
    'First Word': events.some((e) => e.solved),
    'Polyglot · all 6': allSix,
    'Marathon · 60d': daysPlayed(events) >= 60,
  };
  const achievements = ACHIEVEMENTS.map((a) => ({ ...a, unlocked: derived[a.title] ?? false }));
  return {
    streak: streakMilestone(player?.cachedStreak ?? 0),
    earnings: recentEarnings(events, 3),
    achievements,
    unlockedCount: achievements.filter((a) => a.unlocked).length,
    totalCount: achievements.length,
  };
}

export function loadLeaderboard(): LeaderboardData {
  if (Platform.OS === 'web') return sampleLeaderboard();
  // No ranking backend or display handles yet (FB-007) — render the honest guest
  // state: the player's own real score, no board position claimed.
  const player = getPlayer(getStorage().db);
  return { you: null, top: [], neighbors: [], yourScore: player?.cachedRating ?? 0 };
}
