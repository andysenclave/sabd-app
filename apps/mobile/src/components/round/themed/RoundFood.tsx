/**
 * Food & Drink — warm menu / lamp glow (mockup 10f / RoundFood.tsx). Overhead lamp
 * gradient breathes, steam rises off the word, "TODAY'S WORD" menu framing, warm
 * gradient plates for slots.
 */
import { memo, useEffect, useId } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming, interpolate } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { motion as motionTokens, duration as durationTokens } from '@sabd/tokens';

import { useTheme } from '../../../theme';
import { usePingPong, useBlink, useLinearLoop, useDriftStyle } from '../../../theme/themed/ambient.ts';
import { themedHues, acc, ok } from '../../../theme/themed/themedTokens.ts';
import { slotMetrics } from '../../../round/slotLayout.ts';
import type { SlotModel } from '../../../round/types.ts';
import { RadialGlow } from './RadialGlow';
import { TopBar, HintDock, ThemedKeyboard, Description } from './ThemedChrome';
import type { ThemedRoundProps } from './types.ts';

const HUE = themedHues.food;
const a = acc(HUE);
const TEXT = '#F5E9D2';
const GROUND = '#140F08';

// x%, y% (from left/top unless noted), fontSize, opacity, rotation — mockup's 3
// background glyphs (♨ left:30,top:150 / ● right:34,top:180 / ♨ left:300,bottom:262)
// converted off the 390×800 design frame. Opacity boosted past the mockup's .1-.12 —
// same OLED-brightness gotcha as every other themed screen's texture layer.
const GLYPHS: { left?: number; right?: number; top?: number; bottom?: number; size: number; op: number; rot: number; glyph: string }[] = [
  { left: 8, top: 19, size: 22, op: 0.28, rot: 6, glyph: '♨' },
  { right: 9, top: 23, size: 12, op: 0.24, rot: 0, glyph: '●' },
  { left: 77, bottom: 33, size: 24, op: 0.28, rot: -8, glyph: '♨' },
];

function glyphPosition(g: (typeof GLYPHS)[number]): ViewStyle {
  const pos: ViewStyle = { position: 'absolute' };
  if (g.left !== undefined) pos.left = `${g.left}%`;
  else pos.right = `${g.right!}%`;
  if (g.top !== undefined) pos.top = `${g.top}%`;
  else pos.bottom = `${g.bottom!}%`;
  return pos;
}

function SteamGlyph({ leftOffset, size, durationMs, delayMs, reducedMotion }: { leftOffset: number; size: number; durationMs: number; delayMs: number; reducedMotion: boolean }) {
  const loop = useLinearLoop(durationMs, delayMs, reducedMotion);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(loop.value, [0, 1], [6, -26]) }],
    opacity: interpolate(loop.value, [0, 0.25, 1], [0, 0.4, 0]),
  }));
  return (
    <Animated.Text pointerEvents="none" style={[{ position: 'absolute', left: leftOffset, top: -24, fontSize: size, color: ok(0.8, 0.14, HUE) }, style]}>
      ♨
    </Animated.Text>
  );
}

