/**
 * World & Places — atlas (mockup 10g / RoundWorld.tsx). Map grid, lat/long
 * coordinates, dashed meridian rail, stamp-corner marks on filled slots, spinning
 * compass glyph.
 */
import { memo, useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming, withRepeat } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion as motionTokens, duration as durationTokens } from '@sabd/tokens';

import { useTheme } from '../../../theme';
import { usePingPong, useBlink, useDriftStyle } from '../../../theme/themed/ambient.ts';
import { themedHues, acc, ok } from '../../../theme/themed/themedTokens.ts';
import { slotMetrics } from '../../../round/slotLayout.ts';
import type { SlotModel } from '../../../round/types.ts';
import { GridPattern } from './GridPattern';
import { TopBar, HintDock, ThemedKeyboard, Description } from './ThemedChrome';
import type { ThemedRoundProps } from './types.ts';

const HUE = themedHues.world;
const a = acc(HUE);
const TEXT = '#EDE4FB';
const GROUND = '#0A0710';

function WorldSlot({ model, width, height, glyphSize }: { model: SlotModel; width: number; height: number; glyphSize: number }) {
  const t = useTheme();
  const focused = model.state === 'focused';
  const blink = useBlink(1000, !focused);
  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  const base = [styles.slot, { width, height }];
  if (focused) {
    return (
      <View style={[base, { backgroundColor: ok(0.5, 0.1, HUE, 0.24), borderColor: ok(0.8, 0.14, HUE, 0.8), borderWidth: 1 }]}>
        <Animated.View style={[styles.stub, { backgroundColor: ok(0.85, 0.14, HUE), shadowColor: ok(0.8, 0.16, HUE), shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }, blinkStyle]} />
      </View>
    );
  }
  if (model.state === 'empty') {
    return <View style={[base, { backgroundColor: ok(0.4, 0.07, HUE, 0.14), borderColor: a.borderDim, borderWidth: 1 }]} />;
  }
  const glyphColor = model.state === 'wrong' ? t.colors.signal : ok(0.9, 0.13, HUE);
  return (
    <View style={[base, { backgroundColor: ok(0.4, 0.09, HUE, 0.32), borderColor: a.border, borderWidth: 1 }]}>
      <View style={[styles.stampCorner, { borderLeftColor: ok(0.8, 0.14, HUE, 0.6), borderBottomColor: ok(0.8, 0.14, HUE, 0.6) }]} />
      <Text style={{ fontFamily: t.font.mono, fontWeight: '700', fontSize: glyphSize, color: glyphColor, textShadowColor: a.glow, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 }}>
        {model.char}
      </Text>
    </View>
  );
}

function CompassGlyph({ reducedMotion }: { reducedMotion: boolean }) {
  const spin = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    spin.value = withRepeat(withTiming(360, { duration: 26000 }), -1, false);
  }, [reducedMotion, spin]);
  // Static opacity, boosted past the mockup's raw .12 for real-phone visibility —
  // same OLED gotcha as every other themed screen's texture layer.
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }], opacity: 0.28 }));
  return (
    <Animated.Text pointerEvents="none" style={[styles.compass, { color: a.main }, style]}>
      ◈
    </Animated.Text>
  );
}

export const RoundWorld = memo(function RoundWorld({
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
  const glyph1 = usePingPong(0.24, 0.42, 3200, 0, reducedMotion);
  const glyph1Style = useAnimatedStyle(() => ({ opacity: glyph1.value }));
  const glyphDrift = useDriftStyle(18000, 4000, reducedMotion);
  // k-ember: brightness pulse on the filled rail, approximated via shadow intensity.
  const emberPulse = usePingPong(0.7, 1, 1100, 0, reducedMotion);
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
      {/* Same OLED low-alpha fix as Internet's grid — see RoundInternet.tsx. */}
      <GridPattern size={34} color={ok(0.65, 0.12, HUE, 0.26)} />
      <Animated.View style={[StyleSheet.absoluteFill, glyphDrift]} pointerEvents="none">
        <Animated.Text style={[styles.driftGlyph, { left: '7%', top: '16%', fontSize: 20, color: a.main, transform: [{ rotate: '-6deg' }] }, glyph1Style]}>
          ◉
        </Animated.Text>
        {/* Static in the mockup (no k-glyph pulse) — opacity boosted past its raw .11 for phone visibility. */}
        <Text style={[styles.driftGlyph, { right: '9%', top: '21%', fontSize: 14, color: a.main, opacity: 0.28, transform: [{ rotate: '8deg' }] }]}>
          ▲
        </Text>
        <View style={[styles.driftGlyph, { left: '77%', bottom: '33%' }]}>
          <CompassGlyph reducedMotion={reducedMotion} />
        </View>
      </Animated.View>

      <TopBar label={topicLabel} labelColor={ok(0.82, 0.14, HUE)} rating={rating} diamondColor={a.main} textColor={TEXT} />

      <View style={styles.module}>
        <View style={styles.readoutRow}>
          <Text style={{ fontFamily: t.font.mono, fontSize: 10, letterSpacing: 1, color: ok(0.65, 0.07, HUE) }}>60°N · 07°E</Text>
          <Text style={{ fontFamily: t.font.mono, fontSize: 13, color: critical ? t.colors.signal : ok(0.85, 0.14, HUE) }}>{timeLabel}</Text>
        </View>
        <View style={styles.railWrap}>
          <View style={[StyleSheet.absoluteFill, styles.dashedTrack, { borderColor: 'rgba(237,228,251,.35)' }]} />
          <Animated.View
            style={[styles.burn, { backgroundColor: solved ? ok(0.8, 0.14, HUE) : critical ? t.colors.signal : ok(0.8, 0.14, HUE), shadowColor: ok(0.75, 0.16, HUE, 0.85), shadowOffset: { width: 0, height: 0 } }, emberStyle, !solved && railStyle, solved && { width: '100%' }]}
          />
        </View>
        <Animated.View style={[styles.slotRow, { gap: m.gap }, shakeStyle]}>
          {slots.map((s, i) => (
            <WorldSlot key={i} model={s} width={m.width} height={m.height} glyphSize={m.glyph} />
          ))}
        </Animated.View>
        <Description color={ok(0.72, 0.05, HUE)}>{description}</Description>
        {letterChips}
        {endBeat}
      </View>

      <HintDock
        bg={ok(0.4, 0.09, HUE, 0.28)}
        border={a.hintBorder}
        radius={4}
        accent={ok(0.8, 0.14, HUE)}
        text={TEXT}
        dim={ok(0.62, 0.05, HUE)}
        spent={hintsUsed}
        disabled={hintsDisabled}
        onHint={onHint}
      />
      <ThemedKeyboard
        keyBg={ok(0.35, 0.07, HUE, 0.42)}
        radius={4}
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
  driftGlyph: { position: 'absolute' },
  compass: { fontSize: 22 },
  module: { flex: 1, justifyContent: 'center' },
  readoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 8 },
  railWrap: { position: 'relative', height: 3, marginHorizontal: 24 },
  dashedTrack: { borderTopWidth: 1, borderStyle: 'dashed', top: 1 },
  burn: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  slotRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
  slot: { alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' },
  stub: { width: 16, height: 3, marginBottom: 10 },
  stampCorner: { position: 'absolute', left: 4, top: 4, width: 6, height: 6, borderLeftWidth: 1, borderBottomWidth: 1 },
});

export default RoundWorld;
