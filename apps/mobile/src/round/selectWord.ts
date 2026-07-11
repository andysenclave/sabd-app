/**
 * Word selection (T11) — ±150 rating window, widening in steps, with a RANDOM pick
 * inside the window. Randomness matters: a deterministic nearest-difficulty pick
 * gives every player the identical word sequence, which makes the game predictable
 * (and trivially spoilable between friends). Selection is not rating math — replay
 * never re-selects — so Math.random is fine here (injectable for tests).
 *
 * Exclusions come from two layers:
 *  - `exclude`: word ids this install has EVER faced — derived from the event log
 *    (playedWordIds), i.e. the persisted seenIds. Survives restarts for free.
 *  - a session-scoped set covering rounds not yet in the log (e.g. the web harness,
 *    or a round abandoned before recording).
 */

import type { WordEntry } from '@sabd/contracts';
import { words } from '@sabd/wordbank';

const WINDOW_STEP = 150;

/** Words served this session (belt for what the log doesn't have yet). */
const sessionSeen = new Set<string>();

export interface SelectWordOptions {
  rating: number;
  /** Bank topic display string (e.g. "Gaming"). Omit = any topic. */
  topic?: string;
  /** Persisted seen ids (from the event log). */
  exclude?: ReadonlySet<string>;
  /** Injectable for tests. Returns [0,1). */
  rng?: () => number;
}

export function selectWord({
  rating,
  topic,
  exclude,
  rng = Math.random,
}: SelectWordOptions): WordEntry | null {
  const pool = words.filter(
    (w) =>
      (topic === undefined || w.topic === topic) &&
      !sessionSeen.has(w.id) &&
      !(exclude?.has(w.id) ?? false),
  );
  if (pool.length === 0) return null; // topic exhausted — caller shows the graceful state

  // Widen ±150 in steps until the window catches something; never crash.
  for (let window = WINDOW_STEP; ; window += WINDOW_STEP) {
    const inWindow = pool.filter((w) => Math.abs(w.difficulty - rating) <= window);
    if (inWindow.length > 0) {
      const chosen = inWindow[Math.floor(rng() * inWindow.length)]!;
      sessionSeen.add(chosen.id);
      return chosen;
    }
  }
}

/** Bank topics that actually have words (drives which Home cards are playable). */
export function availableBankTopics(): ReadonlySet<string> {
  return new Set(words.map((w) => w.topic));
}

/** For tests/debug. */
export function resetSessionSeen(): void {
  sessionSeen.clear();
}
