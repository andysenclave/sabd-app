/**
 * Topic card (rev. 3, mockup 10a / ThemedHomeScreen.tsx): each category owns its own
 * color — two-layer rail top edge (4px accent + 2px darkened-same-hue underside),
 * scattered glyph wallpaper in accent, rating hero in accent `bright`. UNPLAYED = dim
 * ◇, no glow; no words in the bank yet = SOON (disabled, dimmer still). The
 * center-seam fold (`cardSeam`, a neutral dark line — not hue-tinted) runs across
 * every card. The scanline overlay stays GAMING-ONLY, its category signature.
 */
import { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { useTheme } from '../theme';
import { themedHues, acc, ok } from '../theme/themed/themedTokens.ts';
import { Scanlines } from '../components/round/themed/Scanlines';
import { SCATTER, type TopicMeta } from './topics';

export type TopicCardState =
  | { kind: 'played'; rating: number }
  | { kind: 'unplayed' }
  | { kind: 'soon' };

export interface TopicCardProps {
  topic: TopicMeta;
  state: TopicCardState;
  selected: boolean;
  onSelect: (topic: TopicMeta) => void;
}

export const TopicCard = memo(function TopicCard({ topic, state, selected, onSelect }: TopicCardProps) {
  const t = useTheme();
  const hue = themedHues[topic.id];
  const a = acc(hue);
  const isGaming = topic.id === 'gaming';
  const soon = state.kind === 'soon';
  const a11yLabel = `${topic.name}${
    soon ? ', coming soon' : state.kind === 'played' ? `, rating ${state.rating}` : ', not yet played'
  }`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected, disabled: soon }}
      disabled={soon}
      onPress={() => onSelect(topic)}
      style={[
        styles.card,
        // Every card gets a defined edge, not just the selected one — some hues
        // (gaming's green especially) don't lift off the warm-brown surface fill on
        // their own, and a border-only-when-selected card was reading as barely
        // there against the page background on a real phone.
        // Card fill is a bit brighter than the shared `ink2`/retro-surface token —
        // Home-only, deliberately not touching the round screens' shared surface.
        { backgroundColor: '#322A1C', borderColor: a.hintBorder, borderWidth: 1 },
        selected && { borderColor: a.main, borderWidth: 2 },
        soon && { opacity: 0.45 },
      ]}
    >
      {/* Two-layer accent rail top edge, this topic's own hue. */}
      <View>
        <View style={[styles.edge, { backgroundColor: a.main }]} />
        <View style={[styles.edgeUnderside, { backgroundColor: ok(0.5, 0.12, hue) }]} />
      </View>

      {/* Center-seam fold, every card. Scanline overlay stays gaming-only, its category signature. */}
      <View style={[styles.fold, { backgroundColor: t.retro.cardSeam }]} pointerEvents="none" />
      {isGaming && <Scanlines opacity={0.16} />}

      {/* Scatter wallpaper — this topic's accent hue. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {SCATTER[topic.id].map((g, i) => (
          <Text
            key={i}
            style={{
              position: 'absolute',
              right: g.right,
              ...(g.top !== undefined ? { top: g.top } : { bottom: g.bottom }),
              fontSize: g.size,
              opacity: g.opacity,
              color: a.main,
              transform: [{ rotate: `${g.rotate}deg` }],
              ...(g.mono ? { fontFamily: t.font.monoBold } : {}),
            }}
          >
            {g.ch}
          </Text>
        ))}
      </View>

      <View style={styles.body}>
        <Text style={[styles.name, { fontFamily: t.font.brand, color: t.colors.paper }]}>{topic.name}</Text>
        <View style={{ flex: 1 }} />
        {state.kind === 'played' ? (
          <View style={styles.statRow}>
            <Text style={{ color: a.main, fontSize: 10 }}>◆</Text>
            <Text style={{ fontFamily: t.font.monoBold, fontSize: 25, color: a.bright }}>{state.rating}</Text>
          </View>
        ) : (
          <View style={styles.statRow}>
            <Text style={{ color: t.colors.paperDim, fontSize: 10 }}>◇</Text>
            <Text
              style={{
                fontFamily: t.font.mono,
                fontSize: 14,
                letterSpacing: 1,
                color: t.colors.paperDim,
                lineHeight: 25,
              }}
            >
              {soon ? 'SOON' : 'UNPLAYED'}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 150,
    borderRadius: 4,
    overflow: 'hidden',
  },
  edge: { height: 4 },
  edgeUnderside: { height: 2 },
  fold: { position: 'absolute', left: 0, right: 0, top: '50%', height: 2, zIndex: 2 },
  body: { flex: 1, paddingHorizontal: 15, paddingVertical: 14 },
  name: { fontSize: 17, letterSpacing: 1 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingBottom: 6 },
});
