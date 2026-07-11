/**
 * Word selection — T11-LITE. The ±150 rating window with step-widening is real;
 * what T11 still owes: `seenIds` PERSISTED across sessions (needs a small table)
 * and the graceful topic-exhausted UX + property tests. Session-scoped memory here.
 */

import type { WordEntry } from '@sabd/contracts';
import { words } from '@sabd/wordbank';

const WINDOW_STEP = 150;

/** Words already served this session — no repeats (Part-A rule). */
const sessionSeen = new Set<string>();

export function selectWord(rating: number, topic?: string): WordEntry | null {
  const pool = words.filter(
    (w) => (topic === undefined || w.topic === topic) && !sessionSeen.has(w.id),
  );
  if (pool.length === 0) return null; // topic exhausted — caller shows the graceful state

  // Widen ±150 in steps until the window catches something; never crash.
  for (let window = WINDOW_STEP; ; window += WINDOW_STEP) {
    const inWindow = pool.filter((w) => Math.abs(w.difficulty - rating) <= window);
    if (inWindow.length > 0) {
      // Nearest-difficulty within the window, stable by id.
      inWindow.sort(
        (a, b) =>
          Math.abs(a.difficulty - rating) - Math.abs(b.difficulty - rating) ||
          a.id.localeCompare(b.id),
      );
      const chosen = inWindow[0]!;
      sessionSeen.add(chosen.id);
      return chosen;
    }
  }
}

/** For tests/debug. */
export function resetSessionSeen(): void {
  sessionSeen.clear();
}
