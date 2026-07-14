/**
 * Internet & Tech — terminal (mockup 10e / RoundInternet.tsx). Prompt line, dot grid,
 * square everything, block cursor in the focused slot, `//` comment riddle.
 */
import { memo, useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion as motionTokens, duration as durationTokens } from '@sabd/tokens';

import { useTheme } from '../../../theme';
import { useBlink, usePingPong, useDriftStyle } from '../../../theme/themed/ambient.ts';
import { themedHues, acc, ok } from '../../../theme/themed/themedTokens.ts';
import { slotMetrics } from '../../../round/slotLayout.ts';
import type { SlotModel } from '../../../round/types.ts';
import { GridPattern } from './GridPattern';
import { TopBar, HintDock, ThemedKeyboard, Description } from './ThemedChrome';
import type { ThemedRoundProps } from './types.ts';

const HUE = themedHues.internet;
const a = acc(HUE);
const TEXT = '#DDF6F1';
const GROUND = '#04100F';

// x%, y% (from left/top unless noted), fontSize, rotation, [lowOp, highOp] pulse (or a
// single static opacity) — mockup's 4 terminal glyphs (@ left:26,top:130 / </> right:34,
// top:160 / # left:300,bottom:262 / 01001 left:40,bottom:250) converted off the 390×800
// design frame. Opacity boosted well past the mockup's .09-.1 — same OLED-brightness
// gotcha as the grid lines above (owner-verified: invisible below ~85% phone brightness).
const GLYPHS: { left?: number; right?: number; top?: number; bottom?: number; size: number; rot: number; glyph: string; pulse?: [number, number]; op?: number; delay: number }[] = [
  { left: 7, top: 16, size: 20, rot: -8, glyph: '@', pulse: [0.22, 0.4], delay: 0 },
  { right: 9, top: 20, size: 15, rot: 0, glyph: '</>', pulse: [0.2, 0.38], delay: 1500 },
  { left: 77, bottom: 33, size: 18, rot: 0, glyph: '#', op: 0.24, delay: 0 },
  { left: 10, bottom: 31, size: 12, rot: 0, glyph: '01001', op: 0.22, delay: 0 },
];

function glyphPosition(g: (typeof GLYPHS)[number]): ViewStyle {
  const pos: ViewStyle = { position: 'absolute' };
  if (g.left !== undefined) pos.left = `${g.left}%`;
  else pos.right = `${g.right!}%`;
  if (g.top !== undefined) pos.top = `${g.top}%`;
  else pos.bottom = `${g.bottom!}%`;
  return pos;
}

function TerminalGlyph({ g, color, font, reducedMotion }: { g: (typeof GLYPHS)[number]; color: string; font: string; reducedMotion: boolean }) {
  const pulse = usePingPong(g.pulse?.[0] ?? g.op ?? 1, g.pulse?.[1] ?? g.op ?? 1, 3000, g.delay, reducedMotion || !g.pulse);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View style={[glyphPosition(g), style]}>
      <Text style={{ fontFamily: font, fontWeight: '700', fontSize: g.size, color, transform: [{ rotate: `${g.rot}deg` }] }}>{g.glyph}</Text>
    </Animated.View>
  );
}

function InternetSlot({ model, width, height, glyphSize }: { model: SlotModel; width: number; height: number; glyphSize: number }) {
  const t = useTheme();
  const focused = model.state === 'focused';
  const blink = useBlink(1000, !focused);
  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  const base = [styles.slot, { width, height }];
  if (focused) {
    return (
      <View style={[base, { backgroundColor: ok(0.5, 0.1, HUE, 0.24), borderColor: ok(0.8, 0.14, HUE, 0.85), borderWidth: 1 }]}>
        <Animated.View style={[styles.cursor, { backgroundColor: ok(0.85, 0.14, HUE), shadowColor: ok(0.8, 0.16, HUE), shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }, blinkStyle]} />
      </View>
    );
  }
  if (model.state === 'empty') {
    return <View style={[base, { backgroundColor: ok(0.4, 0.06, HUE, 0.14), borderColor: a.borderDim, borderWidth: 1 }]} />;
  }
  const glyphColor = model.state === 'wrong' ? t.colors.signal : ok(0.9, 0.13, HUE);
  return (
    <View style={[base, { backgroundColor: ok(0.4, 0.08, HUE, 0.32), borderColor: a.border, borderWidth: 1 }]}>
      <Text style={{ fontFamily: t.font.mono, fontWeight: '700', fontSize: glyphSize, color: glyphColor, textShadowColor: a.glow, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 }}>
        {model.char}
      </Text>
    </View>
  );
}

