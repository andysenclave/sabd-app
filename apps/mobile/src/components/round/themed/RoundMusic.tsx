/**
 * Music — equalizer / waveform (mockup 10d / RoundMusic.tsx). Slots pulse like speaker
 * cones (rounded bottoms, k-beat); a live EQ meter sits by the timer and a waveform
 * strip runs under the description. Magenta stage-glow floor.
 */
import { memo, useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
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

const HUE = themedHues.music;
const a = acc(HUE);
const TEXT = '#FBE7F3';
const GROUND = '#0C070C';

// Positive delays throughout — Reanimated's withDelay gates on `now - startTime >=
// delayMs`, which a negative delayMs satisfies on frame 0. The mockup's CSS negative
// delays (start-already-mid-cycle) don't port literally; a positive pre-delay per
// item produces the same steady-state stagger in an infinite loop.
const EQ_MINI: [number, number, number][] = [[6, 700, 0], [12, 850, 200], [8, 750, 400], [14, 900, 100], [5, 800, 550]];
const WAVE = [8, 16, 11, 22, 14, 19, 9, 24, 12, 17, 7, 20, 13, 10];

// x%, y% (from left/top unless noted), fontSize, opacity, rotation, bob delay — the
// mockup's 3 floating notes (left:28,top:118 / right:34,top:156 / left:300,bottom:262)
// converted off the 390×800 design frame. Opacity boosted ~2.3x over the mockup's
// .11-.13 — that low an alpha reads as invisible on a real OLED phone even though it
// shows (faintly) on a color-managed browser, same gotcha as the earlier glow fixes.
const NOTES: { left?: number; right?: number; top?: number; bottom?: number; size: number; op: number; rot: number; glyph: string; bobDelay: number }[] = [
  { left: 7, top: 15, size: 24, op: 0.3, rot: 10, glyph: '♪', bobDelay: 0 },
  { right: 9, top: 20, size: 18, op: 0.26, rot: -12, glyph: '♫', bobDelay: 1300 },
  { left: 77, bottom: 33, size: 20, op: 0.28, rot: 8, glyph: '♪', bobDelay: 2600 },
];

function notePosition(n: (typeof NOTES)[number]): ViewStyle {
  const pos: ViewStyle = { position: 'absolute' };
  if (n.left !== undefined) pos.left = `${n.left}%`;
  else pos.right = `${n.right!}%`;
  if (n.top !== undefined) pos.top = `${n.top}%`;
  else pos.bottom = `${n.bottom!}%`;
  return pos;
}

function Note({ n, color, reducedMotion }: { n: (typeof NOTES)[number]; color: string; reducedMotion: boolean }) {
  const bob = usePingPong(0, -5, 4000, n.bobDelay, reducedMotion);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }, { rotate: `${n.rot}deg` }] }));
  return (
    <Animated.View style={[notePosition(n), style]}>
      <Text style={{ fontSize: n.size, opacity: n.op, color, lineHeight: n.size }}>{n.glyph}</Text>
    </Animated.View>
  );
}

function EqBar({ maxHeight, dur, delay, color }: { maxHeight: number; dur: number; delay: number; color: string }) {
  const h = usePingPong(maxHeight * 0.3, maxHeight, dur, delay);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[{ width: 2, borderRadius: 1, backgroundColor: color }, style]} />;
}

function MusicSlot({ model, width, height, glyphSize, beatDelay }: { model: SlotModel; width: number; height: number; glyphSize: number; beatDelay: number }) {
  const t = useTheme();
  const focused = model.state === 'focused';
  const filled = model.state === 'typed' || model.state === 'given' || model.state === 'correct' || model.state === 'wrong';
  const beat = usePingPong(1, 1.05, 1900, beatDelay, !filled);
  const beatStyle = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));
  const blink = usePingPong(1, 0.15, 600, 0, !focused);
  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  const base = [styles.slot, { width, height }];
  if (focused) {
    return (
      <View style={[base, { backgroundColor: ok(0.55, 0.14, HUE, 0.22), borderColor: ok(0.8, 0.14, HUE, 0.8), borderWidth: 1 }]}>
        <Animated.View style={[styles.stub, { backgroundColor: ok(0.85, 0.14, HUE) }, blinkStyle]} />
      </View>
    );
  }
  if (model.state === 'empty') {
    return <View style={[base, { backgroundColor: ok(0.45, 0.1, HUE, 0.14), borderColor: ok(0.7, 0.12, HUE, 0.3), borderWidth: 1 }]} />;
  }
  const glyphColor = model.state === 'wrong' ? t.colors.signal : ok(0.9, 0.13, HUE);
  return (
    <Animated.View style={[base, { backgroundColor: ok(0.45, 0.12, HUE, 0.32), borderColor: ok(0.75, 0.14, HUE, 0.55), borderWidth: 1 }, beatStyle]}>
      <Text style={{ fontFamily: t.font.mono, fontWeight: '700', fontSize: glyphSize, color: glyphColor, textShadowColor: ok(0.75, 0.16, HUE, 0.85), textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 }}>
        {model.char}
      </Text>
    </Animated.View>
  );
}

