/**
 * Slot row (T14) — the word, rendered as slots hanging BENEATH the Rekha.
 *
 * DESIGN-SYSTEM §2/§4: square top, radius only on the bottom (0 0 8 8), a hair of air below
 * the rail. States come from tokens:
 *   empty    — faint fill
 *   focused  — slightly brighter fill + an accent underscore stub (no glyph)
 *   typed    — raised ink-2 surface, paper glyph
 *   given    — position-hint letter: accent-colored glyph, locked (backspace skips it)
 *   correct  — solve state, accent glyph
 *   wrong    — signal-tinted glyph (transient; the RAIL shakes, slots stay put)
 *
 * The clamp for 3–8 letters keeps everything on one row (see slotLayout).
 */
import { memo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';

import { useTheme } from '../../theme';
import { slotMetrics } from '../../round/slotLayout';

export type SlotState = 'empty' | 'focused' | 'typed' | 'given' | 'correct' | 'wrong';

export interface SlotModel {
  char?: string;
  state: SlotState;
}

export interface SlotRowProps {
  slots: readonly SlotModel[];
  accentColor?: string;
}

export const SlotRow = memo(function SlotRow({ slots, accentColor }: SlotRowProps) {
  const t = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const accent = accentColor ?? t.accent();
  const m = slotMetrics(slots.length, screenWidth);

  const filledCount = slots.filter((s) => s.state !== 'empty' && s.state !== 'focused').length;

  const bgFor = (state: SlotState): string => {
    switch (state) {
      case 'typed':
      case 'given':
      case 'correct':
      case 'wrong':
        return t.colors.ink2;
      case 'focused':
        return t.colors.slotFocused;
      case 'empty':
        return t.colors.slotEmpty;
    }
  };

  const glyphColorFor = (state: SlotState): string => {
    switch (state) {
      case 'given':
      case 'correct':
        return accent;
      case 'wrong':
        return t.colors.signal;
      default:
        return t.colors.paper;
    }
  };

  return (
    <View
      style={styles.row}
      accessibilityRole="text"
      accessibilityLabel={`Guess, ${slots.length} letters, ${filledCount} entered`}
    >
      {slots.map((s, i) => (
        <View
          key={i}
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.slot,
            {
              width: m.width,
              height: m.height,
              marginHorizontal: m.gap / 2,
              backgroundColor: bgFor(s.state),
            },
          ]}
        >
          {s.state === 'focused' ? (
            <View style={[styles.stub, { backgroundColor: accent }]} />
          ) : (
            <Text
              style={{
                fontFamily: t.font.monoBold,
                fontSize: m.glyph,
                color: glyphColorFor(s.state),
              }}
            >
              {s.char ?? ''}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end' },
  slot: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // focused underscore stub sits near the bottom of the slot
  stub: { width: 16, height: 3, marginBottom: 10 },
});
