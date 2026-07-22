/**
 * 13b · Category Detail (P4-T10 growth + versus). The novel visual: a MONOTONIC climb
 * by round — it never falls, so the chart is progress, not performance. Versus is shown
 * as record, not rating (hard rule 2); until 1v1 ships (Phase 5) it's an honest empty
 * state. A 6-category switcher jumps sideways.
 */
import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TopicId } from '@sabd/contracts';

import { fontFamily as font } from '../../src/theme/fonts.ts';
import { dash, accentFor, fmt } from '../../src/dashboard/tokens.ts';
import { DashHeader, DASH_TOP, BackLink, StepChart, useScrollPad } from '../../src/dashboard/components.tsx';
import { loadCategory } from '../../src/dashboard/load.ts';

const VALID: TopicId[] = ['gaming', 'space', 'music', 'internet', 'food', 'world'];

export default function CategoryDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pad = useScrollPad();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ id: string }>();
  const id: TopicId = VALID.includes(params.id as TopicId) ? (params.id as TopicId) : 'gaming';

  const { detail, minis } = useMemo(() => loadCategory(id), [id]);
  const a = accentFor(id);
  const chartW = Math.min(width - 48, 340);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + DASH_TOP }]}>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: pad }]} showsVerticalScrollIndicator={false}>
        <DashHeader right={<BackLink onPress={() => router.back()} />} />

        {/* title + score */}
        <View style={styles.titleRow}>
          <View style={{ gap: 5 }}>
            <Text style={{ fontFamily: font.displayHeavy, fontSize: 24, letterSpacing: 0.3, color: a.label }}>{detail.name}</Text>
            <Text style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: 2, color: dash.inkDim }}>YOUR CLIMB</Text>
          </View>
          <Text style={{ fontFamily: font.monoBold, fontSize: 36, lineHeight: 34, letterSpacing: -1, color: a.bright }}>{fmt(detail.score)}</Text>
        </View>

        {/* the climb */}
        <View style={{ marginTop: 22, alignItems: 'center' }}>
          {detail.games === 0 ? (
            <View style={[styles.emptyChart, { width: chartW }]}>
              <Text style={{ fontFamily: font.mono, fontSize: 11, color: dash.inkDim }}>the line only goes up from here</Text>
            </View>
          ) : (
            <StepChart
              vals={detail.series}
              width={chartW}
              height={150}
              accent={a}
              milestones={detail.milestones.map((index) => ({ index }))}
            />
          )}
          <View style={[styles.chartAxis, { width: chartW }]}>
            <Text style={styles.axisLabel}>round 1</Text>
            <Text style={styles.axisLabel}>{detail.games} · never falls</Text>
          </View>
        </View>

        {/* three stats */}
        <View style={styles.stats}>
          <Stat k="GAMES" v={fmt(detail.games)} />
          <Stat k="SOLVE RATE" v={`${detail.solvePct}%`} />
          <Stat k="STREAK" v={`${detail.streak}`} sub={` / ${detail.bestStreak}`} accent={a.bright} />
        </View>

        {/* versus — record, not rating */}
        <View style={styles.versus}>
          <View style={styles.versusHead}>
            <Text style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: 2, color: a.label }}>VERSUS</Text>
            <Text style={{ fontFamily: font.mono, fontSize: 9, color: dash.inkTertiary }}>record, not rating</Text>
          </View>
          {detail.versus ? (
            <View style={styles.versusBody}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                <Text style={{ fontFamily: font.monoBold, fontSize: 24, color: a.bright }}>{detail.versus.wins}</Text>
                <Text style={{ fontFamily: font.monoBold, fontSize: 15, color: dash.inkTertiary }}>–</Text>
                <Text style={{ fontFamily: font.monoBold, fontSize: 18, color: dash.inkDim }}>{detail.versus.losses}</Text>
              </View>
              <Text style={{ fontFamily: font.mono, fontSize: 11, color: dash.ink2 }}>
                {Math.round((detail.versus.wins / (detail.versus.wins + detail.versus.losses)) * 100)}% win
              </Text>
              <View style={{ flex: 1 }} />
              <View style={{ flexDirection: 'row', gap: 5 }}>
                {detail.versus.last5.map((w, i) => (
                  <View key={i} style={w ? [styles.dotWon, { backgroundColor: a.main }] : styles.dotLost} />
                ))}
              </View>
            </View>
          ) : (
            <Text style={{ fontFamily: font.mono, fontSize: 11, color: dash.inkDim, marginTop: 4 }}>
              no ranked games yet — head-to-head arrives soon.
            </Text>
          )}
        </View>

        {/* switcher */}
        <Text style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: 2, color: dash.inkDim, marginTop: 26 }}>CHECK ANOTHER CATEGORY</Text>
        <View style={styles.miniGrid}>
          {minis.map((m) => {
            const ma = accentFor(m.id);
            return (
              <Pressable
                key={m.id}
                onPress={() => router.setParams({ id: m.id })}
                accessibilityRole="button"
                accessibilityLabel={`${m.name}: ${m.score} points`}
                style={styles.miniCard}
              >
                <Text style={{ fontFamily: font.mono, fontSize: 8, letterSpacing: 0.5, color: dash.inkDim }}>{m.name}</Text>
                <Text style={{ fontFamily: font.monoBold, fontSize: 14, color: ma.bright }}>{fmt(m.score)}</Text>
                <View style={{ marginTop: 4 }}>
                  <StepChart vals={m.series} width={84} height={26} accent={ma} strokeWidth={2} showSummit={false} padTop={4} padBottom={3} />
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ k, v, sub, accent }: { k: string; v: string; sub?: string; accent?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={{ fontFamily: font.mono, fontSize: 9, letterSpacing: 1, color: dash.inkDim }}>{k}</Text>
      <Text style={{ fontFamily: font.monoBold, fontSize: 22, color: accent ?? dash.ink }}>
        {v}
        {sub && <Text style={{ color: dash.inkTertiary, fontSize: 13 }}>{sub}</Text>}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dash.ground },
  body: { paddingHorizontal: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 26 },
  emptyChart: { height: 150, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: dash.inset },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisLabel: { fontFamily: font.mono, fontSize: 9, color: dash.inkTertiary },
  stats: { flexDirection: 'row', gap: 12, marginTop: 26 },
  stat: { flex: 1, backgroundColor: dash.inset, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 14, gap: 6 },
  versus: { marginTop: 14, backgroundColor: dash.inset, borderRadius: 14, padding: 16 },
  versusHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
  versusBody: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dotWon: { width: 10, height: 10, borderRadius: 5 },
  dotLost: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: dash.inkFaint },
  miniGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 14 },
  miniCard: { width: '31%', backgroundColor: dash.inset, borderRadius: 12, padding: 11, gap: 5 },
});
