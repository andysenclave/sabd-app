/**
 * Home (T19, locked mockup 8b): tight header (small lockup: rail + Khand SABD;
 * glowing rating right) → 2×3 topic grid (accent Rekha edges, glyph wallpaper,
 * per-card rating glow / UNPLAYED dim / SOON when the bank has no words yet) →
 * kesar PLAY in the thumb zone → ⚔ Challenge (disabled, "soon").
 *
 * Data notes (flagged in the handoff):
 *  - Per-card number = playerRatingBefore of your LATEST round in that topic
 *    ("where you stood last time here") — the contract has one global rating,
 *    not per-topic ratings.
 *  - The mock's "TOP N%" percentile needs population data (a backend); until
 *    then the sub-line shows lifetime rounds.
 */
import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TopicId } from '@sabd/contracts';

import { useTheme } from '../src/theme';
import { useStorageBoot } from '../src/storage/useStorageBoot';
import { useHomeStats } from '../src/home/useHomeStats';
import { TopicCard, type TopicCardState } from '../src/home/TopicCard';
import { TOPICS, topicById } from '../src/home/topics';
import { availableBankTopics } from '../src/round/selectWord';

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const storage = useStorageBoot();
  const stats = useHomeStats(storage.ready);
  const [selected, setSelected] = useState<TopicId>('gaming');

  const banked = availableBankTopics();
  const cardState = (bankTopic: string): TopicCardState => {
    if (!banked.has(bankTopic)) return { kind: 'soon' };
    const s = stats.byTopic.get(bankTopic);
    return s ? { kind: 'played', rating: s.lastRatingBefore } : { kind: 'unplayed' };
  };

  const selectedMeta = topicById(selected);

  return (
    <View style={[styles.screen, { backgroundColor: t.colors.ink, paddingTop: insets.top + 26 }]}>
      {/* Header — lockup left (rail ABOVE the word), glowing rating right. */}
      <View style={styles.header}>
        <View style={styles.lockup}>
          <View style={[styles.rail, { backgroundColor: t.colors.kesar }]} />
          <Text style={[styles.wordmark, { fontFamily: t.font.brand, color: t.colors.paper }]}>
            SABD
          </Text>
        </View>
        <View style={styles.ratingBlock}>
          <View style={styles.ratingRow}>
            <Text style={{ color: t.colors.kesar, fontSize: 11 }}>◆</Text>
            <Text
              style={{
                fontFamily: t.font.monoBold,
                fontSize: 26,
                color: t.colors.paper,
                letterSpacing: -1,
                textShadowColor: 'rgba(242,163,60,.4)',
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

      {/* CTA dock — thumb zone. One kesar CTA, max (§6). */}
      <View style={[styles.dock, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/round', params: { topic: selected } })}
          style={[styles.play, { backgroundColor: t.colors.kesar }]}
        >
          <Text style={{ fontFamily: t.font.brand, fontSize: 19, letterSpacing: 2, color: t.colors.ink }}>
            PLAY · {selectedMeta.name}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: true }} disabled>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  lockup: { gap: 4 },
  rail: { width: 112, height: 4, borderRadius: 1 },
  wordmark: { fontSize: 30, lineHeight: 32, letterSpacing: 2, paddingHorizontal: 4 },
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
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
