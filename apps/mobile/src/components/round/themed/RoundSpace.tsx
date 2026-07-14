/**
 * Space & Sci-Fi — cosmic starfield + nebula glow (mockup 10c / RoundSpace.tsx).
 * Slots hang like airlock windows (top-open, glowing borders); no flap seam. The rail
 * has a glowing comet head at the burn tip instead of gaming's double-rail burn.
 */
import { memo, useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming, interpolate } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion as motionTokens, duration as durationTokens } from '@sabd/tokens';

import { useTheme } from '../../../theme';
import { usePingPong, useDriftStyle } from '../../../theme/themed/ambient.ts';
import { themedHues, acc, ok } from '../../../theme/themed/themedTokens.ts';
import { slotMetrics } from '../../../round/slotLayout.ts';
import type { SlotModel } from '../../../round/types.ts';
import { RadialGlow } from './RadialGlow';
import { TopBar, HintDock, ThemedKeyboard, Description } from './ThemedChrome';
import type { ThemedRoundProps } from './types.ts';

const HUE = themedHues.space;
const a = acc(HUE);
const TEXT = '#E9EDFB';
const GROUND = '#070A14';

const STARS: [number, number, number, number, number][] = [
  [8, 9, 2, 0.9, 2400], [30, 14, 1, 0.7, 3100], [78, 11, 2, 0.8, 1900], [18, 25, 1, 0.6, 2700],
  [88, 28, 2, 0.85, 3400], [55, 19, 1, 0.55, 2200], [10, 64, 2, 0.8, 2900], [86, 69, 1, 0.6, 2000],
  [39, 75, 2, 0.75, 3600], [70, 84, 1, 0.6, 2500], [23, 81, 1, 0.5, 3000], [52, 8, 1, 0.7, 2100],
];

// x%, y% (from left/top unless noted), fontSize, opacity — mockup's 3 accent sparkles
// (left:28,top:118 / right:34,top:158 / left:300,bottom:255) converted off the 390×800
// design frame.
const SPARKLES: { left?: number; right?: number; top?: number; bottom?: number; size: number; op: number; glyph: string }[] = [
  { left: 7, top: 15, size: 16, op: 0.5, glyph: '✦' },
  { right: 9, top: 20, size: 11, op: 0.4, glyph: '✧' },
  { left: 77, bottom: 32, size: 14, op: 0.45, glyph: '✦' },
];

function sparklePosition(s: (typeof SPARKLES)[number]): TextStyle {
  const pos: TextStyle = { position: 'absolute' };
  if (s.left !== undefined) pos.left = `${s.left}%`;
  else pos.right = `${s.right!}%`;
  if (s.top !== undefined) pos.top = `${s.top}%`;
  else pos.bottom = `${s.bottom!}%`;
  return pos;
}

function SpaceSlot({
  model,
  width,
  height,
  glyphSize,
  index,
}: {
  model: SlotModel;
  width: number;
  height: number;
  glyphSize: number;
  index: number;
}) {
  const t = useTheme();
  const focused = model.state === 'focused';
  const filled = model.state === 'typed' || model.state === 'given' || model.state === 'correct' || model.state === 'wrong';
  // Staggered per slot (mockup: `-0.5 * i`s, a negative CSS animation-delay that
  // starts each slot already partway through its cycle) so filled letters bob out
  // of phase — a wave, not a single block moving in lockstep. `usePingPong`'s delay
  // is a positive pre-start pause, not a phase offset, but a positive stagger here
  // reads the same way visually: each slot starts bobbing a beat after the last.
  const bob = usePingPong(0, -5, 3200, index * 500, !filled);
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));
  const blink = usePingPong(1, 0.2, 600, 0, !focused);
  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  const base = [styles.slot, { width, height }];
  if (focused) {
    return (
      <View style={[base, { backgroundColor: ok(0.6, 0.14, HUE, 0.18), borderColor: ok(0.8, 0.14, HUE, 0.8), borderWidth: 1 }]}>
        <Animated.View style={[styles.stub, { backgroundColor: ok(0.85, 0.14, HUE) }, blinkStyle]} />
      </View>
    );
  }
  if (model.state === 'empty') {
    return <View style={[base, { backgroundColor: ok(0.5, 0.12, HUE, 0.12), borderColor: a.borderDim, borderWidth: 1 }]} />;
  }
  const glyphColor = model.state === 'wrong' ? t.colors.signal : ok(0.9, 0.13, HUE);
  return (
    <Animated.View style={[base, { backgroundColor: ok(0.5, 0.12, HUE, 0.24), borderColor: a.border, borderWidth: 1 }, bobStyle]}>
      <Text
        style={{ fontFamily: t.font.mono, fontWeight: '700', fontSize: glyphSize, color: glyphColor, textShadowColor: a.glow, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 }}
      >
        {model.char}
      </Text>
    </Animated.View>
  );
}

