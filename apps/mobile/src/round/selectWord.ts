/**
 * Word selection (T11) — difficulty follows the player's SCORE. The higher your score
 * in a topic, the harder the tier of word it serves (`tierForScore`); because the score
 * only ever climbs, the difficulty you've reached never regresses — a broken streak
 * costs you the bonus, not your level. A RANDOM pick inside the chosen tier keeps the
 * word sequence from being identical (and spoilable) between players.
 *
 * Selection is not scoring math — replay never re-selects — so Math.random is fine here
 * (injectable for tests).
 *
 * Exclusions come from two layers:
 *  - `exclude`: word ids this install has EVER faced — derived from the event log
 *    (playedWordIds), i.e. the persisted seenIds. Survives restarts for free.
 *  - a session-scoped set covering rounds not yet in the log (e.g. the web harness,
 *    or a round abandoned before recording).
 */

import type { WordEntry, WordTier } from '@sabd/contracts';
import { tierForScore } from '@sabd/elo';
// The LIVE bank (T10): bundled words with downloaded slices layered per (topic × tier).
// Offline/fresh installs see exactly the bundled bank.
import { bankWords, bankTopics } from '../bank/liveBank.ts';

/**
 * When the target tier is exhausted (all its words seen), spill to the nearest tier —
 * an easier already-mastered one before a harder unearned one.
 */
const TIER_FALLBACK: Record<WordTier, WordTier[]> = {
  low: ['low', 'mid', 'high'],
  mid: ['mid', 'low', 'high'],
  high: ['high', 'mid', 'low'],
};

/** Words served this session (belt for what the log doesn't have yet). */
const sessionSeen = new Set<string>();

export interface SelectWordOptions {
  /** The player's current score in this topic — drives the difficulty tier served. */
  score: number;
  /** Bank topic display string (e.g. "Gaming"). Omit = any topic. */
  topic?: string;
  /** Persisted seen ids (from the event log). */
  exclude?: ReadonlySet<string>;
  /** Injectable for tests. Returns [0,1). */
  rng?: () => number;
}

export function selectWord({
  score,
  topic,
  exclude,
  rng = Math.random,
}: SelectWordOptions): WordEntry | null {
  const pool = bankWords().filter(
    (w) =>
      (topic === undefined || w.topic === topic) &&
      !sessionSeen.has(w.id) &&
      !(exclude?.has(w.id) ?? false),
  );
  if (pool.length === 0) return null; // topic exhausted — caller shows the graceful state

  // Serve the tier this score has earned; spill to the nearest tier if it's exhausted.
  const targetTier = tierForScore(score);
  for (const tier of TIER_FALLBACK[targetTier]) {
    const candidates = pool.filter((w) => w.tier === tier);
    if (candidates.length > 0) {
      const chosen = candidates[Math.floor(rng() * candidates.length)]!;
      sessionSeen.add(chosen.id);
      return chosen;
    }
  }
  // Pool is non-empty but no word carried a known tier — shouldn't happen; pick anything.
  const chosen = pool[Math.floor(rng() * pool.length)]!;
  sessionSeen.add(chosen.id);
  return chosen;
}

/** Bank topics that actually have words (drives which Home cards are playable). */
export function availableBankTopics(): ReadonlySet<string> {
  return bankTopics();
}

/** For tests/debug. */
export function resetSessionSeen(): void {
  sessionSeen.clear();
}
