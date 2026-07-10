// SABD — round-state hook (§5.5). Owns remaining time, filled letters, hints,
// and status; drives the timer via requestAnimationFrame (NOT setInterval).
//
// Perf note: the burn updates a MotionValue every frame (smooth, GPU) WITHOUT
// re-rendering React; component state (the mm:ss label, critical flag) only
// changes ~1×/sec. This keeps entrance animations (chips, glyph drops) from
// being restarted 60×/sec by a cascading re-render.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMotionValue, type MotionValue } from 'framer-motion';
import type { HintId, RoundResult, WordEntry } from '../types';
import type { SabdConfig } from '../config';

export type RoundStatus = 'playing' | 'solved' | 'timeout';
export type SlotSource = 'empty' | 'typed' | 'given';

export interface SlotView {
  index: number;
  char: string;
  source: SlotSource;
  focused: boolean;
}

export interface RoundApi {
  status: RoundStatus;
  slots: SlotView[];
  focus: number;
  hintsUsed: HintId[];
  chips: string[] | null;
  /** 0..1 of the full time bar remaining, as a MotionValue (frame-smooth burn). */
  progress: MotionValue<number>;
  /** Whole seconds remaining (updates ~1×/sec). */
  remainingSec: number;
  timeLabel: string;
  critical: boolean;
  /** Increments on every rejected submit — components key their shake off it. */
  wrongKey: number;
  typeLetter: (ch: string) => void;
  backspace: () => void;
  submit: () => void;
  useHint: (id: HintId) => void;
}

