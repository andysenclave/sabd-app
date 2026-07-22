/**
 * Shared profile-hub UI — the indigo-ink chrome, the invested bar, and the monotonic
 * step-chart. The LOGO is the real Home/onboarding wordmark (`Wordmark`), not the
 * spec's "Rail" lockup (owner call: one logo across the app).
 */

import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';

import { Wordmark } from '../components/Logo.tsx';
import { fontFamily as font } from '../theme/fonts.ts';
import { dash, type DashAccent } from './tokens.ts';

/**
 * Standard top offset for the dashboards' scroll container — matches Home's
 * `insets.top + 26` so the wordmark sits at the SAME vertical spot on every screen and
 * never jumps when navigating Home → hub → detail.
 */
export const DASH_TOP = 26;

/**
 * Header: the wordmark (left) + a right slot (identity on the hub, a back link
 * elsewhere). The wordmark matches Home EXACTLY — same 148px width, same left edge
 * (paddingHorizontal 24), same top offset (DASH_TOP) — so navigation never resizes or
 * shifts the mark. The row is top-aligned; the wordmark is the tallest element and
 * defines the row, so it always pins to the same spot.
 */
export function DashHeader({ right }: { right: ReactNode }) {
  return (
    <View style={styles.header}>
      <Wordmark width={148} />
      <View style={{ alignItems: 'flex-end', paddingTop: 4 }}>{right}</View>
    </View>
  );
}

/** A "‹ profile" back affordance (44px touch target, mono tertiary ink). */
export function BackLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Back to profile" hitSlop={10} style={styles.backLink}>
      <Text style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: 1, color: dash.inkTertiary }}>‹ profile</Text>
    </Pressable>
  );
}

/** The invested-bar: fill = share of the leader, optional faint marker at a target level. */
export function InvestedBar({ pct, color, glow, markerPct }: { pct: number; color: string; glow: string; markerPct?: number }) {
  return (
    <View style={styles.barOuter}>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${clampPct(pct)}%`, backgroundColor: color, shadowColor: glow }]} />
      </View>
      {markerPct !== undefined && <View style={[styles.barMarker, { left: `${clampPct(markerPct)}%` }]} />}
    </View>
  );
}

const clampPct = (p: number): number => Math.min(100, Math.max(0, p));

// ─── monotonic step-chart ─────────────────────────────────────────────────────

export interface StepGeom {
  d: string;
  area: string;
  x: (i: number) => number;
  y: (v: number) => number;
  last: { x: number; y: number };
}

/** Build a monotonic step path (H then V per round) — matches the mockup's builder. */
export function stepPath(vals: number[], W: number, H: number, pt = 12, pb = 8): StepGeom {
  const n = Math.max(vals.length, 1);
  const max = Math.max(...vals, 1);
  const x = (i: number) => (n === 1 ? 0 : (i / (n - 1)) * W);
  const y = (v: number) => pt + (1 - v / max) * (H - pt - pb);
  let d = `M0 ${y(vals[0] ?? 0).toFixed(1)}`;
  for (let i = 1; i < n; i++) d += ` H${x(i).toFixed(1)} V${y(vals[i] ?? 0).toFixed(1)}`;
  const area = `${d} V${(H - pb).toFixed(1)} H0 Z`;
  return { d, area, x, y, last: { x: x(n - 1), y: y(vals[n - 1] ?? 0) } };
}

export interface Milestone {
  index: number;
}

/**
 * The climb: an area fill + stroke in the accent, a pulsing "now" summit dot, and
 * milestone rings. Pure SVG (react-native-svg) — no CSS. `width`/`height` in px.
 */
export function StepChart({
  vals,
  width,
  height,
  accent,
  strokeWidth = 2.5,
  milestones = [],
  showSummit = true,
  padTop = 12,
  padBottom = 8,
}: {
  vals: number[];
  width: number;
  height: number;
  accent: DashAccent;
  strokeWidth?: number;
  milestones?: Milestone[];
  showSummit?: boolean;
  padTop?: number;
  padBottom?: number;
}) {
  const g = stepPath(vals, width, height, padTop, padBottom);
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Path d={g.area} fill={accent.main} fillOpacity={0.14} />
      <Path d={g.d} stroke={accent.bright} strokeWidth={strokeWidth} strokeLinejoin="round" fill="none" />
      {milestones.map((m) => (
        <Circle
          key={m.index}
          cx={g.x(m.index)}
          cy={g.y(vals[m.index] ?? 0)}
          r={3.5}
          fill={dash.card}
          stroke={accent.label}
          strokeWidth={2}
        />
      ))}
      {showSummit && vals.length > 0 && (
        <>
          <Circle cx={g.last.x} cy={g.last.y} r={7} fill={accent.glow} opacity={0.5} />
          <Circle cx={g.last.x} cy={g.last.y} r={4.5} fill={accent.bright} />
        </>
      )}
    </Svg>
  );
}

/** The screen-standard section label ("BY CATEGORY", "ACHIEVEMENTS", …). */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: 2, color: dash.inkDim }}>{children}</Text>
      {right}
    </View>
  );
}

/** Standard bottom safe-area pad for a scroll view. */
export function useScrollPad(): number {
  return useSafeAreaInsets().bottom + 30;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  backLink: { minHeight: 44, justifyContent: 'center', paddingTop: 4 },
  barOuter: { position: 'relative', justifyContent: 'center' },
  barTrack: { height: 8, borderRadius: 5, backgroundColor: dash.rowFill, overflow: 'hidden' },
  barFill: {
    height: '100%',
    borderRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  barMarker: { position: 'absolute', top: -3, bottom: -3, width: 2, backgroundColor: 'rgba(200,180,220,0.5)' },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
});
