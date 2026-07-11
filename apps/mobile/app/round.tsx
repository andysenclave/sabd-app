/**
 * The round screen (T17) — locked layout 3a:
 *   glance bar (topic left, ◆ rating right, NOTHING tappable)
 *   → flexible space → word module centered (readout → rail → slots → description
 *     with 2-line reserve → chips row)
 *   → control dock (hint bar 48px → keyboard).
 * Back (edge-swipe / Android hardware) mid-round → confirm-abandon: an abandoned
 * rated round is a timeout, and the dialog says so plainly.
 *
 * End-of-round display here is MINIMAL (verdict + Δ + CTAs) — the real result
 * screens with the odometer ceremony are T20; the full motion ledger is T18.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, Platform, Pressable } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';
import type { RatingUpdate, WordEntry } from '@sabd/contracts';
import { wordBankVersion } from '@sabd/wordbank';
import { recordRound } from '@sabd/storage';

import { useTheme } from '../src/theme';
import { useStorageBoot } from '../src/storage/useStorageBoot';
import { getStorage } from '../src/storage/db';
import { useRound, type RoundEndSummary } from '../src/round/useRound';
import { selectWord } from '../src/round/selectWord';
import { Keyboard } from '../src/components/round/Keyboard';
import { RekhaRail } from '../src/components/round/RekhaRail';
import { SlotRow } from '../src/components/round/SlotRow';
import { HintBar } from '../src/components/round/HintBar';
import { LetterChips } from '../src/components/round/LetterChips';

export default function RoundScreen() {
  const storage = useStorageBoot();
  const [word, setWord] = useState<WordEntry | null>(null);

  // Pick the word once the rating is known (storage boots in one frame on device).
  useEffect(() => {
    if (storage.ready && word === null) setWord(selectWord(storage.rating));
  }, [storage.ready, storage.rating, word]);

  if (!storage.ready || word === null) {
    return word === null && storage.ready ? <TopicExhausted /> : <View style={styles.blank} />;
  }
  return <ActiveRound key={word.id} word={word} initialRating={storage.rating} />;
}

function ActiveRound({ word, initialRating }: Readonly<{ word: WordEntry; initialRating: number }>) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();

  const [update, setUpdate] = useState<RatingUpdate | null>(null);
  const roundIdRef = useRef(randomUUID());
  const pendingNavAction = useRef<(() => void) | null>(null);

  // ── The seam: one call, storage-side math only. ──────────────────────────
  const onRoundEnd = useCallback(
    (summary: RoundEndSummary) => {
      if (Platform.OS !== 'web') {
        try {
          const outcome = recordRound(getStorage().db, {
            roundId: roundIdRef.current,
            playedAt: Date.now(),
            word: { id: word.id, difficulty: word.difficulty, topic: word.topic },
            wordBankVersion,
            solved: summary.result.solved,
            timeLimitSec: summary.result.timeLimitSec,
            timeUsedSec: summary.result.timeUsedSec,
            hintsUsed: summary.result.hintsUsed,
            mode: summary.result.mode,
            challengeMode: false,
            ...(summary.anomaly ? { anomaly: true } : {}),
          });
          setUpdate(outcome.update);
        } catch (err) {
          console.error('round: recordRound failed', err);
        }
      }
      // Abandon flow: leave only after the round is recorded.
      pendingNavAction.current?.();
      pendingNavAction.current = null;
    },
    [word],
  );

  const round = useRound({ word, onRoundEnd });
  const statusRef = useRef(round.status);
  statusRef.current = round.status;

  // Back interception (edge-swipe + Android hardware back both land here).
  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      if (statusRef.current !== 'running') return;
      e.preventDefault();
      Alert.alert('Abandon this round?', 'Leaving a rated round counts as a timeout.', [
        { text: 'Keep playing', style: 'cancel' },
        {
          text: 'Abandon',
          style: 'destructive',
          onPress: () => {
            pendingNavAction.current = () => navigation.dispatch(e.data.action);
            round.abandon();
          },
        },
      ]);
    });
    return sub;
  }, [navigation, round]);

  const running = round.status === 'running';
  const solved = round.status === 'solved';

  return (
    <View style={[styles.screen, { backgroundColor: t.colors.ink, paddingTop: insets.top + 24 }]}>
      {/* Glance bar — nothing tappable (§6: back = edge swipe). */}
      <View style={styles.glance}>
        <Text
          style={{ fontFamily: t.font.display, fontSize: 14, letterSpacing: 1.5, color: t.accent() }}
        >
          {word.topic.toUpperCase()}
        </Text>
        <View style={styles.ratingChip}>
          <Text style={{ color: t.colors.kesar, fontSize: 10 }}>◆</Text>
          <Text style={{ fontFamily: t.font.mono, fontSize: 14, color: t.colors.paper }}>
            {update?.newPlayerRating ?? initialRating}
          </Text>
        </View>
      </View>

      {/* Word module — vertically centered. */}
      <View style={styles.module}>
        <RekhaRail
          progress={round.clock.progress}
          timeLabel={round.timeLabel}
          critical={round.clock.critical}
          solved={solved}
          reducedMotion={round.reducedMotion}
        />
        <View style={{ height: 12 }} />
        <SlotRow slots={round.slots} />
        {/* Description: 15px paper-dim, 2-line reserve, never reflows. */}
        <Text style={[styles.desc, { fontFamily: t.font.body, color: t.colors.paperDim }]}>
          {word.description}
        </Text>
        {round.hintsUsed.includes('letters') && (
          <LetterChips
            correct={word.hints.letters.correct}
            decoy={word.hints.letters.decoy}
            seed={word.id}
            reducedMotion={round.reducedMotion}
          />
        )}
        {!running && (
          <EndBeat
            solved={solved}
            answer={word.word.toUpperCase()}
            update={update}
            onNext={() => router.replace('/round')}
            onHome={() => router.dismissTo('/')}
          />
        )}
      </View>

      {/* Control dock — everything tappable lives down here. */}
      <View style={styles.dock}>
        <HintBar spent={round.hintsUsed} disabled={!running} onHint={round.takeHint} />
        <Keyboard onKey={round.onKey} disabled={!running} />
      </View>
    </View>
  );
}

