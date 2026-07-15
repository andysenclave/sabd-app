/**
 * Category profile screen (Phase-3 T18) — the "strong at Gaming, weak at Music"
 * diagnostic: overall score (Kesar hero number), global streak/rounds, and all six
 * category rows with their own accent color, score, games, and live streak.
 *
 * FUNCTIONAL version to DESIGN-SYSTEM tokens (no mockup exists for this screen —
 * rev-3 mockups cover Home + Rounds only). Polish logged to the design pile:
 * per-category accent Rekhas, the hero-number beat, unplayed affordance styling.
 * Data: per-topic replay via topicStats (each topic's OWN score + streak, from 0,
 * post-epoch) + the global cache. Score 0 is an honest start — unplayed topics
 * show 0 with an "unplayed" affordance, per the architect edge-case orders.
 */
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPlayer, topicStats, type TopicStats } from '@sabd/storage';

import { useTheme } from '../src/theme';
import { getStorage } from '../src/storage/db';
import { TOPICS } from '../src/home/topics';
import { themedHues, acc } from '../src/theme/themed/themedTokens.ts';

interface ProfileData {
  overall: number;
  globalStreak: number;
  rounds: number;
  byTopic: Map<string, TopicStats>;
}

function loadProfile(): ProfileData {
  if (Platform.OS === 'web') {
    return { overall: 0, globalStreak: 0, rounds: 0, byTopic: new Map() };
  }
  const db = getStorage().db;
  const player = getPlayer(db);
  return {
    overall: player?.cachedRating ?? 0,
    globalStreak: player?.cachedStreak ?? 0,
    rounds: player?.cachedGamesPlayed ?? 0,
    byTopic: new Map(topicStats(db).map((s) => [s.topic, s])),
  };
}

export default function Profile() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const data = loadProfile(); // scores can't change while this screen is open

  return (
    <View style={[styles.screen, { backgroundColor: t.colors.ink, paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.back}
          hitSlop={8}
        >
          <Text style={{ fontFamily: t.font.mono, fontSize: 20, color: t.colors.paperDim }}>←</Text>
        </Pressable>
        <Text style={{ fontFamily: t.font.brand, fontSize: 22, letterSpacing: 1, color: t.colors.paper }}>
          PROFILE
        </Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
        {/* Overall — THE hero number, Kesar (one per screen). */}
        <View style={styles.hero} accessible accessibilityLabel={`Overall score ${data.overall}. ${data.rounds} rounds. Streak ${data.globalStreak}.`}>
          <Text style={{ fontFamily: t.font.monoBold, fontSize: 56, color: t.colors.kesar }}>
            {data.overall}
          </Text>
          <Text style={{ fontFamily: t.font.mono, fontSize: 12, letterSpacing: 2, color: t.colors.paperDim }}>
            {`${data.rounds} ROUNDS${data.globalStreak >= 2 ? `  ·  STREAK ${data.globalStreak}` : ''}`}
          </Text>
        </View>

        {/* Six categories — one system, six moods (per-topic accent). */}
        {TOPICS.map(({ id, name, bankTopic }) => {
          const s = data.byTopic.get(bankTopic);
          const a = acc(themedHues[id]);
          const played = s !== undefined && s.rounds > 0;
          return (
            <View
              key={id}
              style={[styles.row, { backgroundColor: t.colors.ink2 }]}
              accessible
              accessibilityLabel={
                played
                  ? `${name}: score ${s.rating}, ${s.rounds} rounds, ${s.solved} solved${s.streak >= 2 ? `, streak ${s.streak}` : ''}`
                  : `${name}: not yet played`
              }
            >
              {/* The category's Rekha — its accent, full height. */}
              <View style={[styles.rekha, { backgroundColor: played ? a.main : t.colors.paperDim }]} />
              <View style={styles.rowBody}>
                <Text style={{ fontFamily: t.font.brand, fontSize: 15, letterSpacing: 1, color: t.colors.paper }}>
                  {name}
                </Text>
                <Text style={{ fontFamily: t.font.mono, fontSize: 11, letterSpacing: 0.5, color: t.colors.paperDim, marginTop: 3 }}>
                  {played
                    ? `${s.rounds} played · ${s.solved} solved${s.streak >= 2 ? ` · streak ${s.streak}` : ''}`
                    : 'unplayed — first solve starts the climb'}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: t.font.monoBold,
                  fontSize: 24,
                  color: played ? a.bright : t.colors.paperDim,
                }}
              >
                {s?.rating ?? 0}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  back: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  body: { paddingHorizontal: 20, gap: 10 },
  hero: { alignItems: 'center', paddingVertical: 18, gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 64,
    paddingRight: 18,
  },
  rekha: { width: 4, alignSelf: 'stretch' },
  rowBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
});
