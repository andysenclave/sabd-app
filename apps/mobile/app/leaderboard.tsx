/**
 * 13d · Leaderboard (P4-T12). Ranked by POINTS (not rating). Presence over podium —
 * "you're on the board," own row pinned via top-5 / gap / neighborhood so you never
 * scroll to find yourself. Ties break to fewer games, then earlier (F16).
 *
 * The populated board needs a ranking backend + display handles (architect FB-007) —
 * on device that isn't live yet, so the honest GUEST state renders (your real score,
 * no fabricated position). The browser preview shows the populated design via samples.
 */
import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fontFamily as font } from '../src/theme/fonts.ts';
import { dash, medals, fmt } from '../src/dashboard/tokens.ts';
import { DashHeader, DASH_TOP, BackLink, useScrollPad } from '../src/dashboard/components.tsx';
import { loadLeaderboard } from '../src/dashboard/load.ts';
import type { LeaderRow } from '../src/dashboard/data.ts';

const TABS = ['GLOBAL', 'GAMING', 'SPACE', 'MUSIC'];

export default function Leaderboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pad = useScrollPad();
  const data = useMemo(() => loadLeaderboard(), []);
  const ranked = data.you !== null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + DASH_TOP }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: pad }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 24 }}>
          <DashHeader right={<BackLink onPress={() => router.back()} />} />
          <Text style={styles.title}>LEADERBOARD</Text>

          <View style={styles.tabs}>
            {TABS.map((t, i) => (
              <Text key={t} style={[styles.tab, i === 0 ? styles.tabOn : styles.tabOff]}>{t}</Text>
            ))}
          </View>

          {/* presence banner */}
          <View style={styles.banner}>
            {ranked ? (
              <>
                <Text style={styles.bannerHead}>You&apos;re on the board.</Text>
                <Text style={styles.bannerSub}>
                  #{fmt(data.you!.rank)} of {fmt(data.you!.total)} · ranked by points. Every word you solve moves you up.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.bannerHead}>Your score: {fmt(data.yourScore)}.</Text>
                <Text style={styles.bannerSub}>
                  The board opens at soft launch — keep climbing and your spot is waiting.
                </Text>
              </>
            )}
          </View>
        </View>

        {ranked && (
          <View style={{ marginTop: 18 }}>
            {data.top.map((r) => <Row key={r.rank} r={r} top={r.rank <= 3} />)}
            <Text style={styles.gap}>· · ·</Text>
            {data.neighbors.map((r) => (r.isYou ? <YouRow key="you" r={r} delta={data.you!.delta} /> : <Row key={r.rank} r={r} />))}
          </View>
        )}

        <View style={{ paddingHorizontal: 24, marginTop: 22 }}>
          <Text style={styles.foot}>
            Ranked by points — play more, climb more. Ties break to fewer games, then who got there first.
            Everyone on the board earned their spot.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ r, top }: { r: LeaderRow; top?: boolean }) {
  const medal = medals[r.rank];
  return (
    <View style={styles.row}>
      {medal ? (
        <View style={[styles.medal, { backgroundColor: medal }]}>
          <Text style={{ fontFamily: font.monoBold, fontSize: 11, color: r.rank === 1 ? '#0B0908' : dash.card }}>{r.rank}</Text>
        </View>
      ) : (
        <Text style={styles.rankNum}>{r.rank}</Text>
      )}
      <Text style={[styles.name, { color: top ? dash.ink : dash.ink2 }]}>{r.name}</Text>
      <Text style={[styles.score, { color: top ? dash.ink : dash.ink2 }]}>{fmt(r.score)}</Text>
    </View>
  );
}

function YouRow({ r, delta }: { r: LeaderRow; delta: number | null }) {
  return (
    <View style={styles.youRow}>
      <Text style={[styles.rankNum, { color: dash.kesar, fontFamily: font.monoBold }]}>{r.rank}</Text>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontFamily: font.monoBold, fontSize: 13, color: dash.kesar }}>{r.name}</Text>
        {delta !== null && delta > 0 && (
          <Text style={{ fontFamily: font.mono, fontSize: 9, color: dash.ink2 }}>▲ {delta} since last visit</Text>
        )}
      </View>
      <Text style={{ fontFamily: font.monoBold, fontSize: 15, color: dash.kesar }}>{fmt(r.score)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dash.ground },
  title: { fontFamily: font.displayHeavy, fontSize: 22, letterSpacing: 0.3, color: dash.ink, marginTop: 24 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 18 },
  tab: { fontFamily: font.mono, fontSize: 10, letterSpacing: 1, borderRadius: 6, paddingVertical: 7, paddingHorizontal: 12, overflow: 'hidden' },
  tabOn: { color: '#0B0908', backgroundColor: dash.kesar },
  tabOff: { color: dash.inkDim, backgroundColor: 'rgba(233,234,242,0.05)' },
  banner: { marginTop: 18, backgroundColor: dash.kesarFill, borderWidth: 1, borderColor: dash.kesarBorder, borderRadius: 16, padding: 16 },
  bannerHead: { fontFamily: font.displayHeavy, fontSize: 16, color: dash.kesar },
  bannerSub: { fontFamily: font.mono, fontSize: 10, lineHeight: 15, color: dash.inkDim, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14, paddingHorizontal: 24 },
  medal: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rankNum: { width: 22, textAlign: 'center', fontFamily: font.mono, fontSize: 13, color: dash.inkDim },
  name: { flex: 1, fontFamily: font.mono, fontSize: 13 },
  score: { fontFamily: font.monoBold, fontSize: 14 },
  gap: { textAlign: 'center', paddingVertical: 10, color: dash.inkFaint, fontFamily: font.mono, fontSize: 12, letterSpacing: 3 },
  youRow: {
    flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 16, paddingHorizontal: 18,
    marginHorizontal: 14, marginVertical: 4, backgroundColor: dash.kesarFill,
    borderWidth: 1, borderColor: 'rgba(242,163,60,0.4)', borderRadius: 14,
  },
  foot: { fontFamily: font.mono, fontSize: 9.5, lineHeight: 15, color: dash.inkTertiary },
});
