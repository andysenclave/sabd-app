/**
 * 13c · Rewards (P4-T11). Three layers: the live global-streak milestone (nearest
 * goal, framed as almost-yours), the achievement roster (unlocked/locked), and the
 * earnings feed that teaches scoring passively — every point split into its
 * base/speed/streak/hint components (REAL breakdown from the engine).
 *
 * The achievement roster's thresholds are placeholder (architect FB-006, content-owned);
 * the streak milestone and earnings feed are real.
 */
import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fontFamily as font } from '../src/theme/fonts.ts';
import { dash, dashAccent, fmt } from '../src/dashboard/tokens.ts';
import { DashHeader, BackLink, useScrollPad } from '../src/dashboard/components.tsx';
import { loadRewards } from '../src/dashboard/load.ts';
import type { Earning } from '../src/dashboard/data.ts';

export default function Rewards() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pad = useScrollPad();
  const data = useMemo(() => loadRewards(), []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20 }]}>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: pad }]} showsVerticalScrollIndicator={false}>
        <DashHeader right={<BackLink onPress={() => router.back()} />} />
        <Text style={styles.title}>REWARDS</Text>

        {/* streak milestone — the nearest goal */}
        <View style={styles.streakCard}>
          <View style={styles.rowBetween}>
            <Text style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: 2, color: dash.kesar }}>GLOBAL STREAK</Text>
            {data.streak.next !== null && (
              <Text style={{ fontFamily: font.mono, fontSize: 10, color: dash.inkDim }}>next: {data.streak.next}-day badge</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 10 }}>
            <Text style={{ fontFamily: font.monoBold, fontSize: 36, lineHeight: 36, letterSpacing: -1, color: dash.kesar }}>{data.streak.current}</Text>
            <Text style={{ fontFamily: font.mono, fontSize: 12, color: dash.inkDim }}>days</Text>
          </View>
          <View style={styles.streakTrack}>
            <View style={[styles.streakFill, { width: `${Math.round(data.streak.pct * 100)}%` }]} />
          </View>
          <Text style={{ fontFamily: font.mono, fontSize: 10, color: dash.inkDim, marginTop: 10 }}>{data.streak.copy}</Text>
        </View>

        {/* achievements */}
        <View style={[styles.rowBetween, { marginTop: 26 }]}>
          <Text style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: 2, color: dash.inkDim }}>ACHIEVEMENTS</Text>
          <Text style={{ fontFamily: font.mono, fontSize: 11, color: dash.ink }}>{data.unlockedCount} / {data.totalCount}</Text>
        </View>
        <View style={styles.grid}>
          {data.achievements.map((a) => {
            const color = a.hue !== null ? dashAccent(a.hue).bright : dash.kesar;
            return (
              <View key={a.title} style={[styles.badge, a.unlocked ? styles.badgeOn : styles.badgeOff]}>
                <Text style={{ fontSize: a.unlocked ? 20 : 18, color: a.unlocked ? color : dash.inkFaint }}>{a.icon}</Text>
                <Text style={{ fontFamily: font.mono, fontSize: 8.5, textAlign: 'center', lineHeight: 11, color: a.unlocked ? dash.ink : dash.inkTertiary }}>
                  {a.title}
                </Text>
              </View>
            );
          })}
        </View>

        {/* earnings feed — how points are made */}
        <View style={[styles.rowBetween, { marginTop: 26 }]}>
          <Text style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: 2, color: dash.inkDim }}>RECENT EARNINGS</Text>
          <Text style={{ fontFamily: font.mono, fontSize: 9, color: dash.inkTertiary }}>how points are made</Text>
        </View>
        {data.earnings.length === 0 ? (
          <Text style={{ fontFamily: font.mono, fontSize: 11, color: dash.inkDim, marginTop: 14 }}>
            solve a word and watch the points add up here.
          </Text>
        ) : (
          <View style={styles.feed}>
            {data.earnings.map((e) => <EarningRow key={e.roundId} e={e} />)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const HUES: Record<string, number> = { gaming: 150, space: 255, music: 350, internet: 195, food: 75, world: 300 };

function EarningRow({ e }: { e: Earning }) {
  const dot = e.id !== null ? dashAccent(HUES[e.id]!).main : dash.kesar;
  const chips: { label: string; kind?: 'penalty' }[] = [];
  const b = e.breakdown;
  chips.push({ label: `base ${b.tierBase}` });
  if (b.speedBonus > 0) chips.push({ label: `speed +${b.speedBonus}` });
  if (b.streakBonus > 0) chips.push({ label: `streak +${b.streakBonus}` });
  if (b.hintPenalty < 0) chips.push({ label: `hints ${b.hintPenalty}`, kind: 'penalty' });
  else chips.push({ label: 'no-hints' });

  return (
    <View style={styles.feedRow}>
      <View style={styles.rowBetween}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
          <Text style={{ fontFamily: font.mono, fontSize: 12, color: dash.ink }}>{wordName(e.wordId)}</Text>
        </View>
        <Text style={{ fontFamily: font.monoBold, fontSize: 16, color: dash.kesar }}>+{fmt(e.total)}</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 9 }}>
        {chips.map((c, i) => (
          <Text key={i} style={[styles.chip, c.kind === 'penalty' ? styles.chipPenalty : styles.chipBase]}>{c.label}</Text>
        ))}
      </View>
    </View>
  );
}

/** The bare word id → a readable label (the word text isn't in the event; id suffices). */
function wordName(wordId: string): string {
  return wordId;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dash.ground },
  body: { paddingHorizontal: 24 },
  title: { fontFamily: font.displayHeavy, fontSize: 22, letterSpacing: 0.3, color: dash.ink, marginTop: 24 },
  rowBetween: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  streakCard: { marginTop: 16, backgroundColor: dash.kesarFill, borderWidth: 1, borderColor: dash.kesarBorder, borderRadius: 16, padding: 18 },
  streakTrack: { height: 8, borderRadius: 5, backgroundColor: dash.hairline, overflow: 'hidden', marginTop: 14 },
  streakFill: { height: '100%', borderRadius: 5, backgroundColor: dash.kesar },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11, marginTop: 14 },
  badge: { width: '31%', borderRadius: 12, paddingVertical: 15, paddingHorizontal: 8, alignItems: 'center', gap: 7 },
  badgeOn: { backgroundColor: dash.inset },
  badgeOff: { backgroundColor: 'rgba(233,234,242,0.03)', borderWidth: 1, borderColor: dash.hairline, borderStyle: 'dashed' },
  feed: { marginTop: 14, backgroundColor: dash.hairline, borderRadius: 14, overflow: 'hidden', gap: 1 },
  feedRow: { backgroundColor: dash.inset, paddingVertical: 14, paddingHorizontal: 16 },
  chip: { fontFamily: font.mono, fontSize: 9, borderRadius: 4, paddingVertical: 3, paddingHorizontal: 6, overflow: 'hidden' },
  chipBase: { color: '#A9AEBE', backgroundColor: 'rgba(233,234,242,0.06)' },
  chipPenalty: { color: dash.inkTertiary, backgroundColor: 'rgba(233,234,242,0.04)' },
});
