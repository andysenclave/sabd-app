/**
 * Onboarding panel ① — "the śabda story" (FB-001 / T19a, design 2026-07-15).
 * Opens the flow before the mechanics panels. The split-flap logo LOOPS
 * (शब्द → শব্দ → λέξη → SABD → …) until the user taps NEXT.
 *
 * Faithful to docs/phase-3/design/handoff/OnboardingStoryScreen.tsx with three
 * app-integration divergences, all deliberate:
 *  - card surface uses tokens `retro.surface` (#241F17), not the handoff's #161310 —
 *    that exact value was owner-verified invisible on a real OLED (2026-07-11
 *    phone-rendering pass); same class of fix, already approved.
 *  - font names map to the app's registered families (Khand covers Devanagari,
 *    per the mockup; RobotoCondensed added for the Greek row).
 *  - reduced motion: the board freezes on SABD, no loop (motion is decorative here).
 *
 * RN-safe mechanic per LOGO.md motion spec: rotateX on two clipped halves,
 * transform + opacity only (never animate textShadowRadius — Android renders it
 * as a rectangle).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { retro } from '@sabd/tokens';

import { fontFamily } from '../../theme/fonts.ts';

const T = {
  bg: retro.ground, // #0B0908 warm black — the logo lives here (LOGO.md)
  card: retro.surface, // #241F17 (see divergence note above)
  cream: retro.text, // #F0E6CC
  muted: retro.dim, // #8F8672
  brass: retro.brass, // #C98A2B
  brassEdge: retro.brassUnderside, // #6E4A12
  seam: retro.cardSeam, // rgba(0,0,0,.85)
};

const SLOT_W = 64;
const SLOT_H = 88;
const FLIP_MS = 350;
const STAG_MS = 105;
const GAP_MS = 750;
const REST_SABD_MS = 2600;

interface Glyph {
  ch: string;
  ff: string;
  fs: number;
}

// शब्द → শব্দ → λέξη → SABD (design ROWS, fonts mapped to app families).
const ROWS: Glyph[][] = [
  ['श', 'ब्द', '', ''].map((ch) => ({ ch, ff: fontFamily.brand, fs: 52 })),
  ['শ', 'ব্দ', '', ''].map((ch) => ({ ch, ff: fontFamily.bengali, fs: 42 })),
  ['λ', 'έ', 'ξ', 'η'].map((ch) => ({ ch, ff: fontFamily.greek, fs: 54 })),
  ['S', 'A', 'B', 'D'].map((ch) => ({ ch, ff: fontFamily.brand, fs: 62 })),
];

function FlapSlot({ glyph }: Readonly<{ glyph: Glyph }>) {
  const [shown, setShown] = useState(glyph);
  const [incoming, setIncoming] = useState<Glyph | null>(null);
  const spin = useRef(new Animated.Value(0)).current;
  const shudder = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (glyph.ch === shown.ch && glyph.ff === shown.ff) return;
    setIncoming(glyph);
    spin.setValue(0);
    Animated.timing(spin, {
      toValue: 1,
      duration: FLIP_MS,
      easing: Easing.bezier(0.55, 0, 0.92, 0.55), // gravity fall
      useNativeDriver: true,
    }).start(() => {
      setShown(glyph);
      setIncoming(null);
      shudder.setValue(0); // hard stop + 1.6px shudder (LOGO.md flap physics)
      Animated.sequence([
        Animated.timing(shudder, { toValue: 1.6, duration: 36, useNativeDriver: true }),
        Animated.timing(shudder, { toValue: 0, duration: 54, useNativeDriver: true }),
      ]).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glyph]);

  const half = (g: Glyph, pos: 'top' | 'bottom') => (
    <View style={[st.half, pos === 'top' ? st.halfTop : st.halfBottom]}>
      <Text
        style={[
          st.slotGlyph,
          { fontFamily: g.ff, fontSize: g.fs },
          pos === 'bottom' && { transform: [{ translateY: -SLOT_H / 2 }] },
        ]}
      >
        {g.ch}
      </Text>
    </View>
  );

  const flapRot = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-180deg'] });
  return (
    <Animated.View style={[st.slot, { transform: [{ translateY: shudder }] }]}>
      {half(incoming ?? shown, 'top')}
      {half(shown, 'bottom')}
      {incoming && (
        <Animated.View style={[st.flap, { transform: [{ perspective: 560 }, { rotateX: flapRot }] }]}>
          {half(shown, 'top') /* front face; RN backface hides the reverse */}
        </Animated.View>
      )}
      <View style={st.seam} />
    </Animated.View>
  );
}