function formatMMSS(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function shuffle2(a: string, b: string): string[] {
  return Math.random() < 0.5 ? [a, b] : [b, a];
}

export interface UseRoundArgs {
  entry: WordEntry;
  config: SabdConfig;
  onRoundEnd: (result: RoundResult) => void;
}

export function useRound({ entry, config, onRoundEnd }: UseRoundArgs): RoundApi {
  const n = entry.word.length;
  const answer = entry.word.toUpperCase();
  const budgetMs = config.timeLimitSec * 1000;

  const [letters, setLetters] = useState<string[]>(() => Array(n).fill(''));
  const [given, setGiven] = useState<number[]>([]);
  const [focus, setFocus] = useState(0);
  const [hintsUsed, setHintsUsed] = useState<HintId[]>([]);
  const [chips, setChips] = useState<string[] | null>(null);
  const [status, setStatus] = useState<RoundStatus>('playing');
  const [remainingSec, setRemainingSec] = useState(config.timeLimitSec);
  const [wrongKey, setWrongKey] = useState(0);

  const progress = useMotionValue(1);

  // Live refs so the rAF loop and imperative actions never read stale state.
  const lettersRef = useRef(letters);
  lettersRef.current = letters;
  const givenRef = useRef(given);
  givenRef.current = given;
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const hintsRef = useRef(hintsUsed);
  hintsRef.current = hintsUsed;

  const remainingRef = useRef(budgetMs); // precise ms
  const lastSecRef = useRef(config.timeLimitSec);
  const lastTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const endedRef = useRef(false);

  const isGiven = (i: number) => givenRef.current.includes(i);
  const nextEditable = (from: number) => {
    let i = from + 1;
    while (i < n && isGiven(i)) i++;
    return i; // may return n (past the last slot)
  };
  const prevEditable = (from: number) => {
    let i = from - 1;
    while (i >= 0 && isGiven(i)) i--;
    return i; // may return -1
  };

  // Push the precise remaining time to the smooth MotionValue; only bump React
  // state when the displayed whole-second changes.
  const syncDisplay = useCallback(() => {
    const r = remainingRef.current;
    progress.set(Math.max(0, Math.min(1, r / budgetMs)));
    const secCeil = Math.max(0, Math.ceil(r / 1000));
    if (secCeil !== lastSecRef.current) {
      lastSecRef.current = secCeil;
      setRemainingSec(secCeil);
    }
  }, [progress, budgetMs]);

  const endRound = useCallback(
    (solved: boolean) => {
      if (endedRef.current) return;
      endedRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const remainingSecPrecise = remainingRef.current / 1000;
      progress.set(Math.max(0, remainingRef.current / budgetMs));
      setStatus(solved ? 'solved' : 'timeout');
      const timeUsedSec = Math.max(0, config.timeLimitSec - remainingSecPrecise);
      const result: RoundResult = {
        solved,
        timeLimitSec: config.timeLimitSec,
        timeUsedSec: Math.round(timeUsedSec * 10) / 10,
        hintsUsed: hintsRef.current,
        mode: 'solo',
      };
      onRoundEnd(result);
    },
    [config.timeLimitSec, onRoundEnd, progress, budgetMs],
  );

  // The burn. Deducts real elapsed time each frame; ends the round at zero.
  useEffect(() => {
    if (status !== 'playing') return;
    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = ts - lastTsRef.current;
      lastTsRef.current = ts;
      const r = remainingRef.current - dt;
      if (r <= 0) {
        remainingRef.current = 0;
        syncDisplay();
        endRound(false);
        return;
      }
      remainingRef.current = r;
      syncDisplay();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [status, endRound, syncDisplay]);

  const applyPenalty = useCallback(
    (costSec: number) => {
      remainingRef.current = Math.max(0, remainingRef.current - costSec * 1000);
      syncDisplay();
      if (remainingRef.current <= 0) endRound(false);
    },
    [endRound, syncDisplay],
  );

  const typeLetter = useCallback((ch: string) => {
    if (endedRef.current) return;
    const c = ch.toUpperCase();
    if (!/^[A-Z]$/.test(c)) return;
    const at = focusRef.current;
    if (at >= n || isGiven(at)) return; // row full or focus parked on a given slot
    setLetters((prev) => {
      const next = [...prev];
      next[at] = c;
      return next;
    });
    setFocus(nextEditable(at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backspace = useCallback(() => {
    if (endedRef.current) return;
    const at = focusRef.current;
    const filledHere = at < n && lettersRef.current[at] !== '' && !isGiven(at);
    const target = filledHere ? at : prevEditable(at);
    if (target < 0) return;
    setLetters((prev) => {
      const next = [...prev];
      next[target] = '';
      return next;
    });
    setFocus(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(() => {
    if (endedRef.current) return;
    const current = lettersRef.current;
    const complete = current.every((c) => c !== '');
    if (!complete) {
      setWrongKey((k) => k + 1); // shake — round does NOT end
      return;
    }
    if (current.join('') === answer) endRound(true);
    else setWrongKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer, endRound]);

  const useHint = useCallback(
    (id: HintId) => {
      if (endedRef.current) return;
      if (hintsRef.current.includes(id)) return;
      if (id === 'position') {
        const { index, letter } = entry.hints.position;
        const c = letter.toUpperCase();
        setLetters((prev) => {
          const next = [...prev];
          next[index] = c;
          return next;
        });
        setGiven((g) => (g.includes(index) ? g : [...g, index]));
        givenRef.current = givenRef.current.includes(index)
          ? givenRef.current
          : [...givenRef.current, index];
        setHintsUsed((h) => [...h, 'position']);
        if (focusRef.current === index) setFocus(nextEditable(index));
        applyPenalty(config.hintCosts.position);
      } else {
        const { correct, decoy } = entry.hints.letters;
        setChips(shuffle2(correct.toUpperCase(), decoy.toUpperCase()));
        setHintsUsed((h) => [...h, 'letters']);
        applyPenalty(config.hintCosts.letters);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [entry, config.hintCosts, applyPenalty],
  );

  const slots: SlotView[] = letters.map((char, index) => {
    const source: SlotSource = given.includes(index) ? 'given' : char ? 'typed' : 'empty';
    return {
      index,
      char,
      source,
      focused: status === 'playing' && index === focus && !given.includes(index),
    };
  });

  return {
    status,
    slots,
    focus,
    hintsUsed,
    chips,
    progress,
    remainingSec,
    timeLabel: formatMMSS(remainingSec),
    critical: status === 'playing' ? remainingSec <= config.criticalSec : status === 'timeout',
    wrongKey,
    typeLetter,
    backspace,
    submit,
    useHint,
  };
}