// Mockup's filled slot is a two-tone vertical gradient, not a flat fill — react-native
// has no `linear-gradient()`, so this renders one via react-native-svg (same approach
// as RadialGlow, just linear).
function FoodSlotFill({ topColor, bottomColor }: { topColor: string; bottomColor: string }) {
  const id = `foodSlot-${useId()}`;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={topColor} />
          <Stop offset="100%" stopColor={bottomColor} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

function FoodSlot({ model, width, height, glyphSize }: { model: SlotModel; width: number; height: number; glyphSize: number }) {
  const t = useTheme();
  const focused = model.state === 'focused';
  const blink = useBlink(1150, !focused);
  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  const base = [styles.slot, { width, height }];
  if (focused) {
    return (
      <View style={[base, { backgroundColor: ok(0.55, 0.12, HUE, 0.22), borderColor: ok(0.8, 0.14, HUE, 0.8), borderWidth: 1 }]}>
        <Animated.View style={[styles.stub, { backgroundColor: ok(0.85, 0.14, HUE), shadowColor: ok(0.8, 0.16, HUE), shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }, blinkStyle]} />
      </View>
    );
  }
  if (model.state === 'empty') {
    return <View style={[base, { backgroundColor: ok(0.4, 0.07, HUE, 0.16), borderColor: ok(0.7, 0.12, HUE, 0.32), borderWidth: 1 }]} />;
  }
  const glyphColor = model.state === 'wrong' ? t.colors.signal : ok(0.9, 0.13, HUE);
  return (
    <View style={[base, styles.slotClip, { borderColor: a.border, borderWidth: 1 }]}>
      <FoodSlotFill topColor={ok(0.4, 0.09, HUE, 0.35)} bottomColor={ok(0.3, 0.07, 60, 0.25)} />
      <Text style={{ fontFamily: t.font.mono, fontWeight: '700', fontSize: glyphSize, color: glyphColor, textShadowColor: a.glow, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 }}>
        {model.char}
      </Text>
    </View>
  );
}

export const RoundFood = memo(function RoundFood({
  topicLabel,
  rating,
  progress,
  timeLabel,
  critical,
  solved,
  slots,
  description,
  hintsUsed,
  hintsDisabled,
  onHint,
  onKey,
  keyboardDisabled,
  hapticsEnabled,
  reducedMotion,
  wrongGuesses,
  endBeat,
  letterChips,
}: ThemedRoundProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const m = slotMetrics(slots.length, screenWidth);
  const lampBreathe = usePingPong(0.5, 1, 5000, 0, reducedMotion);
  const lampStyle = useAnimatedStyle(() => ({ opacity: lampBreathe.value }));
  const glyphDrift = useDriftStyle(19000, 9000, reducedMotion);
  // k-ember: brightness pulse on the filled rail, approximated via shadow intensity.
  const emberPulse = usePingPong(0.7, 1, 1800, 0, reducedMotion);
  const emberStyle = useAnimatedStyle(() => ({ shadowOpacity: emberPulse.value, shadowRadius: 8 + emberPulse.value * 8 }));

  const shakeX = useSharedValue(0);
  useEffect(() => {
    if (wrongGuesses === 0 || reducedMotion) return;
    const d = motionTokens.wrongShakePx;
    shakeX.value = withSequence(
      withTiming(-d, { duration: durationTokens.fast / 3 }),
      withTiming(d, { duration: durationTokens.fast / 3 }),
      withTiming(0, { duration: durationTokens.fast / 3 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrongGuesses, reducedMotion]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  const railStyle = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, progress.value)) * 100}%` }));

  return (
    <View style={[styles.screen, { backgroundColor: GROUND, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 14 }]}>
      <RadialGlow cx={50} cy={8} rx={90} ry={45} color={ok(0.72, 0.15, HUE)} opacity={0.4} />
      <RadialGlow cx={50} cy={8} rx={90} ry={45} color={ok(0.72, 0.15, HUE)} opacity={0.28} animatedStyle={lampStyle} />
      <Animated.View style={[StyleSheet.absoluteFill, glyphDrift]} pointerEvents="none">
        {GLYPHS.map((g, i) => (
          <View key={i} style={[glyphPosition(g), { transform: [{ rotate: `${g.rot}deg` }] }]}>
            <Text style={{ fontSize: g.size, opacity: g.op, color: ok(0.77, 0.15, HUE), lineHeight: g.size }}>{g.glyph}</Text>
          </View>
        ))}
      </Animated.View>

      <TopBar label={topicLabel} labelColor={ok(0.8, 0.14, HUE)} rating={rating} diamondColor={a.main} textColor={TEXT} />

      <View style={styles.module}>
        <View style={styles.readoutRow}>
          <Text style={{ fontFamily: t.font.mono, fontSize: 10, letterSpacing: 2, color: ok(0.65, 0.06, HUE) }}>TODAY&apos;S WORD</Text>
          <Text style={{ fontFamily: t.font.mono, fontSize: 13, color: critical ? t.colors.signal : ok(0.85, 0.14, HUE) }}>{timeLabel}</Text>
        </View>
        <View style={styles.railWrap}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(245,233,210,.14)' }]} />
          <Animated.View
            style={[styles.burn, { backgroundColor: solved ? ok(0.8, 0.14, HUE) : critical ? t.colors.signal : ok(0.8, 0.14, HUE), shadowColor: ok(0.75, 0.16, HUE, 0.85), shadowOffset: { width: 0, height: 0 } }, emberStyle, !solved && railStyle, solved && { width: '100%' }]}
          />
        </View>
        <View style={styles.slotsWrap}>
          <SteamGlyph leftOffset={screenWidth / 2 - 130} size={14} durationMs={3000} delayMs={0} reducedMotion={reducedMotion} />
          <SteamGlyph leftOffset={screenWidth / 2 - 112} size={10} durationMs={3800} delayMs={1600} reducedMotion={reducedMotion} />
          <Animated.View style={[styles.slotRow, { gap: m.gap }, shakeStyle]}>
            {slots.map((s, i) => (
              <FoodSlot key={i} model={s} width={m.width} height={m.height} glyphSize={m.glyph} />
            ))}
          </Animated.View>
        </View>
        <Description color={ok(0.74, 0.05, HUE)}>{description}</Description>
        {letterChips}
        {endBeat}
      </View>

      <HintDock
        bg={ok(0.4, 0.09, HUE, 0.3)}
        border={a.hintBorder}
        radius={8}
        accent={ok(0.8, 0.14, HUE)}
        text={TEXT}
        dim={ok(0.62, 0.05, HUE)}
        spent={hintsUsed}
        disabled={hintsDisabled}
        onHint={onHint}
      />
      <ThemedKeyboard
        keyBg={ok(0.35, 0.07, 60, 0.46)}
        radius={7}
        text={TEXT}
        dim={ok(0.62, 0.05, HUE)}
        onKey={onKey}
        disabled={keyboardDisabled}
        hapticsEnabled={hapticsEnabled}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  module: { flex: 1, justifyContent: 'center' },
  readoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 8 },
  railWrap: { position: 'relative', height: 3, marginHorizontal: 24 },
  burn: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  slotsWrap: { position: 'relative' },
  slotRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
  slot: { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' },
  slotClip: { overflow: 'hidden' },
  stub: { width: 16, height: 3, marginBottom: 10 },
});

export default RoundFood;
