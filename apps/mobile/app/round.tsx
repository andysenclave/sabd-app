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
import { View, Text, StyleSheet, Alert, Platform, Pressable, AccessibilityInfo } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';
import type { RatingUpdate, TopicId, WordEntry } from '@sabd/contracts';
import { wordBankVersion } from '@sabd/wordbank';
import { playedWordIds, recordRound } from '@sabd/storage';

import { useTheme } from '../src/theme';
import { useStorageBoot } from '../src/storage/useStorageBoot';
import { getStorage } from '../src/storage/db';
import { useRound, type RoundEndSummary } from '../src/round/useRound';
import { selectWord } from '../src/round/selectWord';
import { TOPICS } from '../src/home/topics';
import { Keyboard } from '../src/components/round/Keyboard';
import { RekhaRail } from '../src/components/round/RekhaRail';
import { SlotRow } from '../src/components/round/SlotRow';
import { HintBar } from '../src/components/round/HintBar';
import { LetterChips } from '../src/components/round/LetterChips';
import { Odometer } from '../src/components/result/Odometer';

export default function RoundScreen() {
  const storage = useStorageBoot();
  const params = useLocalSearchParams<{ topic?: string }>();
  const [word, setWord] = useState<WordEntry | null>(null);

  const topicMeta = TOPICS.find((t) => t.id === (params.topic as TopicId));

  // Pick the word once the rating is known (storage boots in one frame on device).
  useEffect(() => {
    if (!storage.ready || word !== null) return;
    // Persisted seenIds: every word this install has faced, straight from the log.
    let exclude: ReadonlySet<string> | undefined;
    if (Platform.OS !== 'web') {
      try {
        exclude = playedWordIds(getStorage().db);
      } catch (err) {
        console.error('round: playedWordIds failed', err);
      }
    }
    setWord(
      selectWord({
        rating: storage.rating,
        ...(topicMeta ? { topic: topicMeta.bankTopic } : {}),
        ...(exclude ? { exclude } : {}),
      }),
    );
  }, [storage.ready, storage.rating, word, topicMeta]);

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
  const params = useLocalSearchParams<{ topic?: string }>();

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
          AccessibilityInfo.announceForAccessibility(
            summary.result.solved
              ? `Solved. Rating ${outcome.update.delta >= 0 ? '+' : ''}${outcome.update.delta}, now ${outcome.update.newPlayerRating}.`
              : `Time's up. The word was ${word.word.toUpperCase()}. Rating ${outcome.update.delta}, now ${outcome.update.newPlayerRating}.`,
          );
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

  // Back interception (edge-swipe + Android hardware back both land here).
  // usePreventRemove (not a manual beforeRemove listener) is required for native-stack:
  // a plain listener + preventDefault() races the native pop and leaves JS/native nav
  // state out of sync ("screen was removed natively but didn't get removed from JS state").
  usePreventRemove(round.status === 'running', ({ data }) => {
    Alert.alert('Abandon this round?', 'Leaving a rated round counts as a timeout.', [
      { text: 'Keep playing', style: 'cancel' },
      {
        text: 'Abandon',
        style: 'destructive',
        onPress: () => {
          pendingNavAction.current = () => navigation.dispatch(data.action);
          round.abandon();
        },
      },
    ]);
  });

  const running = round.status === 'running';
  const solved = round.status === 'solved';

  return (
    <View style={[styles.screen, { backgroundColor: t.colors.ink, paddingTop: insets.top + 24 }]}>
      {/* Glance bar — nothing tappable (§6: back = edge swipe). */}
      <View
        style={styles.glance}
        accessible
        accessibilityLabel={`Topic: ${word.topic}, rating ${update?.newPlayerRating ?? initialRating}`}
      >
        <Text
          style={{ fontFamily: t.font.display, fontSize: 14, letterSpacing: 1.5, color: t.accent() }}
        >
          {word.topic.toUpperCase()}
        </Text>
        <View style={styles.ratingChip}>
          <Text importantForAccessibility="no" style={{ color: t.colors.kesar, fontSize: 10 }}>
            ◆
          </Text>
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
          wrongGuesses={round.wrongGuesses}
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
            initialRating={initialRating}
            reducedMotion={round.reducedMotion}
            onNext={() =>
              router.replace({
                pathname: '/round',
                params: params.topic ? { topic: params.topic } : {},
              })
            }
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

/**
 * The end-of-round beat (T20). Win: verdict, odometer rating roll (kesar +Δ),
 * NEXT WORD is the one kesar CTA. Timeout: "TIME." in paper-dim, dim answer fill,
 * small −Δ, BOTH CTAs ghost — restraint on loss is what makes the win worth something.
 */
function EndBeat({
  solved,
  answer,
  update,
  initialRating,
  reducedMotion,
  onNext,
  onHome,
}: Readonly<{
  solved: boolean;
  answer: string;
  update: RatingUpdate | null;
  initialRating: number;
  reducedMotion: boolean;
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

      {update && delta !== undefined && (
        <View style={styles.ratingBeat}>
          {solved ? (
            <Odometer
              from={initialRating}
              to={update.newPlayerRating}
              reducedMotion={reducedMotion}
              fontSize={40}
            />
          ) : (
            <Text style={{ fontFamily: t.font.monoBold, fontSize: 22, color: t.colors.paperDim }}>
              {update.newPlayerRating}
            </Text>
          )}
          <Text
            style={{
              fontFamily: t.font.mono,
              fontSize: solved ? 16 : 13,
              color: solved ? t.colors.kesar : t.colors.paperDim,
              marginTop: 2,
            }}
          >
            {delta >= 0 ? `+${delta}` : `${delta}`}
          </Text>
        </View>
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
            {solved ? 'NEXT WORD' : 'RETRY TOPIC'}
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
      <Pressable
        accessibilityRole="button"
        onPress={() => router.dismissTo('/')}
        style={[styles.cta, { alignSelf: 'center' }]}
      >
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
  ratingBeat: { alignItems: 'center', marginVertical: 4 },
  ctaRow: { flexDirection: 'row', gap: 12, paddingTop: 6 },
  cta: {
    minHeight: 44,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
