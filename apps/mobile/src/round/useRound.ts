/**
 * useRound (T15) — wires the pure round machine to the world: the Rekha clock,
 * haptics, background/resume reconciliation, and the single onRoundEnd seam.
 *
 * The machine decides; this hook schedules. Rating math lives behind the seam
 * (@sabd/storage.recordRound → @sabd/elo) — none of it here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AccessibilityInfo } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { PaidHint, RoundResult, WordEntry } from '@sabd/contracts';

import { gameConfig } from './config.ts';
import {
  applyHint as machineApplyHint,
  createRound,
  expireIfDue,
  pressKey,
  revealPosition,
  timeUsedSec,
  type KeyInput,
  type RoundCore,
} from './roundMachine.ts';
import { useRoundClock, formatClock } from './useRoundClock.ts';
import { useReducedMotion } from '../a11y/useReducedMotion.ts';
import type { KeyValue, SlotModel } from './types.ts';

export interface RoundEndSummary {
  result: RoundResult2;
  /** Wall-vs-monotonic clocks disagreed beyond tolerance (device clock manipulation). */
  anomaly: boolean;
  /** Ended via `abandon()` (back gesture), not a natural clock expiry — the caller
   * should record it as a rated timeout but never reveal the word for it. */
  abandoned: boolean;
}

/** RoundResult minus the player fields the storage seam fills in from the cache. */
export type RoundResult2 = Pick<
  RoundResult,
  'solved' | 'timeLimitSec' | 'timeUsedSec' | 'hintsUsed' | 'mode'
>;

export interface UseRoundOptions {
  word: WordEntry;
  hapticsEnabled?: boolean;
  /** The seam. Fired exactly once, when status leaves 'running'. */
  onRoundEnd: (summary: RoundEndSummary) => void;
}

