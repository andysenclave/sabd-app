/**
 * Topic card (T19, locked 8b): accent Rekha top edge, scattered glyph wallpaper
 * (opacity .08–.15 — wallpaper, not illustration), rating at hero position in the
 * accent with a soft glow; UNPLAYED = dim ◇, no glow; topics with no words in the
 * bank yet = SOON (disabled, dimmer still).
 */
import { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { useTheme } from '../theme';
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
  const accent = t.accentFor(topic.id);
  const soon = state.kind === 'soon';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${topic.name}${soon ? ', coming soon' : ''}`}
      accessibilityState={{ selected, disabled: soon }}
      disabled={soon}
      onPress={() => onSelect(topic)}
      style={[
        styles.card,
        { backgroundColor: t.colors.ink2 },
        selected && { borderColor: accent, borderWidth: 2 },
        soon && { opacity: 0.45 },
      ]}
    >
      {/* Accent Rekha top edge. */}
      <View style={[styles.edge, { backgroundColor: accent }]} />

      {/* Scatter wallpaper. */}
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
              color: accent,
              transform: [{ rotate: `${g.rotate}deg` }],
              ...(g.mono ? { fontFamily: t.font.monoBold } : {}),
            }}
          >
            {g.ch}
          </Text>
        ))}
      </View>

      <View style={styles.body}>
        <Text style={[styles.name, { fontFamily: t.font.displayHeavy, color: t.colors.paper }]}>
          {topic.name}
        </Text>
        <View style={{ flex: 1 }} />
        {state.kind === 'played' ? (
          <View style={styles.statRow}>
            <Text style={{ color: accent, fontSize: 10 }}>◆</Text>
            <Text
              style={{
                fontFamily: t.font.monoBold,
                fontSize: 25,
                color: t.accentFor(topic.id, undefined, 0.8),
                textShadowColor: t.accentFor(topic.id, 0.75),
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 16, // the glow
              }}
            >
              {state.rating}
            </Text>
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
    borderRadius: 12,
    overflow: 'hidden',
  },
  edge: { height: 3 },
  body: { flex: 1, paddingHorizontal: 15, paddingVertical: 14 },
  name: { fontSize: 16, letterSpacing: 0.5 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingBottom: 6 },
});