function SplitFlapLogo({ playing }: Readonly<{ playing: boolean }>) {
  const [row, setRow] = useState(0);
  const [slotGlyphs, setSlotGlyphs] = useState<Glyph[]>(ROWS[0]!);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!playing) {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setSlotGlyphs(ROWS[3]!); // freeze on SABD
      return;
    }
    const next = (row + 1) % 4;
    const rest = row === 3 ? REST_SABD_MS : GAP_MS;
    for (let i = 0; i < 4; i++) {
      timers.current.push(
        setTimeout(
          () => setSlotGlyphs((g) => g.map((old, j) => (j === i ? ROWS[next]![i]! : old))),
          rest + i * STAG_MS,
        ),
      );
    }
    timers.current.push(setTimeout(() => setRow(next), rest + 3 * STAG_MS + FLIP_MS));
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [row, playing]);

  return (
    <View style={st.board} importantForAccessibility="no-hide-descendants">
      <View style={st.rail} />
      <View style={st.slots}>
        {slotGlyphs.map((g, i) => (
          <FlapSlot key={i} glyph={g} />
        ))}
      </View>
    </View>
  );
}

export interface StoryPanelProps {
  /** Loop the flip board; pass false under reduced motion (freezes on SABD). */
  animate: boolean;
  onNext: () => void;
  onSkip: () => void;
}

export function StoryPanel({ animate, onNext, onSkip }: StoryPanelProps) {
  const insets = useSafeAreaInsets();
  const [playing, setPlaying] = useState(animate);
  const next = useCallback(() => {
    setPlaying(false);
    onNext();
  }, [onNext]);

  // Safe-area handling IDENTICAL to the mechanics panels (app/onboarding.tsx): the
  // background fills behind the status bar and gesture bar, insets pad the content.
  // Same +40 / +24 as the other screens so SKIP and the CTA align across the flow.
  return (
    <View style={[st.screen, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip onboarding"
        onPress={onSkip}
        style={st.skip}
        hitSlop={12}
      >
        <Text style={st.skipText}>SKIP</Text>
      </Pressable>
      <View style={st.center}>
        <SplitFlapLogo playing={playing && animate} />
        <Text style={st.caption}>ŚABDA · SANSKRIT FOR WORD</Text>
        <Text accessibilityRole="header" style={st.title}>
          A WORD, BEING MANY WORDS
        </Text>
        <Text style={st.body}>
          In Sanskrit thought, the right word is proof enough. Here it gets sixty seconds — and a
          rating with your name on it.
        </Text>
      </View>
      <View style={st.dots} accessible accessibilityLabel="Step 1 of 4">
        {[0, 1, 2, 3].map((i) => (
          <View key={i} importantForAccessibility="no" style={[st.dot, i === 0 && st.dotOn]} />
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next"
        onPress={next}
        style={({ pressed }) => [st.cta, pressed && { opacity: 0.85 }]}
      >
        <Text style={st.ctaText}>NEXT</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg, paddingHorizontal: 28 },
  skip: { alignSelf: 'flex-end', minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  // letterSpacing 1 (not the handoff's 3) so SKIP is pixel-identical to the mechanics
  // panels' SKIP — same width, same left edge — with no shift when advancing panels.
  skipText: { fontFamily: fontFamily.mono, fontSize: 12, letterSpacing: 1, color: T.muted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  board: { alignItems: 'center', marginBottom: 40 },
  rail: {
    width: 316,
    height: 9,
    backgroundColor: T.brass,
    borderRadius: 2,
    borderBottomWidth: 2,
    borderBottomColor: T.brassEdge,
  },
  slots: { flexDirection: 'row', gap: 8, marginTop: 10 },
  slot: { width: SLOT_W, height: SLOT_H, backgroundColor: T.card, borderRadius: 4, overflow: 'hidden' },
  half: { position: 'absolute', left: 0, right: 0, height: SLOT_H / 2, overflow: 'hidden', backgroundColor: T.card },
  halfTop: { top: 0 },
  halfBottom: { bottom: 0 },
  flap: { position: 'absolute', top: 0, left: 0, right: 0, height: SLOT_H / 2, backgroundColor: T.card, zIndex: 3 },
  seam: { position: 'absolute', left: 0, right: 0, top: SLOT_H / 2 - 1.5, height: 3, backgroundColor: T.seam, zIndex: 4 },
  slotGlyph: {
    height: SLOT_H,
    width: '100%',
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: SLOT_H,
    color: T.cream,
  },
  caption: { fontFamily: fontFamily.mono, fontSize: 11, letterSpacing: 3, color: T.brass, marginBottom: 16 },
  title: { fontFamily: fontFamily.brand, fontSize: 30, letterSpacing: 2, color: T.cream, textAlign: 'center' },
  body: {
    fontFamily: fontFamily.body,
    fontSize: 16,
    lineHeight: 24,
    color: T.muted,
    textAlign: 'center',
    maxWidth: 300,
    marginTop: 14,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingBottom: 26 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(240,230,204,0.18)' },
  dotOn: { backgroundColor: T.brass },
  cta: {
    height: 56,
    backgroundColor: T.brass,
    borderRadius: 4,
    borderBottomWidth: 3,
    borderBottomColor: T.brassEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: fontFamily.brand, fontSize: 19, letterSpacing: 2, color: T.bg },
});
