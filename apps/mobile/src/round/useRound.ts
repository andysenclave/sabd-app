/**
 * useRound (T15) — wires the pure round machine to the world: the Rekha clock,
 * haptics, background/resume reconciliation, and the single onRoundEnd seam.
 *
 * The machine decides; this hook schedules. Rating math lives behind the seam
 * (@sabd/storage.recordRound → @sabd/elo) — none of it here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
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
  type RoundCore,
} from './roundMachine.ts';
import { useRoundClock, formatClock } from './useRoundClock.ts';
import { useReducedMotion } from '../a11y/useReducedMotion.ts';
import type { KeyValue } from '../components/round/Keyboard.tsx';
import type { SlotModel } from '../components/round/SlotRow.tsx';

export interface RoundEndSummary {
  result: RoundResult2;
  /** Wall-vs-monotonic clocks disagreed beyond tolerance (device clock manipulation). */
  anomaly: boolean;
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
    });
    // core.status is the trigger; the rest are stable refs/values at end time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core.status]);

  const wrongGuessesRef = useRef(0);
  useEffect(() => {
    if (core.wrongGuesses > wrongGuessesRef.current) {
      wrongGuessesRef.current = core.wrongGuesses;
      if (hapticsEnabled) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [core.wrongGuesses, hapticsEnabled]);

  const onKey = useCallback((key: KeyValue) => {
    const input =
      key === 'ENTER'
        ? ({ kind: 'enter' } as const)
        : key === 'BACKSPACE'
          ? ({ kind: 'backspace' } as const)
          : ({ kind: 'letter', letter: key } as const);
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
    },
    [word, hapticsEnabled],
  );

  /** Abandon (back gesture / hardware back): a rated round ends as a timeout. */
  const abandon = useCallback(() => {
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
    onKey,
    takeHint,
    abandon,
  };
}
