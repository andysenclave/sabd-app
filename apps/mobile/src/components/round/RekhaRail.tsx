/**
 * The Rekha (T13) — one horizontal rail that is the letter mount AND the timer.
 *
 * DESIGN-SYSTEM §1/§2/§5: lives ABOVE the word (slots hang beneath it — never a
 * strikethrough). Track at 12% paper; burns right→left over the round in the topic accent;
 * shifts to `--signal` in the final 10s with a 1px ember pulse; freezes on end; a full-width
 * accent glow flash on solve. The readout sits at the burnt (right) end.
 *
 * Wrong guess (T18): the RAIL flinches, not the letters — ±4px ×3 shake, `--fast` (120ms).
 * Slots stay put; only this component reacts.
 *
 * Purely visual: it renders the `progress` shared value from `useRoundClock`. It never owns
 * the time.
 */
import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  type SharedValue,
} from 'react-native-reanimated';
import { duration, motion as motionTokens } from '@sabd/tokens';

import { useTheme } from '../../theme';

export interface RekhaRailProps {
  /** Remaining fraction 1→0 from useRoundClock. */
  progress: SharedValue<number>;
  /** Readout string, e.g. "0:52". */
  timeLabel: string;
  /** Final-10s state: burn + readout go signal red, ember pulses. */
  critical?: boolean;
  /** Solve flash: full-width accent glow, burn hidden. */
  solved?: boolean;
  /** Override accent (defaults to the current topic's). */
  accentColor?: string;
  reducedMotion?: boolean;
  /** Bumps on every wrong guess — triggers the rail-level shake. */
  wrongGuesses?: number;
}

export function RekhaRail({
  progress,
  timeLabel,
  critical = false,
  solved = false,
  accentColor,
  reducedMotion = false,
  wrongGuesses = 0,
}: RekhaRailProps) {
  const t = useTheme();
  const accent = accentColor ?? t.accent();
  const burnColor = critical ? t.colors.signal : accent;

  const ember = useSharedValue(1);
  useEffect(() => {
    if (critical && !reducedMotion) {
      ember.value = withRepeat(withTiming(0.4, { duration: 500 }), -1, true);
    } else {
      cancelAnimation(ember);
      ember.value = 1;
    }
    return () => cancelAnimation(ember);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [critical, reducedMotion]);

  const shakeX = useSharedValue(0);
  useEffect(() => {
    if (wrongGuesses === 0) return;
    const d = motionTokens.wrongShakePx;
    if (reducedMotion) return; // reduced motion: no shake, the slot/description feedback suffices
    shakeX.value = withSequence(
      withTiming(-d, { duration: duration.fast / 3 }),
      withTiming(d, { duration: duration.fast / 3 }),
      withTiming(0, { duration: duration.fast / 3 }),
    );
  }, [wrongGuesses, reducedMotion, shakeX]);

  const burnStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, progress.value)) * 100}%`,
    opacity: ember.value,
  }));
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  return (
    <View>
      <View style={styles.readoutRow}>
        <Text
          accessibilityLabel={`${timeLabel} remaining`}
          style={[styles.readout, { fontFamily: t.font.mono, color: solved ? accent : burnColor }]}
        >
          {timeLabel}
        </Text>
      </View>

      <Animated.View
        style={[
          styles.rail,
          solved && {
            backgroundColor: accent,
            shadowColor: accent,
            shadowOpacity: 0.8,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 0 },
            elevation: 8,
          },
          shakeStyle,
        ]}
      >
        {!solved && (
          <>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.railTrack }]} />
            <Animated.View style={[styles.burn, { backgroundColor: burnColor }, burnStyle]} />
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  readoutRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: 6 },
  readout: { fontSize: 13 },
  rail: { position: 'relative', height: 3, marginHorizontal: 24 },
  burn: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});