export const RoundInternet = memo(function RoundInternet({
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
  const promptBlink = useBlink(1000, reducedMotion);
  const promptBlinkStyle = useAnimatedStyle(() => ({ opacity: promptBlink.value }));
  const glyphDrift = useDriftStyle(17000, 7000, reducedMotion);

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
      {/* Owner-verified on-device (iPhone 14 Pro Max): mockup-scale alpha only became
          visible above ~85% brightness — invisible at normal indoor brightness on OLED.
          Boosted well past the mockup's .05/.1 for real-world visibility. */}
      <GridPattern size={20} color={ok(0.7, 0.12, HUE, 0.25)} />
      <Animated.View style={[StyleSheet.absoluteFill, glyphDrift]} pointerEvents="none">
        {GLYPHS.map((g, i) => (
          <TerminalGlyph key={i} g={g} color={ok(0.77, 0.15, HUE)} font={t.font.monoBold} reducedMotion={reducedMotion} />
        ))}
      </Animated.View>

      <TopBar label={topicLabel} labelFont={t.font.mono} labelColor={ok(0.82, 0.14, HUE)} rating={rating} diamondColor={a.main} textColor={TEXT} />

      <View style={styles.prompt}>
        <Text style={{ fontFamily: t.font.mono, fontSize: 11, color: ok(0.65, 0.08, HUE) }}>
          guest@sabd:~/internet$ <Text style={{ color: ok(0.85, 0.14, HUE) }}>guess</Text>
        </Text>
        <Animated.Text style={[{ fontFamily: t.font.mono, fontSize: 11, color: ok(0.85, 0.14, HUE) }, promptBlinkStyle]}>▌</Animated.Text>
      </View>

      <View style={styles.module}>
        <View style={styles.readoutRow}>
          <Text style={{ fontFamily: t.font.mono, fontSize: 13, color: critical ? t.colors.signal : ok(0.85, 0.14, HUE) }}>{timeLabel}</Text>
        </View>
        <View style={styles.railWrap}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(221,246,241,.12)' }]} />
          <Animated.View
            style={[styles.burn, { backgroundColor: solved ? ok(0.8, 0.14, HUE) : critical ? t.colors.signal : ok(0.8, 0.14, HUE), shadowColor: ok(0.75, 0.16, HUE, 0.85), shadowOpacity: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }, !solved && railStyle, solved && { width: '100%' }]}
          />
        </View>
        <Animated.View style={[styles.slotRow, { gap: m.gap }, shakeStyle]}>
          {slots.map((s, i) => (
            <InternetSlot key={i} model={s} width={m.width} height={m.height} glyphSize={m.glyph} />
          ))}
        </Animated.View>
        <Description color={ok(0.68, 0.05, HUE)} font={t.font.mono} fontSize={13}>
          {description}
        </Description>
        {letterChips}
        {endBeat}
      </View>

      <HintDock
        bg={ok(0.4, 0.08, HUE, 0.28)}
        border={a.hintBorder}
        radius={4}
        accent={ok(0.8, 0.14, HUE)}
        text={TEXT}
        dim={ok(0.6, 0.05, HUE)}
        spent={hintsUsed}
        disabled={hintsDisabled}
        onHint={onHint}
      />
      <ThemedKeyboard
        keyBg={ok(0.35, 0.06, HUE, 0.42)}
        keyBorder={ok(0.7, 0.1, HUE, 0.15)}
        radius={3}
        text={TEXT}
        dim={ok(0.6, 0.05, HUE)}
        onKey={onKey}
        disabled={keyboardDisabled}
        hapticsEnabled={hapticsEnabled}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  prompt: { flexDirection: 'row', paddingHorizontal: 22, paddingTop: 8 },
  module: { flex: 1, justifyContent: 'center' },
  readoutRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: 8 },
  railWrap: { position: 'relative', height: 3, marginHorizontal: 24 },
  burn: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  slotRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
  slot: { alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' },
  cursor: { width: 12, height: 26 },
});

export default RoundInternet;
