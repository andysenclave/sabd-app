/**
 * Hint bar (T16) — POSITION / LETTERS, equal weight, 48px (DESIGN-SYSTEM §4/§6).
 * ◇ accent diamond + cost when available; spent = ◆ dim + struck label. Buttons
 * disable on first press (the machine is also single-use — belt and braces per the
 * Part-A rapid-tap rule) and while input is locked.
 */
import { memo } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import type { PaidHint } from '@sabd/contracts';

import { useTheme } from '../../theme';
import { gameConfig } from '../../round/config';

export interface HintBarProps {
  spent: readonly PaidHint[];
  disabled?: boolean;
  onHint: (hint: PaidHint) => void;
}

const HINTS: { id: PaidHint; label: string }[] = [
  { id: 'position', label: 'POSITION' },
  { id: 'letters', label: 'LETTERS' },
];

export const HintBar = memo(function HintBar({ spent, disabled = false, onHint }: HintBarProps) {
  const t = useTheme();

  return (
    <View style={styles.bar}>
      {HINTS.map(({ id, label }) => {
        const isSpent = spent.includes(id);
        const inactive = isSpent || disabled;
        const a11yLabel = isSpent
          ? `${label} hint, already used`
          : disabled
            ? `${label} hint, unavailable`
            : `${label} hint, costs ${gameConfig.hintCostSec[id]} seconds`;
        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={a11yLabel}
            accessibilityState={{ disabled: inactive }}
            disabled={inactive}
            onPress={() => onHint(id)}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: isSpent ? 'rgba(34,38,52,.45)' : t.colors.ink2 },
              pressed && !inactive && { opacity: 0.7 },
            ]}
          >
            <Text style={{ color: isSpent ? t.colors.paperDim : t.accent(), fontSize: 11 }}>
              {isSpent ? '◆' : '◇'}
            </Text>
            <Text
              style={[
                styles.label,
                {
                  fontFamily: t.font.mono,
                  color: isSpent ? t.colors.paperDim : t.colors.paper,
                  textDecorationLine: isSpent ? 'line-through' : 'none',
                },
              ]}
            >
              {label}
            </Text>
            {!isSpent && (
              <Text style={[styles.cost, { fontFamily: t.font.mono, color: t.colors.paperDim }]}>
                −{gameConfig.hintCostSec[id]}s
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 10, paddingHorizontal: 22, paddingBottom: 14 },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: { fontSize: 12, letterSpacing: 2 },
  cost: { fontSize: 11 },
});