export const RoundMusic = memo(function RoundMusic({
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
  const floorBreathe = usePingPong(0.5, 1, 4500, 0, reducedMotion);
  const floorStyle = useAnimatedStyle(() => ({ opacity: floorBreathe.value }));
  const noteDrift = useDriftStyle(15000, 3000, reducedMotion);
  // k-ember: a brightness pulse on the filled rail — approximated via shadow intensity.
  const emberPulse = usePingPong(0.7, 1, 950, 0, reducedMotion);
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
      {/* Peak sits at cy=100 (dead-center bottom), right behind the opaque keyboard,
          so mockup-exact alpha reads as barely-there above it — boosted to compensate,
          unlike Space/etc. whose glows don't sit behind opaque chrome. */}
      <RadialGlow cx={50} cy={100} rx={120} ry={55} color={ok(0.52, 0.18, HUE)} opacity={0.55} />
      <RadialGlow cx={50} cy={100} rx={120} ry={55} color={ok(0.55, 0.18, HUE)} opacity={0.4} animatedStyle={floorStyle} />
      <Animated.View style={[StyleSheet.absoluteFill, noteDrift]} pointerEvents="none">
        {NOTES.map((n, i) => (
          <Note key={i} n={n} color={ok(0.77, 0.15, HUE)} reducedMotion={reducedMotion} />
        ))}
      </Animated.View>

      <TopBar label={topicLabel} labelColor={ok(0.82, 0.15, HUE)} rating={rating} diamondColor={a.main} textColor={TEXT} />

      <View style={styles.module}>
        <View style={styles.readoutRow}>
          <View style={styles.eqRow}>
            {EQ_MINI.map(([h, dur, delay], i) => (
              <EqBar key={i} maxHeight={h} dur={dur} delay={delay} color={ok(0.82, 0.15, HUE)} />
            ))}
          </View>
          <Text style={{ fontFamily: t.font.mono, fontSize: 13, color: critical ? t.colors.signal : ok(0.85, 0.15, HUE) }}>{timeLabel}</Text>
        </View>
        <View style={styles.railWrap}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(251,231,243,.12)' }]} />
          <Animated.View
            style={[styles.burn, { backgroundColor: solved ? ok(0.8, 0.15, HUE) : critical ? t.colors.signal : ok(0.8, 0.15, HUE), shadowColor: ok(0.75, 0.16, HUE, 0.85), shadowOffset: { width: 0, height: 0 } }, emberStyle, !solved && railStyle, solved && { width: '100%' }]}
          />
        </View>
        <Animated.View style={[styles.slotRow, { gap: m.gap }, shakeStyle]}>
          {slots.map((s, i) => (
            <MusicSlot key={i} model={s} width={m.width} height={m.height} glyphSize={m.glyph} beatDelay={i * 300} />
          ))}
        </Animated.View>
        <Description color={ok(0.72, 0.05, HUE)}>{description}</Description>
        {letterChips}
        {endBeat}
        <View style={styles.wave}>
          {WAVE.map((h, i) => (
            <EqBar key={i} maxHeight={h} dur={700 + (i % 5) * 100} delay={i * 70} color={h >= 20 ? ok(0.8, 0.15, HUE) : ok(0.75, 0.14, HUE)} />
          ))}
        </View>
      </View>

      <HintDock
        bg={ok(0.45, 0.1, HUE, 0.28)}
        border={a.hintBorder}
        radius={12}
        accent={ok(0.8, 0.14, HUE)}
        text={TEXT}
        dim={ok(0.65, 0.05, HUE)}
        spent={hintsUsed}
        disabled={hintsDisabled}
        onHint={onHint}
      />
      <ThemedKeyboard
        keyBg={ok(0.4, 0.08, HUE, 0.4)}
        radius={8}
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
  readoutRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 10, paddingHorizontal: 24, paddingBottom: 8 },
  eqRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 14 },
  railWrap: { position: 'relative', height: 3, marginHorizontal: 24 },
  burn: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  slotRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
  slot: { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' },
  stub: { width: 16, height: 3, marginBottom: 10 },
  wave: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 3, height: 26, marginTop: 8, opacity: 0.5 },
});

export default RoundMusic;
