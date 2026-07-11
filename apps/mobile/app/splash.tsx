/**
 * Splash flip (T21) — the split-flap intro per LOGO.md: शब्द → শব্দ → SABD resolve.
 * Plays ONCE at the launch moment (cold start only — a module-scoped flag stops it
 * replaying on later foregrounds within the same JS session). Never plays in-round.
 * Skipped entirely on reduced motion (straight to Home).
 *
 * The native static splash (app.json `splash`) covers the gap before JS loads; this
 * screen is the animated flip that follows it, still pre-Home.
 */
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, withTiming, useAnimatedStyle, runOnJS } from 'react-native-reanimated';

import { useTheme } from '../src/theme';
import { useReducedMotion } from '../src/a11y/useReducedMotion';
import { hasSplashPlayed, markSplashPlayed } from '../src/splashState';

const SCRIPTS = ['शब्द', 'শব্দ', 'SABD'] as const;
const STEP_MS = 550;

export default function Splash() {
  const t = useTheme();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const [scriptIndex, setScriptIndex] = useState(0);

  useEffect(() => {
    if (hasSplashPlayed() || reducedMotion) {
      markSplashPlayed();
      router.replace('/');
      return;
    }
    markSplashPlayed();

    const goHome = () => router.replace('/');
    const timers = SCRIPTS.map((_, i) => setTimeout(() => setScriptIndex(i), i * STEP_MS));
    const finish = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 260 }, (done) => {
        if (done) runOnJS(goHome)();
      });
    }, SCRIPTS.length * STEP_MS + 200);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (reducedMotion) return null; // redirect is in-flight

  const script = SCRIPTS[scriptIndex];
  const isLatin = scriptIndex === SCRIPTS.length - 1;

  return (
    <Animated.View style={[styles.screen, { backgroundColor: t.colors.ink }, fadeStyle]}>
      <View style={styles.markWrap}>
        <View style={[styles.rail, { backgroundColor: t.colors.kesar }]} />
        <Text
          style={{
            fontFamily: isLatin ? t.font.brand : scriptIndex === 0 ? t.font.devanagari : t.font.bengali,
            fontSize: isLatin ? 56 : 48,
            color: t.colors.paper,
            letterSpacing: isLatin ? 3 : 0,
          }}
        >
          {script}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  markWrap: { alignItems: 'center', gap: 14 },
  rail: { width: 96, height: 4, borderRadius: 2 },
});
