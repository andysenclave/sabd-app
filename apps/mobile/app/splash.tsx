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
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import Animated, {
  useSharedValue,
  withTiming,
  withSequence,
  useAnimatedStyle,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

import { useTheme } from '../src/theme';
import { useReducedMotion } from '../src/a11y/useReducedMotion';
import { hasSplashPlayed, markSplashPlayed } from '../src/splashState';
import { Wordmark } from '../src/components/Logo';

// Placeholder "clack" — synthesized band-limited noise (~1.7kHz, 50ms) per LOGO.md's
// own description, not a licensed recording. Swap this file for a real sound-designer
// asset later; nothing else here needs to change.
const CLACK_SOUND = require('../assets/sound/splash-clack.wav');

const SCRIPTS = ['शब्द', 'শব্দ', 'SABD'] as const;
const STEP_MS = 550;
// Per LOGO.md's flap physics ("1.6px vertical shudder, 90ms ease-out + soft clack"
// on landing) — a small overshoot-then-settle on each script change, not a flat cut.
const LANDING_SHUDDER_PX = 6;

export default function Splash() {
  const t = useTheme();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { width: windowWidth } = useWindowDimensions();
  const opacity = useSharedValue(1);
  const shudder = useSharedValue(0);
  const scale = useSharedValue(0.92);
  const [scriptIndex, setScriptIndex] = useState(0);
  const clack = useAudioPlayer(CLACK_SOUND);

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

  // Landing shudder + settle-scale on every script change (including the first) —
  // the flap "clacks" into place rather than cutting flat, per LOGO.md's physics.
  useEffect(() => {
    if (reducedMotion) return;
    shudder.value = withSequence(
      withTiming(-LANDING_SHUDDER_PX, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 140, easing: Easing.out(Easing.quad) }),
    );
    scale.value = withSequence(
      withTiming(1.05, { duration: 120, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }),
    );
    // The audible clack plays once, on the final resolve (SABD) — not on every
    // script swap, which would read as three rapid clicks rather than one landing.
    if (scriptIndex === SCRIPTS.length - 1) {
      try {
        clack.play();
      } catch (err) {
        console.error('splash: clack playback failed', err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptIndex, reducedMotion]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const markStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: shudder.value }, { scale: scale.value }],
  }));

  if (reducedMotion) return null; // redirect is in-flight

  const script = SCRIPTS[scriptIndex];
  const isLatin = scriptIndex === SCRIPTS.length - 1;
  const wordmarkWidth = Math.min(windowWidth * 0.68, 340);

  return (
    <Animated.View style={[styles.screen, { backgroundColor: t.colors.ink }, fadeStyle]}>
      <Animated.View style={[styles.markWrap, markStyle]}>
        {/* The Wordmark SVG bakes in its own rail — only draw one here for the
            script frames, or the Latin frame would show two stacked rails. */}
        {!isLatin && <View style={[styles.rail, { backgroundColor: t.colors.kesar, width: 128 }]} />}
        {isLatin ? (
          <Wordmark width={wordmarkWidth} />
        ) : (
          <Text
            style={{
              fontFamily: scriptIndex === 0 ? t.font.devanagari : t.font.bengali,
              fontSize: 72,
              color: t.colors.paper,
            }}
          >
            {script}
          </Text>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  markWrap: { alignItems: 'center', gap: 16 },
  rail: { height: 4, borderRadius: 2 },
});
