/**
 * useRoundClock (T13) — the authoritative round timer.
 *
 * The truth is `startedAt` (a wall-clock epoch ms), NOT the animation. The visual burn is
 * a Reanimated shared value driven smoothly on the UI thread, but the readout, the
 * `critical` threshold, and end-of-round detection are all recomputed from `startedAt` on a
 * 200ms tick — so the burn and the logged `timeUsedSec` agree within ~100ms (T13 DoD).
 *
 * On resume from background, wall time has passed: we recompute remaining from `startedAt`
 * and re-seed the burn (never silently pause — it's a rated game). Reduced motion keeps the
 * burn as information but steps it instead of animating (DESIGN-SYSTEM §5).
 */
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  useSharedValue,
  withTiming,
  cancelAnimation,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';

export interface RoundClock {
  /** Remaining fraction 1→0, for the burn width. */
  progress: SharedValue<number>;
  /** Whole seconds remaining, for the readout. */
  remainingSec: number;
  /** True in the final 10s (and > 0). */
  critical: boolean;
  /** True once the clock hits 0. */
  done: boolean;
}

export interface RoundClockOptions {
  timeLimitSec: number;
  /** Authoritative start (epoch ms). */
  startedAt: number;
  /** Seconds burned by hints — the burn re-seeds whenever this changes. */
  penaltySec?: number;
  running: boolean;
  reducedMotion?: boolean;
}

export function useRoundClock({
  timeLimitSec,
  startedAt,
  penaltySec = 0,
  running,
  reducedMotion = false,
}: RoundClockOptions): RoundClock {
  const progress = useSharedValue(1);
  const [remainingSec, setRemainingSec] = useState(timeLimitSec);
  const [critical, setCritical] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;

    const remaining = (): number =>
      Math.max(0, timeLimitSec - penaltySec - (Date.now() - startedAt) / 1000);

    const sync = (): number => {
      const rem = remaining();
      setRemainingSec(Math.ceil(rem));
      setCritical(rem <= 10 && rem > 0);
      if (rem <= 0) {
        setDone(true);
        progress.value = 0;
        return 0;
      }
      return rem;
    };

    const seedBurn = (): void => {
      cancelAnimation(progress);
      const rem = remaining();
      progress.value = rem / timeLimitSec;
      if (!reducedMotion && rem > 0) {
        progress.value = withTiming(0, { duration: rem * 1000, easing: Easing.linear });
      }
    };

    if (sync() <= 0) return;
    seedBurn();

    intervalRef.current = setInterval(() => {
      const rem = sync();
      if (reducedMotion) progress.value = rem / timeLimitSec; // stepped burn (still information)
      if (rem <= 0 && intervalRef.current) clearInterval(intervalRef.current);
    }, 200);

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && sync() > 0) seedBurn();
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      appStateSub.remove();
      cancelAnimation(progress);
    };
    // progress is a stable shared value; intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, startedAt, timeLimitSec, penaltySec, reducedMotion]);

  return { progress, remainingSec, critical, done };
}

/** Format seconds as `m:ss` for the readout. */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.ceil(totalSec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}
