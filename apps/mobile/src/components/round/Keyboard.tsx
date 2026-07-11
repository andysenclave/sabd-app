/**
 * Custom in-app keyboard (T12).
 *
 * DESIGN-SYSTEM §4: 3 rows, 44px keys, Martian Mono 13px. Enter (⏎) and Backspace (⌫)
 * are keys we own. There is NO system keyboard and NO hidden TextInput — presses append
 * to a string in the round state. Light haptic per press (gated by `hapticsEnabled`); the
 * whole keyboard disables on input lock (post-round).
 */
import { memo, useCallback } from 'react';
import { View, Pressable, Text, StyleSheet, type GestureResponderEvent } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../../theme';

export type KeyValue =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'
  | 'ENTER' | 'BACKSPACE';

interface Row {
  keys: KeyValue[];
  pad: number;
}

const ROWS: Row[] = [
  { keys: ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'], pad: 0 },
  { keys: ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'], pad: 18 },
  { keys: ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE'], pad: 0 },
];

const LABEL: Partial<Record<KeyValue, string>> = { ENTER: '⏎', BACKSPACE: '⌫' };
const isSpecial = (k: KeyValue): boolean => k === 'ENTER' || k === 'BACKSPACE';

export interface KeyboardProps {
  onKey: (key: KeyValue) => void;
  /** Input lock (post-round). Keys stop responding and dim. */
  disabled?: boolean;
  /** Config flag from settings (§ haptics ledger). Defaults on. */
  hapticsEnabled?: boolean;
}

export const Keyboard = memo(function Keyboard({
  onKey,
  disabled = false,
  hapticsEnabled = true,
}: KeyboardProps) {
  const t = useTheme();

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
        <View key={i} style={[styles.row, { paddingHorizontal: row.pad }]}>
          {row.keys.map((k) => {
            const special = isSpecial(k);
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
                    backgroundColor: t.colors.ink2,
                    flexGrow: special ? 1.4 : 1,
                    flexBasis: 0,
                  },
                  pressed && !disabled && styles.keyPressed,
                ]}
              >
                <Text
                  style={{
                    fontFamily: t.font.mono,
                    fontSize: 13,
                    color: special ? t.colors.paperDim : t.colors.paper,
                  }}
                >
                  {LABEL[k] ?? k}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  pad: { flexDirection: 'column', gap: 6, paddingHorizontal: 8 },
  padDisabled: { opacity: 0.4 },
  row: { flexDirection: 'row', gap: 5 },
  key: {
    minHeight: 44,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: { opacity: 0.6 },
});
