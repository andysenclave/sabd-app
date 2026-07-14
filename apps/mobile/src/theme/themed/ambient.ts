/**
 * Ambient animation primitives — the RN/Reanimated equivalent of the `k-*` CSS
 * keyframes in themeTokens.ts. Idle, decorative, never gameplay-meaningful; every
 * hook here respects `reducedMotion` by freezing at its rest value (CSS's blanket
 * `@media (prefers-reduced-motion: reduce) { animation: none }` has no RN analogue,
 * so each caller passes the flag through instead).
 *
 * CSS keyframes with 2 stops (a "ping-pong" between a rest and peak value) map to
 * `usePingPong`. Keyframes with 3+ stops or a one-directional loop (drift, steam,
 * flicker, spin, grid/dash pan) drive a `useLinearLoop` 0→1 ramp and interpolate
 * per-caller — that's an approximation of the exact CSS easing, not a pixel-identical
 * port, which is an inherent limit of translating CSS animation to Reanimated.
 */
import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  interpolate,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';

/** Ping-pongs between `from` and `to` forever (k-twinkle, k-glyph, k-bob, k-beat, k-breathe). */
export function usePingPong(
  from: number,
  to: number,
  durationMs: number,
  delayMs = 0,
  reducedMotion = false,
): SharedValue<number> {
  const value = useSharedValue(from);
  useEffect(() => {
    if (reducedMotion) {
      value.value = from;
      return;
    }
    value.value = withDelay(
      delayMs,
      withRepeat(withTiming(to, { duration: durationMs, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);
  return value;
}

/** Linear 0→1 ramp, repeating forever — the driver for custom multi-stop interpolation. */
export function useLinearLoop(durationMs: number, delayMs = 0, reducedMotion = false): SharedValue<number> {
  const value = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) {
      value.value = 0;
      return;
    }
    value.value = withDelay(delayMs, withRepeat(withTiming(1, { duration: durationMs, easing: Easing.linear }), -1, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);
  return value;
}

/**
 * k-drift: a slow, non-monotonic 4-stop wander applied to a whole decorative layer
 * (star dots, sparkles, floating notes) — not a ping-pong, so it rides a linear 0→1
 * ramp and interpolates translateX/Y through the CSS keyframe's 4 stops directly,
 * rather than leaving the interpolation to each caller like `useLinearLoop`.
 */
export function useDriftStyle(durationMs: number, delayMs: number, reducedMotion: boolean) {
  const progress = useLinearLoop(durationMs, delayMs, reducedMotion);
  return useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 0.25, 0.5, 0.75, 1], [0, 7, -5, 9, 0]) },
      { translateY: interpolate(progress.value, [0, 0.25, 0.5, 0.75, 1], [0, -9, 7, 5, 0]) },
    ],
  }));
}

/** Hard on/off step, no fade — k-blink (focused-slot stubs, terminal cursor). */
export function useBlink(periodMs: number, reducedMotion = false): SharedValue<number> {
  const value = useSharedValue(1);
  useEffect(() => {
    if (reducedMotion) {
      value.value = 1;
      return;
    }
    const half = periodMs / 2;
    value.value = withRepeat(
      withSequence(
        withTiming(1, { duration: half }), // hold on
        withTiming(0, { duration: 1 }), // snap off
        withTiming(0, { duration: Math.max(1, half - 1) }), // hold off
        withTiming(1, { duration: 1 }), // snap on
      ),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);
  return value;
}