export function useRound({ word, hapticsEnabled = true, onRoundEnd }: UseRoundOptions) {
  const reducedMotion = useReducedMotion();
  const [core, setCore] = useState<RoundCore>(() => createRound(word.word, Date.now()));
  // Monotonic shadow of the wall clock, for the anomaly flag.
  const monoStart = useRef(performance.now());
  const endedRef = useRef(false);
  const abandonedRef = useRef(false);
  // Real state, not just the ref above — `abandon()` sets this in the SAME callback
  // as `setCore()`, so React batches them into one commit. Consumers reading
  // `round.abandoned` at render time need that guarantee: reading it only from
  // `onRoundEnd` (fired from an effect, one commit AFTER core.status flips) left a
  // real one-frame window where the end-beat rendered with core.status === 'timedout'
  // but abandoned still false — long enough on a real device to flash the answer.
  const [abandoned, setAbandoned] = useState(false);

  // Always-fresh snapshot for handlers that need to read state without becoming
  // unstable callbacks (Keyboard/HintBar hold onto onKey/takeHint by identity).
  const coreRef = useRef(core);
  coreRef.current = core;

  const clock = useRoundClock({
    timeLimitSec: gameConfig.timeLimitSec,
    startedAt: core.startedAt,
    penaltySec: core.penaltySec,
    running: core.status === 'running',
    reducedMotion,
  });

  // Tick + resume authority: reconcile the machine against wall time.
  useEffect(() => {
    if (core.status !== 'running') return;
    const check = (): void => setCore((c) => expireIfDue(c, Date.now(), gameConfig));
    const interval = setInterval(check, 250);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [core.status]);

  // The seam: fire exactly once when the round ends (solve, timeout, or clamp).
  useEffect(() => {
    if (core.status === 'running' || endedRef.current) return;
    endedRef.current = true;

    const wallSec = timeUsedSec(core, gameConfig);
    const monoSec = (performance.now() - monoStart.current) / 1000;
    const anomaly = Math.abs(monoSec - wallSec) > gameConfig.anomalyToleranceSec;

    if (hapticsEnabled) {
      void (core.status === 'solved'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    }

    onRoundEnd({
      result: {
        solved: core.status === 'solved',
        timeLimitSec: gameConfig.timeLimitSec,
        timeUsedSec: wallSec,
        hintsUsed: core.hintsUsed,
        mode: 'solo',
      },
      anomaly,
      abandoned: abandonedRef.current,
    });
    // core.status is the trigger; the rest are stable refs/values at end time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core.status]);

  const wrongGuessesRef = useRef(0);
  useEffect(() => {
    if (core.wrongGuesses > wrongGuessesRef.current) {
      wrongGuessesRef.current = core.wrongGuesses;
      if (hapticsEnabled) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      AccessibilityInfo.announceForAccessibility('Not in the word. Try again.');
    }
  }, [core.wrongGuesses, hapticsEnabled]);

  // Pressure haptic (Part-A subtle touch): one tick the moment the rail enters
  // the final 10 seconds — the only non-visual cue that state exists.
  const wasCriticalRef = useRef(false);
  useEffect(() => {
    if (clock.critical && !wasCriticalRef.current) {
      wasCriticalRef.current = true;
      if (hapticsEnabled) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (!clock.critical) {
      wasCriticalRef.current = false;
    }
  }, [clock.critical, hapticsEnabled]);

  // Screen-reader announcement of every keystroke — without it, a blind player has
  // zero feedback while typing on the custom keyboard (there's no system TextInput
  // to fall back on). Computed from the PRE-update snapshot, since the machine's own
  // no-op rules (row full, nothing to erase) must not announce anything.
  const announceKeyEffect = (before: RoundCore, input: KeyInput): void => {
    if (before.status !== 'running') return;
    const total = before.answer.length;

    if (input.kind === 'letter') {
      const focus = before.cells.findIndex((c) => c.char === null);
      if (focus === -1) return; // row already full — machine no-ops, so do we
      AccessibilityInfo.announceForAccessibility(
        `${input.letter.toUpperCase()}, letter ${focus + 1} of ${total}`,
      );
      return;
    }
    if (input.kind === 'backspace') {
      for (let i = before.cells.length - 1; i >= 0; i--) {
        const cell = before.cells[i]!;
        if (cell.char !== null && !cell.given) {
          AccessibilityInfo.announceForAccessibility(`Cleared letter ${i + 1}`);
          return;
        }
      }
    }
  };

  const onKey = useCallback((key: KeyValue) => {
    const input: KeyInput =
      key === 'ENTER'
        ? { kind: 'enter' }
        : key === 'BACKSPACE'
          ? { kind: 'backspace' }
          : { kind: 'letter', letter: key };
    announceKeyEffect(coreRef.current, input);
    setCore((c) => pressKey(c, input, Date.now(), gameConfig));
  }, []);

  const takeHint = useCallback(
    (hint: PaidHint) => {
      setCore((c) => {
        if (c.status !== 'running' || c.hintsUsed.includes(hint)) return c;
        let next = machineApplyHint(c, hint, Date.now(), gameConfig);
        if (hint === 'position' && next.status === 'running') {
          next = revealPosition(next, word.hints.position.index, word.hints.position.letter);
        }
        return next;
      });
      if (hapticsEnabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      AccessibilityInfo.announceForAccessibility(
        hint === 'position' ? 'Position revealed.' : 'Letter hints revealed.',
      );
    },
    [word, hapticsEnabled],
  );

  /**
   * Abandon (back gesture / hardware back): a rated round ends as a timeout, but —
   * unlike a natural clock expiry — the word is never revealed for it (the player
   * actively chose to leave, not lose; spoiling the word for them serves nothing).
   */
  const abandon = useCallback(() => {
    if (coreRef.current.status !== 'running') return;
    abandonedRef.current = true;
    // Sibling calls, not nested inside setCore's updater (that must stay a pure
    // function of previous state) — React still batches both into one commit since
    // they're both called synchronously from the same event handler.
    setAbandoned(true);
    setCore((c) => (c.status === 'running' ? { ...c, status: 'timedout', endedAt: Date.now() } : c));
  }, []);

  const slots = useMemo<SlotModel[]>(() => {
    const focus = core.cells.findIndex((cell) => cell.char === null);
    return core.cells.map((cell, i) => {
      if (cell.char !== null) {
        if (cell.given) return { char: cell.char, state: 'given' };
        return { char: cell.char, state: core.status === 'solved' ? 'correct' : 'typed' };
      }
      if (i === focus && core.status === 'running') return { state: 'focused' };
      return { state: 'empty' };
    });
  }, [core.cells, core.status]);

  return {
    status: core.status,
    slots,
    hintsUsed: core.hintsUsed,
    wrongGuesses: core.wrongGuesses,
    clock,
    timeLabel: formatClock(clock.remainingSec),
    reducedMotion,
    abandoned,
    onKey,
    takeHint,
    abandon,
  };
}