/** Minimal end-of-round beat — superseded by the real result screens in T20. */
function EndBeat({
  solved,
  answer,
  update,
  onNext,
  onHome,
}: Readonly<{
  solved: boolean;
  answer: string;
  update: RatingUpdate | null;
  onNext: () => void;
  onHome: () => void;
}>) {
  const t = useTheme();
  const delta = update?.delta;
  return (
    <View style={styles.endBeat}>
      <Text
        style={{
          fontFamily: t.font.displayHeavy,
          fontSize: 28,
          letterSpacing: 1,
          color: solved ? t.colors.paper : t.colors.paperDim,
        }}
      >
        {solved ? 'SOLVED' : 'TIME.'}
      </Text>
      {!solved && (
        <Text style={{ fontFamily: t.font.mono, fontSize: 15, color: t.colors.paperDim }}>
          {answer}
        </Text>
      )}
      {delta !== undefined && (
        <Text
          style={{
            fontFamily: t.font.monoBold,
            fontSize: 18,
            color: solved ? t.colors.kesar : t.colors.paperDim,
          }}
        >
          {delta >= 0 ? `+${delta}` : `${delta}`} → {update!.newPlayerRating}
        </Text>
      )}
      <View style={styles.ctaRow}>
        <Pressable
          onPress={onNext}
          accessibilityRole="button"
          style={[styles.cta, solved && { backgroundColor: t.colors.kesar }]}
        >
          <Text
            style={{
              fontFamily: t.font.brand,
              fontSize: 16,
              letterSpacing: 1,
              color: solved ? t.colors.ink : t.colors.paperDim,
            }}
          >
            NEXT WORD
          </Text>
        </Pressable>
        <Pressable onPress={onHome} accessibilityRole="button" style={styles.cta}>
          <Text
            style={{ fontFamily: t.font.brand, fontSize: 16, letterSpacing: 1, color: t.colors.paperDim }}
          >
            HOME
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function TopicExhausted() {
  const t = useTheme();
  const router = useRouter();
  return (
    <View style={[styles.blank, { backgroundColor: t.colors.ink, justifyContent: 'center' }]}>
      <Text
        style={{
          fontFamily: t.font.body,
          fontSize: 15,
          color: t.colors.paperDim,
          textAlign: 'center',
          paddingHorizontal: 44,
        }}
      >
        You’ve played every word here — another topic awaits.
      </Text>
      <Pressable onPress={() => router.dismissTo('/')} style={[styles.cta, { alignSelf: 'center' }]}>
        <Text style={{ fontFamily: t.font.brand, fontSize: 16, color: t.colors.paperDim }}>HOME</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingBottom: 14 },
  blank: { flex: 1, backgroundColor: '#171A24', gap: 20 },
  glance: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  ratingChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  module: { flex: 1, justifyContent: 'center' },
  desc: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 44,
    paddingTop: 20,
    minHeight: 64, // 2-line reserve — never reflows
  },
  dock: { paddingBottom: 8 },
  endBeat: { alignItems: 'center', gap: 10, paddingTop: 18 },
  ctaRow: { flexDirection: 'row', gap: 12, paddingTop: 6 },
  cta: {
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
