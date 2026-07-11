/**
 * Round state machine (T15) — PURE core. No React, no timers, no Date.now():
 * every transition takes `now` (epoch ms) as an argument, which is what makes the
 * Part-A edge cases unit-testable in Node (backgrounding, hint clamp, rapid taps).
 *
 * The hook (useRound) owns wiring: the Reanimated clock, haptics, and the
 * onRoundEnd seam. Rating math lives in @sabd/elo behind @sabd/storage.recordRound —
 * none of it here.
 *
 * Timing model:
 *   remaining = timeLimit − wallElapsed − hintPenalty      (what the Rekha shows)
 *   timeUsedSec (logged) = wallElapsed, capped at the limit (the contract's
 *   "wall time consumed" — hint costs pressure the clock but are NOT double-counted
 *   into the performance score, which already carries an explicit hint penalty).
 */

import type { PaidHint } from '@sabd/contracts';
import type { GameConfig } from './config.ts';

export type RoundStatus = 'running' | 'solved' | 'timedout';

export interface Cell {
  char: string | null;
  /** Position-hint letter: locked — backspace skips it, typing can't displace it. */
  given: boolean;
}

export interface RoundCore {
  /** Uppercase answer. */
  readonly answer: string;
  status: RoundStatus;
  cells: Cell[];
  hintsUsed: PaidHint[];
  /** Seconds burned by hints. */
  penaltySec: number;
  readonly startedAt: number;
  endedAt: number | null;
  /** Increments on each wrong submit — the UI keys the rail shake off it. */
  wrongGuesses: number;
}

export type KeyInput =
  | { kind: 'letter'; letter: string }
  | { kind: 'backspace' }
  | { kind: 'enter' };

export function createRound(answer: string, startedAt: number): RoundCore {
  const upper = answer.toUpperCase();
  return {
    answer: upper,
    status: 'running',
    cells: Array.from({ length: upper.length }, () => ({ char: null, given: false })),
    hintsUsed: [],
    penaltySec: 0,
    startedAt,
    endedAt: null,
    wrongGuesses: 0,
  };
}

export function remainingSec(core: RoundCore, now: number, config: GameConfig): number {
  const elapsed = (now - core.startedAt) / 1000;
  return Math.max(0, config.timeLimitSec - elapsed - core.penaltySec);
}

/** Wall time consumed (for RoundResult.timeUsedSec), capped at the limit. */
export function timeUsedSec(core: RoundCore, config: GameConfig): number {
  const end = core.endedAt ?? core.startedAt;
  return Math.min(config.timeLimitSec, Math.max(0, (end - core.startedAt) / 1000));
}

function endRound(core: RoundCore, status: 'solved' | 'timedout', now: number): RoundCore {
  return { ...core, status, endedAt: now };
}

/**
 * The clock authority: called on every tick, on resume from background, and before
 * any input is honored. If wall time (plus hint penalties) has consumed the limit,
 * the round timed out — even if it happened while the app was away. Never pauses.
 */
export function expireIfDue(core: RoundCore, now: number, config: GameConfig): RoundCore {
  if (core.status !== 'running') return core;
  if (remainingSec(core, now, config) > 0) return core;
  return endRound(core, 'timedout', now);
}

/** Keyboard input. Locked (no-op) the moment status leaves 'running'. */
export function pressKey(
  core: RoundCore,
  input: KeyInput,
  now: number,
  config: GameConfig,
): RoundCore {
  const c = expireIfDue(core, now, config);
  if (c.status !== 'running') return c; // input lock: solve ceremony, timeout, spam-submit

  switch (input.kind) {
    case 'letter': {
      const i = c.cells.findIndex((cell) => cell.char === null);
      if (i === -1) return c; // row full
      const cells = c.cells.slice();
      cells[i] = { char: input.letter.toUpperCase(), given: false };
      return { ...c, cells };
    }
    case 'backspace': {
      // Erase the LAST non-given letter — locked (given) slots are skipped over.
      for (let i = c.cells.length - 1; i >= 0; i--) {
        const cell = c.cells[i]!;
        if (cell.char !== null && !cell.given) {
          const cells = c.cells.slice();
          cells[i] = { char: null, given: false };
          return { ...c, cells };
        }
      }
      return c;
    }
    case 'enter': {
      if (c.cells.some((cell) => cell.char === null)) return c; // incomplete — ignore
      const guess = c.cells.map((cell) => cell.char).join('');
      if (guess === c.answer) return endRound(c, 'solved', now);
      // Wrong: the rail flinches (UI), typed letters clear for a fast retype;
      // given letters stay locked in place.
      const cells = c.cells.map((cell) => (cell.given ? cell : { char: null, given: false }));
      return { ...c, cells, wrongGuesses: c.wrongGuesses + 1 };
    }
  }
}

/**
 * A paid hint. Single-use (a repeat tap is a no-op — the UI also disables the button
 * on first press). Cost comes off the clock; if the cost meets or exceeds what's
 * left, remaining clamps to zero and the round ends timedout (Part-A rule).
 */
export function applyHint(
  core: RoundCore,
  hint: PaidHint,
  now: number,
  config: GameConfig,
): RoundCore {
  const c = expireIfDue(core, now, config);
  if (c.status !== 'running') return c;
  if (c.hintsUsed.includes(hint)) return c; // single-use, idempotent under rapid taps

  const cost = config.hintCostSec[hint];
  const next: RoundCore = {
    ...c,
    hintsUsed: [...c.hintsUsed, hint],
    penaltySec: c.penaltySec + cost,
  };

  if (hint === 'position') {
    // Reveal is applied by the caller via revealPosition (it owns the letter/index);
    // cost + single-use bookkeeping happen here regardless.
  }

  // Clamp rule: cost ≥ remaining ⇒ the round is over, timedout.
  if (remainingSec(next, now, config) <= 0) return endRound(next, 'timedout', now);
  return next;
}

/**
 * Lock the position-hint letter into its slot. The lock WINS over any letter the
 * player already typed there — the slot becomes 'given', no duplicate glyph.
 */
export function revealPosition(core: RoundCore, index: number, letter: string): RoundCore {
  if (index < 0 || index >= core.cells.length) return core;
  const cells = core.cells.slice();
  cells[index] = { char: letter.toUpperCase(), given: true };
  return { ...core, cells };
}
