/**
 * Home (T19, locked mockup 8b): tight header (small lockup: rail + Khand SABD;
 * glowing rating right) → 2×3 topic grid (accent Rekha edges, glyph wallpaper,
 * per-card rating glow / UNPLAYED dim / SOON when the bank has no words yet) →
 * kesar PLAY in the thumb zone → ⚔ Challenge (disabled, "soon").
 *
 * Data notes (flagged in the handoff):
 *  - Per-card number is this topic's OWN rating — the same @sabd/elo engine,
 *    replayed only over this topic's rounds from the 1200 seed (`topicStats`,
 *    @sabd/storage). Independent of the header's global rating and of every
 *    other topic; nothing here reads playerRatingBefore.
 *  - The mock's "TOP N%" percentile needs population data (a backend); until
 *    then the sub-line shows lifetime rounds.
 */
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TopicId } from '@sabd/contracts';
import { getSetting } from '@sabd/storage';

import { useTheme } from '../src/theme';
import { hexToRgba } from '../src/theme/color';
import { usePingPong } from '../src/theme/themed/ambient.ts';
import { themedHues, acc, ok } from '../src/theme/themed/themedTokens.ts';
import { useReducedMotion } from '../src/a11y/useReducedMotion';
import { useStorageBoot } from '../src/storage/useStorageBoot';
import { useHomeStats } from '../src/home/useHomeStats';
import { TopicCard, type TopicCardState } from '../src/home/TopicCard';
import { TOPICS, topicById } from '../src/home/topics';
import { availableBankTopics } from '../src/round/selectWord';
import { getStorage } from '../src/storage/db';
import { hasSplashPlayed } from '../src/splashState';
import { Wordmark } from '../src/components/Logo';

export default function Home() {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const storage = useStorageBoot();
  const stats = useHomeStats(storage.ready);
  const [selected, setSelected] = useState<TopicId>('gaming');

  // PLAY CTA takes the selected category's color, with an idle k-beat pulse.
  const selectedHue = themedHues[selected];
  const playAccent = acc(selectedHue);
  const beat = usePingPong(1, 1.05, 2600, 0, reducedMotion);
  const beatStyle = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));

  // Splash flip (T21) plays once at the launch moment — before Home, never in-round.
  useEffect(() => {
    if (!hasSplashPlayed()) router.replace('/splash');
  }, [router]);

  // First-launch onboarding gate (T22) — shown once, replayable from Settings.
  useEffect(() => {
    if (!hasSplashPlayed() || !storage.ready || Platform.OS === 'web') return;
    try {
      const seen = getSetting(getStorage().db, 'onboardingSeen', false);
      if (!seen) router.replace('/onboarding');
    } catch (err) {
      console.error('home: onboarding check failed', err);
    }
  }, [storage.ready, router]);

  const banked = availableBankTopics();
  const cardState = (bankTopic: string): TopicCardState => {
    if (!banked.has(bankTopic)) return { kind: 'soon' };
    const s = stats.byTopic.get(bankTopic);
    return s ? { kind: 'played', rating: s.rating } : { kind: 'unplayed' };
  };

  const selectedMeta = topicById(selected);

  return (
    <View style={[styles.screen, { backgroundColor: t.colors.ink, paddingTop: insets.top + 26 }]}>
      {/* Header — the real wordmark asset left, glowing rating right. */}
      <View style={styles.header}>
        <Wordmark width={148} />
        <View style={styles.headerRight}>
          <View
            style={styles.ratingBlock}
            accessible
            accessibilityLabel={
              storage.ready
                ? `Rating ${storage.rating}, ${stats.rounds} ${stats.rounds === 1 ? 'round' : 'rounds'} played`
                : 'Rating loading'
            }
          >
            <View style={styles.ratingRow}>
              <Text importantForAccessibility="no" style={{ color: t.colors.kesar, fontSize: 11 }}>
                ◆
              </Text>
              <Text
                style={{
                  fontFamily: t.font.monoBold,
                  fontSize: 26,
                  color: t.colors.paper,
                  letterSpacing: -1,
                  textShadowColor: hexToRgba(t.colors.kesar, 0.45),
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 18,
                }}
              >
                {storage.ready ? storage.rating : '····'}
              </Text>
            </View>
            <Text style={{ fontFamily: t.font.mono, fontSize: 10, letterSpacing: 2, color: t.colors.paperDim }}>
              {stats.rounds === 1 ? '1 ROUND' : `${stats.rounds} ROUNDS`}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push('/settings')}
            style={styles.gear}
            hitSlop={8}
          >
            <Text style={{ fontSize: 18, color: t.colors.paperDim }}>⚙</Text>
          </Pressable>
        </View>
      </View>

      {/* Topic grid — 2×3, cards stretch. */}
      <ScrollView contentContainerStyle={styles.grid} style={{ flex: 1, marginTop: 24 }}>
        {TOPICS.map((topic) => (
          <TopicCard
            key={topic.id}
            topic={topic}
            state={cardState(topic.bankTopic)}
            selected={topic.id === selected}
            onSelect={(m) => setSelected(m.id)}
          />
        ))}
      </ScrollView>

      {/* CTA dock — thumb zone. One CTA, max (§6); takes the selected category's color. */}
      <View style={[styles.dock, { paddingBottom: insets.bottom + 16 }]}>
        <Animated.View
          style={[
            styles.play,
            { backgroundColor: playAccent.main },
            beatStyle,
          ]}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/round', params: { topic: selected } })}
            style={styles.playPressable}
          >
            {/* Inset underside strip, darkened same hue (mockup 10a: box-shadow: inset 0 -3px). */}
            <View style={[styles.playUnderside, { backgroundColor: ok(0.5, 0.12, selectedHue) }]} />
            <Text style={{ fontFamily: t.font.brand, fontSize: 19, letterSpacing: 2, color: t.colors.ink }}>
              PLAY · {selectedMeta.name}
            </Text>
          </Pressable>
        </Animated.View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Challenge a rival, coming soon"
          accessibilityState={{ disabled: true }}
          disabled
          style={styles.challenge}
        >
          <Text style={{ fontFamily: t.font.mono, fontSize: 12, letterSpacing: 1, color: t.colors.paperDim }}>
            ⚔ CHALLENGE A RIVAL · SOON
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  gear: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  challenge: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  ratingBlock: { alignItems: 'flex-end', gap: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignContent: 'stretch',
    flexGrow: 1,
  },
  dock: { gap: 14, alignItems: 'center', paddingTop: 20 },
  play: {
    alignSelf: 'stretch',
    height: 56,
    borderRadius: 4,
    overflow: 'hidden',
  },
  playPressable: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playUnderside: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3 },
});
