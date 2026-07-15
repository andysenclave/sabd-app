/**
 * Onboarding (T22 + T19a): shown once before the first round, skippable. Opens with
 * the śabda story panel (FB-001), then three mechanics panels (Instrument Sans voice):
 * the rail is time, hints cost seconds, rating is you. A settings toggle replays it
 * (see app/settings.tsx). Persists via kv `onboardingSeen`.
 */
import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setSetting } from '@sabd/storage';

import { useTheme } from '../src/theme';
import { getStorage } from '../src/storage/db';
import { useReducedMotion } from '../src/a11y/useReducedMotion';
import { StoryPanel } from '../src/components/onboarding/StoryPanel';

interface Panel {
  title: string;
  body: string;
  glyph: string;
}

const PANELS: Panel[] = [
  {
    glyph: '━',
    title: 'THE RAIL IS TIME',
    body: 'The line above your word burns right to left. When it runs out, so does your round.',
  },
  {
    glyph: '◇',
    title: 'HINTS COST SECONDS',
    body: 'POSITION reveals a letter. LETTERS narrows it down. Both borrow time from the rail.',
  },
  {
    glyph: '◆',
    title: 'YOUR RATING IS YOU',
    body: 'Solve fast, without hints, and it climbs. Every round updates it — win or lose.',
  },
];

// Total flow = story panel (step 0) + the three mechanics panels (steps 1–3).
const TOTAL_STEPS = PANELS.length + 1;

export default function Onboarding() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);

  const finish = useCallback(() => {
    if (Platform.OS !== 'web') {
      try {
        setSetting(getStorage().db, 'onboardingSeen', true);
      } catch (err) {
        console.error('onboarding: failed to persist seen flag', err);
      }
    }
    router.replace('/');
  }, [router]);

  // Panel ① — the śabda story (T19a). Owns its own skip/next/dots/CTA.
  if (step === 0) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + 30, paddingBottom: insets.bottom + 28 }}>
        <StoryPanel animate={!reducedMotion} onNext={() => setStep(1)} onSkip={finish} />
      </View>
    );
  }

  const panel = PANELS[step - 1]!;
  const last = step === TOTAL_STEPS - 1;

  return (
    <View style={[styles.screen, { backgroundColor: t.colors.ink, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <Pressable accessibilityRole="button" onPress={finish} style={styles.skip}>
        <Text style={{ fontFamily: t.font.mono, fontSize: 12, letterSpacing: 1, color: t.colors.paperDim }}>
          SKIP
        </Text>
      </Pressable>

      <View style={styles.center}>
        <Text style={{ fontSize: 44, color: t.accent(), marginBottom: 28 }}>{panel.glyph}</Text>
        <Text
          style={{
            fontFamily: t.font.displayHeavy,
            fontSize: 22,
            letterSpacing: 1,
            color: t.colors.paper,
            textAlign: 'center',
            marginBottom: 14,
          }}
        >
          {panel.title}
        </Text>
        <Text
          style={{
            fontFamily: t.font.body,
            fontSize: 16,
            lineHeight: 24,
            color: t.colors.paperDim,
            textAlign: 'center',
            paddingHorizontal: 12,
          }}
        >
          {panel.body}
        </Text>
      </View>

      <View
        style={styles.dots}
        accessible
        accessibilityLabel={`Step ${step + 1} of ${TOTAL_STEPS}`}
      >
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            importantForAccessibility="no"
            style={[
              styles.dot,
              { backgroundColor: i === step ? t.colors.kesar : t.colors.ink2 },
            ]}
          />
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => (last ? finish() : setStep((s) => s + 1))}
        style={[styles.cta, { backgroundColor: t.colors.kesar }]}
      >
        <Text style={{ fontFamily: t.font.brand, fontSize: 18, letterSpacing: 1, color: t.colors.ink }}>
          {last ? "LET'S PLAY" : 'NEXT'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 28 },
  skip: { alignSelf: 'flex-end', minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  cta: { height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
});
