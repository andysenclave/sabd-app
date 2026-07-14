/**
 * Gaming — split-flap scoreboard (mockup 10b / RoundGaming.tsx). The ONLY themed round
 * screen that keeps the flap seam + scanlines: they are gaming's category signature,
 * nowhere else (DESIGN-SYSTEM.md rev. 3 §2/§4).
 */
import { memo, useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../theme';
import { usePingPong, useLinearLoop, useBlink, useDriftStyle } from '../../../theme/themed/ambient.ts';
import { themedHues, acc } from '../../../theme/themed/themedTokens.ts';
import { motion as motionTokens, duration as durationTokens, retro as retroTokens } from '@sabd/tokens';
import { slotMetrics } from '../../../round/slotLayout.ts';
import type { SlotModel } from '../../../round/types.ts';
import { Scanlines } from './Scanlines';
import { TopBar, HintDock, ThemedKeyboard, Description } from './ThemedChrome';
import type { ThemedRoundProps } from './types.ts';

const SURFACE = retroTokens.surface;
const GROUND = retroTokens.ground;
const a = acc(themedHues.gaming);

// Opacity pulse boosted from the mockup's raw k-glyph range (.09↔.26) — same OLED
// low-alpha gotcha as every other themed screen's background texture this session.
const GLYPHS: { ch: string; left?: number; right?: number; top?: number; bottom?: number; size: number; rotate: number; delay: number }[] = [
  { ch: '△', left: 26, top: 120, size: 22, rotate: 12, delay: 0 },
  { ch: '○', right: 34, top: 150, size: 16, rotate: -8, delay: 800 },
  { ch: '✕', left: 40, bottom: 250, size: 26, rotate: -14, delay: 1600 },
  { ch: '□', right: 30, bottom: 280, size: 18, rotate: 10, delay: 2400 },
];

function GamingSlot({ model, width, height, glyphSize }: { model: SlotModel; width: number; height: number; glyphSize: number }) {
  const t = useTheme();
  const focused = model.state === 'focused';
  const filled = model.state === 'typed' || model.state === 'given' || model.state === 'correct' || model.state === 'wrong';

  // Every hook fires every render (Rules of Hooks) — which branch USES the result
  // depends on state, but the call sequence itself never changes.
  const flickerLoop = useLinearLoop(5000, 0, !filled);
  const flickerStyle = useAnimatedStyle(() => ({
    // k-flicker: opacity 1 for most of the cycle, brief dip to .45 around 92.5%.
    opacity: interpolate(flickerLoop.value, [0, 0.91, 0.925, 0.94, 1], [1, 1, 0.45, 1, 1]),
  }));
  const blink = useBlink(1100, !focused);
  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  if (focused) {
    return (
      <View style={[styles.slot, { width, height, backgroundColor: 'rgba(240,230,204,.1)', borderColor: a.border, borderWidth: 1 }]}>
        <Animated.View
          style={[
            styles.stub,
            { backgroundColor: a.main, shadowColor: a.glow, shadowRadius: 8, shadowOpacity: 1, shadowOffset: { width: 0, height: 0 } },
            blinkStyle,
          ]}
        />
        <View style={[styles.fold, { backgroundColor: 'rgba(0,0,0,.5)' }]} />
      </View>
    );
  }

  if (model.state === 'empty') {
    return (
      <View style={[styles.slot, { width, height, backgroundColor: 'rgba(240,230,204,.06)', borderColor: a.borderDim, borderWidth: 1 }]}>
        <View style={[styles.fold, { backgroundColor: 'rgba(0,0,0,.5)' }]} />
      </View>
    );
  }

  const glyphColor = model.state === 'wrong' ? t.colors.signal : a.bright;
  return (
    <Animated.View
      style={[styles.slot, styles.slotShadow, { width, height, backgroundColor: SURFACE, borderColor: a.border, borderWidth: 1 }, flickerStyle]}
    >
      <Text
        style={{
          fontFamily: t.font.brand,
          fontSize: glyphSize,
          color: glyphColor,
          textShadowColor: a.glow,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 10,
        }}
      >
        {model.char}
      </Text>
      <View style={[styles.fold, { backgroundColor: 'rgba(0,0,0,.85)' }]} />
    </Animated.View>
  );
}

export const RoundGaming = memo(function RoundGaming({
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
  const ember = usePingPong(1, 1.4, 1600, 0, reducedMotion);
  const glyphDrift = useDriftStyle(16000, 0, reducedMotion);

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

  const burnStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, progress.value)) * 100}%`,
    shadowRadius: 10 * ember.value,
  }));

  return (
    <View style={[styles.screen, { backgroundColor: GROUND, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 14 }]}>
      <Scanlines opacity={0.16} />
      <Animated.View style={[StyleSheet.absoluteFill, glyphDrift]} pointerEvents="none">
        {GLYPHS.map((g, i) => {
          const glyph = usePingPong(0.22, 0.42, 3400, g.delay, reducedMotion);
          const style = useAnimatedStyle(() => ({ opacity: glyph.value }));
          return (
            <Animated.Text
              key={i}
              style={[
                styles.glyph,
                {
                  left: g.left,
                  right: g.right,
                  top: g.top,
                  bottom: g.bottom,
                  fontSize: g.size,
                  color: a.main,
                  fontFamily: t.font.monoBold,
                  transform: [{ rotate: `${g.rotate}deg` }],
                },
                style,
              ]}
            >
              {g.ch}
            </Animated.Text>
          );
        })}
      </Animated.View>

      <TopBar label={topicLabel} labelFont={t.font.brand} labelColor={a.main} rating={rating} diamondColor={a.main} textColor="#F0E6CC" />

      <View style={styles.module}>
        <View style={styles.readoutRow}>
          <Text style={{ fontFamily: t.font.mono, fontSize: 13, color: critical ? t.colors.signal : a.bright }}>
            {timeLabel}
          </Text>
        </View>
        <View style={styles.railWrap}>
          <View style={styles.railTrackWrap}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(240,230,204,.12)' }]} />
            <Animated.View
              style={[
                styles.burn,
                { backgroundColor: solved ? a.main : critical ? t.colors.signal : a.main, shadowColor: a.glow, shadowOpacity: 0.9, shadowOffset: { width: 0, height: 0 } },
                !solved && burnStyle,
                solved && { width: '100%' },
              ]}
            />
          </View>
          <View style={[styles.railUnderside, { backgroundColor: 'rgba(0,0,0,.5)', width: solved ? '100%' : undefined }]} />
        </View>

        <Animated.View style={[styles.slotRow, { gap: m.gap }, shakeStyle]}>
          {slots.map((s, i) => (
            <GamingSlot key={i} model={s} width={m.width} height={m.height} glyphSize={m.glyph} />
          ))}
        </Animated.View>

        <Description color="#8F8672">{description}</Description>
        {letterChips}
        {endBeat}
      </View>

      <HintDock
        bg={SURFACE}
        border={a.hintBorder}
        radius={4}
        accent={a.main}
        text="#F0E6CC"
        dim="#8F8672"
        spent={hintsUsed}
        disabled={hintsDisabled}
        onHint={onHint}
      />
      <ThemedKeyboard
        keyBg={SURFACE}
        radius={4}
        text="#F0E6CC"
        dim="#8F8672"
        onKey={onKey}
        disabled={keyboardDisabled}
        hapticsEnabled={hapticsEnabled}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  glyph: { position: 'absolute' },
  module: { flex: 1, justifyContent: 'center' },
  readoutRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: 6 },
  railWrap: { marginHorizontal: 24 },
  railTrackWrap: { position: 'relative', height: 5 },
  burn: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  railUnderside: { height: 2, backgroundColor: 'rgba(0,0,0,.5)', alignSelf: 'stretch' },
  slotRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  slot: { position: 'relative', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  slotShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 0,
    elevation: 2,
  },
  fold: { position: 'absolute', left: 0, right: 0, top: '50%', height: 2 },
  stub: { width: 16, height: 3, marginBottom: 10, alignSelf: 'center', marginTop: 'auto' },
});

export default RoundGaming;
