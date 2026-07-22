/**
 * 13a · Profile Hub (P4-T10, the rating dashboard) — the identity landing.
 *
 * Modern indigo-ink skin, POINTS ONLY (hard rule 1: no rating, no rank, no skill
 * signal). Categories sort strong → building; the weakest PLAYED category is rendered
 * as an accent-lit invitation ("close it"), never a scold (hard rule 3). Real data
 * from the on-device event log via loadProfile; the browser preview uses sample data.
 */
import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fontFamily as font } from '../src/theme/fonts.ts';
import { dash, accentFor, fmt } from '../src/dashboard/tokens.ts';
import { DashHeader, InvestedBar, useScrollPad } from '../src/dashboard/components.tsx';
import { loadProfile } from '../src/dashboard/load.ts';
import type { CategoryDatum, ProfileData } from '../src/dashboard/data.ts';

export default function ProfileHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pad = useScrollPad();
  // Scores can't change while the screen is open — load once. now() is fine here
  // (not scoring math): it only sets the 7-day window.
  const data = useMemo<ProfileData>(() => loadProfile(Date.now()), []);
  const leader = data.categories[0]?.score ?? 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20 }]}>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: pad }]} showsVerticalScrollIndicator={false}>
        <DashHeader
          right={
            <>
              <Text style={{ fontFamily: font.mono, fontSize: 11, color: dash.ink2 }}>{'@you'}</Text>
              <Text style={{ fontFamily: font.mono, fontSize: 9.5, letterSpacing: 0.5, color: dash.inkDim, marginTop: 3 }}>
                {data.daysPlayed} {data.daysPlayed === 1 ? 'day' : 'days'} played
              </Text>
            </>
          }
        />

        {/* total-points band — the one Kesar hero number */}
        <View style={styles.totalBand}>
          <View>
            <Text style={styles.totalLabel}>TOTAL POINTS</Text>
            <View style={styles.totalRow}>
              <Text style={{ color: dash.kesar, fontSize: 14 }}>◆</Text>
              <Text style={styles.totalNumber}>{fmt(data.total)}</Text>
            </View>
          </View>
          {data.globalStreak >= 2 && (
            <View style={{ alignItems: 'flex-end', paddingBottom: 4 }}>
              <Text style={{ fontFamily: font.monoBold, fontSize: 16, color: dash.ink }}>{data.globalStreak}-day</Text>
              <Text style={{ fontFamily: font.mono, fontSize: 9, letterSpacing: 1.5, color: dash.inkDim, marginTop: 2 }}>STREAK</Text>
            </View>
          )}
        </View>

        <View style={styles.sectionRow}>
          <Text style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: 2, color: dash.inkDim }}>BY CATEGORY</Text>
          <Text style={{ fontFamily: font.mono, fontSize: 9, letterSpacing: 1, color: dash.inkTertiary }}>strong → building</Text>
        </View>

        <View style={{ gap: 22, marginTop: 16 }}>
          {data.categories.map((c) => (
            <CategoryRow
              key={c.id}
              c={c}
              leader={leader}
              isGap={data.gap?.id === c.id}
              gapToPass={data.gap?.id === c.id ? data.gap.toPass : undefined}
              gapCopy={data.gap?.id === c.id ? `+${fmt(data.gap.toPass)} to pass ${data.gap.passName}` : undefined}
              onPress={() => router.push({ pathname: '/category/[id]', params: { id: c.id } })}
            />
          ))}
        </View>

        <Text style={styles.footHint}>tap a category → its climb</Text>

        {/* hub nav — rewards + leaderboard */}
        <View style={styles.hubNav}>
          <Pressable onPress={() => router.push('/rewards')} accessibilityRole="button" style={styles.hubLink} hitSlop={8}>
            <Text style={styles.hubLinkText}>◆ REWARDS</Text>
          </Pressable>
          <View style={styles.hubDivider} />
          <Pressable onPress={() => router.push('/leaderboard')} accessibilityRole="button" style={styles.hubLink} hitSlop={8}>
            <Text style={styles.hubLinkText}>▲ LEADERBOARD</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function CategoryRow({
  c, leader, isGap, gapToPass, gapCopy, onPress,
}: {
  c: CategoryDatum; leader: number; isGap: boolean; gapToPass?: number; gapCopy?: string; onPress: () => void;
}) {
  const a = accentFor(c.id);
  const pct = leader > 0 ? (c.score / leader) * 100 : 0;
  const played = c.rounds > 0;
  const meta = played
    ? `streak ${c.streak} · ${c.solvePct}% solve`
    : 'unplayed — first solve starts the climb';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${c.name}: ${c.score} points${played ? `, streak ${c.streak}, ${c.solvePct}% solve` : ', not yet played'}. Open its climb.`}
      style={isGap ? [styles.gapCard, { backgroundColor: a.softFill, borderColor: a.border }] : undefined}
    >
      <View style={{ gap: isGap ? 10 : 8 }}>
        <View style={styles.rowTop}>
          <Text style={{ fontFamily: font.displayHeavy, fontSize: 15, letterSpacing: 0.3, color: played ? a.label : dash.inkDim }}>
            {c.name}
          </Text>
          <Text style={{ fontFamily: font.monoBold, fontSize: 19, letterSpacing: -0.5, color: played ? a.bright : dash.inkFaint }}>
            {fmt(c.score)}
          </Text>
        </View>

        <InvestedBar
          pct={pct}
          color={played ? a.main : dash.inkFaint}
          glow={a.glow}
          markerPct={isGap && gapToPass !== undefined && leader > 0 ? ((c.score + gapToPass) / leader) * 100 : undefined}
        />

        {isGap ? (
          <View style={styles.rowTop}>
            <Text style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: 0.3, color: a.gain }}>
              7d ▲ +{fmt(c.gain7d)} · {gapCopy}
            </Text>
            <Text style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: 1, color: a.bright }}>CLOSE IT →</Text>
          </View>
        ) : (
          <Text style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: 0.3, color: dash.inkDim }}>
            {played && <Text style={{ color: a.gain }}>7d ▲ +{fmt(c.gain7d)} · </Text>}
            {meta}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dash.ground },
  body: { paddingHorizontal: 24 },
  totalBand: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 26,
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: dash.hairline,
  },
  totalLabel: { fontFamily: font.mono, fontSize: 9.5, letterSpacing: 3, color: dash.inkDim },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 9, marginTop: 6 },
  totalNumber: { fontFamily: font.monoBold, fontSize: 42, lineHeight: 44, letterSpacing: -2, color: dash.kesar },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  gapCard: { padding: 15, marginHorizontal: -15, borderRadius: 16, borderWidth: 1 },
  footHint: { textAlign: 'center', fontFamily: font.mono, fontSize: 10, letterSpacing: 1, color: dash.inkTertiary, marginTop: 24 },
  hubNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 22, paddingTop: 20, borderTopWidth: 1, borderTopColor: dash.hairline },
  hubLink: { minHeight: 44, justifyContent: 'center' },
  hubLinkText: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1.5, color: dash.ink2 },
  hubDivider: { width: 1, height: 14, backgroundColor: dash.hairline },
});