export const RoundSpace = memo(function RoundSpace({
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
  const nebulaBreathe = usePingPong(0.5, 1, 3500, 0, reducedMotion);
  const nebulaStyle = useAnimatedStyle(() => ({ opacity: nebulaBreathe.value }));
  // k-sway: a slow lateral drift + scale pulse, layered on top of the breathe opacity —
  // mockup runs both animations on the same element simultaneously.
  const nebulaSway = usePingPong(0, 1, 13000, 0, reducedMotion);
  const nebulaSwayStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(nebulaSway.value, [0, 1], [0, -10]) },
      { translateY: interpolate(nebulaSway.value, [0, 1], [0, -6]) },
      { scale: interpolate(nebulaSway.value, [0, 1], [1, 1.06]) },
    ],
  }));
  const starDrift = useDriftStyle(22000, 0, reducedMotion);
  const sparkleDrift = useDriftStyle(14000, 0, reducedMotion);

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

  const railStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, progress.value)) * 100}%`,
  }));
  const cometStyle = useAnimatedStyle(() => ({
    left: `${Math.max(0, Math.min(1, progress.value)) * 100}%`,
  }));

  return (
    <View style={[styles.screen, { backgroundColor: GROUND, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 14 }]}>
      <RadialGlow cx={50} cy={42} rx={120} ry={60} color={ok(0.4, 0.13, HUE)} opacity={0.28} />
      <RadialGlow cx={80} cy={8} rx={140} ry={80} color={ok(0.45, 0.1, 285)} opacity={0.18} />
      <Animated.View style={[StyleSheet.absoluteFill, starDrift]} pointerEvents="none">
        {STARS.map(([xPct, yPct, size, op, dur], i) => {
          const twinkle = usePingPong(op, op * 0.17, dur, -i * 400, reducedMotion);
          const style = useAnimatedStyle(() => ({ opacity: twinkle.value }));
          return (
            <Animated.View
              key={i}
              style={[
                { position: 'absolute', left: `${xPct}%`, top: `${yPct}%`, width: size, height: size, borderRadius: size / 2, backgroundColor: '#DCE6FF' },
                style,
              ]}
            />
          );
        })}
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, sparkleDrift]} pointerEvents="none">
        {SPARKLES.map((s, i) => (
          <Text
            key={i}
            style={[
              sparklePosition(s),
              { fontSize: s.size, opacity: s.op, color: ok(0.8, 0.14, HUE), lineHeight: s.size },
            ]}
          >
            {s.glyph}
          </Text>
        ))}
      </Animated.View>

      <TopBar label={topicLabel} labelColor={ok(0.82, 0.14, HUE)} rating={rating} diamondColor={a.main} textColor={TEXT} />

      <View style={styles.module}>
        <RadialGlow
          cx={50}
          cy={45}
          rx={42}
          ry={18}
          blurPx={6}
          stops={[
            { offset: '0%', color: ok(0.6, 0.16, HUE), opacity: 0.28 },
            { offset: '45%', color: ok(0.5, 0.14, 300), opacity: 0.12 },
            { offset: '70%', color: ok(0.5, 0.14, 300), opacity: 0 },
          ]}
          animatedStyle={[nebulaStyle, nebulaSwayStyle]}
        />
        <View style={styles.readoutRow}>
          <Text style={{ fontFamily: t.font.mono, fontSize: 10, letterSpacing: 2, color: ok(0.7, 0.08, HUE) }}>SECTOR 7</Text>
          <Text style={{ fontFamily: t.font.mono, fontSize: 13, color: critical ? t.colors.signal : ok(0.85, 0.14, HUE) }}>{timeLabel}</Text>
        </View>
        <View style={styles.cometRail}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(220,230,255,.14)' }]} />
          <Animated.View
            style={[styles.cometBurn, { backgroundColor: ok(0.8, 0.14, HUE), shadowColor: ok(0.75, 0.16, HUE, 0.9), shadowOpacity: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }, !solved && railStyle, solved && { width: '100%' }]}
          />
          {!solved && (
            <Animated.View
              style={[styles.cometHead, { backgroundColor: ok(0.9, 0.13, HUE), shadowColor: ok(0.8, 0.16, HUE), shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }, cometStyle]}
            />
          )}
        </View>
        <Animated.View style={[styles.slotRow, { gap: m.gap }, shakeStyle]}>
          {slots.map((s, i) => (
            <SpaceSlot key={i} model={s} width={m.width} height={m.height} glyphSize={m.glyph} index={i} />
          ))}
        </Animated.View>
        <Description color={ok(0.72, 0.05, HUE)}>{description}</Description>
        {letterChips}
        {endBeat}
      </View>

      <HintDock
        bg={ok(0.5, 0.1, HUE, 0.24)}
        border={a.hintBorder}
        radius={10}
        accent={ok(0.8, 0.14, HUE)}
        text={TEXT}
        dim={ok(0.65, 0.05, HUE)}
        spent={hintsUsed}
        disabled={hintsDisabled}
        onHint={onHint}
      />
      <ThemedKeyboard
        keyBg={ok(0.4, 0.08, HUE, 0.38)}
        radius={6}
        text={TEXT}
        dim={ok(0.65, 0.05, HUE)}
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
  readoutRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingBottom: 8 },
  cometRail: { position: 'relative', height: 2, marginHorizontal: 24 },
  cometBurn: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  cometHead: { position: 'absolute', top: -2, width: 6, height: 6, borderRadius: 3, marginLeft: -3 },
  slotRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  slot: { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' },
  stub: { width: 16, height: 3, marginBottom: 10 },
});

export default RoundSpace;
