/**
 * Letters-hint chips (T16) — the contract's two letters ({correct, decoy}),
 * shuffled so there is NO correctness tell, staggered in 30ms apart, rising to
 * settle under the rail (DESIGN-SYSTEM §5). Reduced motion → plain fade.
 *
 * The shuffle is deterministic per word (seeded by word id): stable across
 * re-renders and reproducible in a rated game — no Math.random at render time.
 *
 * Motion is driven by shared values on mount (not `entering` presets), which
 * behaves identically on native and on the RN-Web dev harness.
 */
import { memo, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { useTheme } from '../../theme';
import { motion, duration } from '@sabd/tokens';

export interface LetterChipsProps {
  /** From WordEntry.hints.letters. */
  correct: string;
  decoy: string;
  /** Seed for the order (use the word id). */
  seed: string;
  reducedMotion?: boolean;
}

function seededSwap(seed: string): boolean {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return (h & 1) === 1;
}

function Chip({
  letter,
  index,
  reducedMotion,
}: {
  letter: string;
  index: number;
  reducedMotion: boolean;
}) {
  const t = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      index * motion.chipStaggerMs,
      withTiming(1, { duration: duration.beat, easing: Easing.out(Easing.quad) }),
    );
    // progress is a stable shared value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    // Rise to the rail, settle below: 10px upward travel unless reduced motion.
    transform: [{ translateY: reducedMotion ? 0 : (1 - progress.value) * 10 }],
  }));

  return (
    <Animated.View
      style={[
        styles.chip,
        { borderColor: t.accent(0.5), backgroundColor: 'rgba(233,234,242,.08)' },
        style,
      ]}
    >
      <Text style={{ fontFamily: t.font.mono, fontSize: 15, color: t.colors.paper }}>
        {letter.toUpperCase()}
      </Text>
    </Animated.View>
  );
}

export const LetterChips = memo(function LetterChips({
  correct,
  decoy,
  seed,
  reducedMotion = false,
}: LetterChipsProps) {
  const letters = seededSwap(seed) ? [decoy, correct] : [correct, decoy];

  return (
    <View style={styles.row} accessibilityLabel={`Letter hints: ${letters.join(', ')}`}>
      {letters.map((ch, i) => (
        <Chip key={ch} letter={ch} index={i} reducedMotion={reducedMotion} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 22 },
  chip: {
    minWidth: 36,
    height: 40,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
