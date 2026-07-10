/**
 * Round component harness (dev) — exercises T12–T14 together:
 * the custom Keyboard fills the SlotRow, the Rekha burns via useRoundClock.
 *
 * This is NOT the real round: the round state machine (running → solved | timedout, hint
 * costs, input lock, the onRoundEnd seam) is T15, and full screen assembly is T17. This
 * screen exists to make the three components visible and interactive before then.
 */
import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { words } from '@sabd/wordbank';

import { useTheme } from '../src/theme';
import { useReducedMotion } from '../src/a11y/useReducedMotion';
import { useRoundClock, formatClock } from '../src/round/useRoundClock';
import { Keyboard, type KeyValue } from '../src/components/round/Keyboard';
import { RekhaRail } from '../src/components/round/RekhaRail';
import { SlotRow, type SlotModel } from '../src/components/round/SlotRow';

const TIME_LIMIT_SEC = 60;

export default function RoundDemo() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const target = words[0]; // GAMER (gaming)
  const answer = (target?.word ?? 'SABD').toUpperCase();

  const [typed, setTyped] = useState('');
  const [submitted, setSubmitted] = useState<null | 'correct' | 'wrong'>(null);
  const [startedAt] = useState(() => Date.now());

  const clock = useRoundClock({
    timeLimitSec: TIME_LIMIT_SEC,
    startedAt,
    running: submitted !== 'correct',
    reducedMotion,
  });

  const solved = submitted === 'correct';
  const locked = solved || clock.done;

  const onKey = useCallback(
    (key: KeyValue) => {
      if (locked) return;
      if (key === 'BACKSPACE') {
        setTyped((s) => s.slice(0, -1));
        setSubmitted(null);
        return;
      }
      if (key === 'ENTER') {
        if (typed.length === answer.length) setSubmitted(typed === answer ? 'correct' : 'wrong');
        return;
      }
      if (typed.length < answer.length) {
        setTyped((s) => s + key);
        setSubmitted(null);
      }
    },
    [answer, typed, locked],
  );

  const slots = useMemo<SlotModel[]>(() => {
    return Array.from({ length: answer.length }, (_, i) => {
      const char = typed[i];
      if (char !== undefined) {
        const state = submitted === 'correct' ? 'correct' : submitted === 'wrong' ? 'wrong' : 'typed';
        return { char, state };
      }
      if (i === typed.length && !locked) return { state: 'focused' };
      return { state: 'empty' };
    });
  }, [answer.length, typed, submitted, locked]);

  return (
    <View style={[styles.screen, { backgroundColor: t.colors.ink, paddingTop: insets.top + 24 }]}>
      {/* glance-only top (minimal; real GlanceBar is T17) */}
      <View style={styles.glance}>
        <Text style={{ fontFamily: t.font.display, fontSize: 14, letterSpacing: 1.5, color: t.accent() }}>
          {(target?.topic ?? 'SABD').toUpperCase()}
        </Text>
        <Text style={{ fontFamily: t.font.mono, fontSize: 14, color: t.colors.paper }}>◆ 1000</Text>
      </View>

      {/* word module, centered */}
      <View style={styles.module}>
        <RekhaRail
          progress={clock.progress}
          timeLabel={formatClock(clock.remainingSec)}
          critical={clock.critical}
          solved={solved}
          reducedMotion={reducedMotion}
        />
        <View style={{ height: 12 }} />
        <SlotRow slots={slots} />
        <Text style={[styles.desc, { fontFamily: t.font.body, color: t.colors.paperDim }]}>
          {target?.description ?? 'Type a word.'}
        </Text>
        {clock.done && !solved && (
          <Text style={[styles.verdict, { fontFamily: t.font.display, color: t.colors.paperDim }]}>TIME.</Text>
        )}
      </View>

      {/* control dock */}
      <View style={styles.dock}>
        <Keyboard onKey={onKey} disabled={locked} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingBottom: 14 },
  glance: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22 },
  module: { flex: 1, justifyContent: 'center' },
  desc: { fontSize: 15, lineHeight: 22, textAlign: 'center', paddingHorizontal: 44, paddingTop: 20, minHeight: 44 },
  verdict: { fontSize: 24, textAlign: 'center', letterSpacing: 1, paddingTop: 16 },
  dock: { paddingBottom: 8 },
});
