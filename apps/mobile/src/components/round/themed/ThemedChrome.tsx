/**
 * Shared chrome for themed round screens (ported from
 * docs/new-design/tsx-export/themed/ThemedChrome.tsx). Every visual knob is a prop so
 * each category file states its own look; structure (glance bar → hint dock → keyboard)
 * stays identical to the locked skeleton. Behavior (haptics, disabled/spent state,
 * accessibility labels) matches the app's existing HintBar/Keyboard exactly — only the
 * palette is parametrized, not the interaction model.
 */
import { memo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { PaidHint } from '@sabd/contracts';

import { gameConfig } from '../../../round/config.ts';
import type { KeyValue } from '../../../round/types.ts';
import { fontFamily } from '../../../theme/fonts.ts';

export interface TopBarProps {
  label: string;
  labelColor: string;
  labelFont?: string;
  rating: number;
  diamondColor: string;
  textColor: string;
}

export const TopBar = memo(function TopBar({
  label,
  labelColor,
  labelFont,
  rating,
  diamondColor,
  textColor,
}: TopBarProps) {
  return (
    <View style={styles.topBar}>
      <Text
        style={{
          fontFamily: labelFont ?? fontFamily.displayHeavy,
          fontSize: 16,
          letterSpacing: 1.5,
          color: labelColor,
        }}
      >
        {label}
      </Text>
      <View style={styles.topBarRating}>
        <Text style={{ color: diamondColor, fontSize: 10 }}>◆</Text>
        <Text style={{ fontFamily: fontFamily.mono, fontSize: 14, color: textColor }}>{rating}</Text>
      </View>
    </View>
  );
});

export interface HintDockProps {
  bg: string;
  spentBg?: string;
  border: string;
  radius: number;
  accent: string;
  text: string;
  dim: string;
  spent: readonly PaidHint[];
  disabled?: boolean;
  onHint: (hint: PaidHint) => void;
}

const HINTS: { id: PaidHint; label: string }[] = [
  { id: 'position', label: 'POSITION' },
  { id: 'letters', label: 'LETTERS' },
];

export const HintDock = memo(function HintDock({
  bg,
  spentBg = 'rgba(0,0,0,.3)',
  border,
  radius,
  accent,
  text,
  dim,
  spent,
  disabled = false,
  onHint,
}: HintDockProps) {
  return (
    <View style={styles.hintDock}>
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
              styles.hintButton,
              {
                backgroundColor: isSpent ? spentBg : bg,
                borderColor: isSpent ? 'transparent' : border,
                borderRadius: radius,
              },
              pressed && !inactive && { opacity: 0.7 },
            ]}
          >
            <Text style={{ color: isSpent ? dim : accent, fontSize: 11 }}>{isSpent ? '◆' : '◇'}</Text>
            <Text
              style={[
                styles.hintLabel,
                {
                  fontFamily: fontFamily.mono,
                  color: isSpent ? dim : text,
                  textDecorationLine: isSpent ? 'line-through' : 'none',
                },
              ]}
            >
              {label}
            </Text>
            {!isSpent && (
              <Text style={[styles.hintCost, { fontFamily: fontFamily.mono, color: dim }]}>
                −{gameConfig.hintCostSec[id]}s
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
});

interface KeyRow {
  keys: KeyValue[];
  pad: number;
}

const ROWS: KeyRow[] = [
  { keys: ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'], pad: 0 },
  { keys: ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'], pad: 18 },
  { keys: ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE'], pad: 0 },
];

const KEY_LABEL: Partial<Record<KeyValue, string>> = { ENTER: '⏎', BACKSPACE: '⌫' };
const isSpecialKey = (k: KeyValue): boolean => k === 'ENTER' || k === 'BACKSPACE';

export interface ThemedKeyboardProps {
  keyBg: string;
  keyBorder?: string;
  radius: number;
  text: string;
  dim: string;
  onKey: (key: KeyValue) => void;
  disabled?: boolean;
  hapticsEnabled?: boolean;
}

export const ThemedKeyboard = memo(function ThemedKeyboard({
  keyBg,
  keyBorder,
  radius,
  text,
  dim,
  onKey,
  disabled = false,
  hapticsEnabled = true,
}: ThemedKeyboardProps) {
  const press = useCallback(
    (key: KeyValue) => {
      if (disabled) return;
      if (hapticsEnabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onKey(key);
    },
    [disabled, hapticsEnabled, onKey],
  );

  return (
    <View style={[styles.pad, disabled && styles.padDisabled]}>
      {ROWS.map((row, i) => (
        <View key={i} style={[styles.keyRow, { paddingHorizontal: row.pad }]}>
          {row.keys.map((k) => {
            const special = isSpecialKey(k);
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={k === 'ENTER' ? 'Enter' : k === 'BACKSPACE' ? 'Backspace' : k}
                accessibilityState={{ disabled }}
                disabled={disabled}
                onPress={(_e: GestureResponderEvent) => press(k)}
                hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                style={({ pressed }) => [
                  styles.key,
                  {
                    backgroundColor: keyBg,
                    borderColor: keyBorder,
                    borderWidth: keyBorder ? 1 : 0,
                    borderRadius: radius,
                    flexGrow: special ? 1.4 : 1,
                    flexBasis: 0,
                  },
                  pressed && !disabled && styles.keyPressed,
                ]}
              >
                <Text style={{ fontFamily: fontFamily.mono, fontSize: 13, color: special ? dim : text }}>
                  {KEY_LABEL[k] ?? k}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
});

export interface DescriptionProps {
  color: string;
  font?: string;
  fontSize?: number;
  children: string;
}

export const Description = memo(function Description({ color, font, fontSize, children }: DescriptionProps) {
  return (
    <Text style={[styles.description, { fontFamily: font ?? fontFamily.body, fontSize: fontSize ?? 15, color }]}>
      {children}
    </Text>
  );
});

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22 },
  topBarRating: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintDock: { flexDirection: 'row', gap: 10, paddingHorizontal: 22, paddingBottom: 14 },
  hintButton: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  hintLabel: { fontSize: 12, letterSpacing: 2 },
  hintCost: { fontSize: 11 },
  pad: { flexDirection: 'column', gap: 6, paddingHorizontal: 8 },
  padDisabled: { opacity: 0.4 },
  keyRow: { flexDirection: 'row', gap: 5 },
  key: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  keyPressed: { opacity: 0.6 },
  description: {
    height: 44,
    paddingTop: 20,
    paddingHorizontal: 44,
    textAlign: 'center',
    lineHeight: 21,
  },
});
