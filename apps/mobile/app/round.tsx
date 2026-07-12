/**
 * The round screen — dispatches to the per-category themed screen (rev. 3,
 * DESIGN-SYSTEM.md §4/§8): each topic owns its own ground, slot geometry, and ambient
 * motion, structurally identical (glance bar → word module → control dock) but
 * visually bespoke per `docs/new-design/tsx-export/themed/`. The interaction model
 * (useRound, recordRound, usePreventRemove, a11y announcements) is unchanged — only
 * which chrome component renders differs per `word.topic`.
 *
 * Back (edge-swipe / Android hardware) mid-round → confirm-abandon: an abandoned
 * rated round is a timeout, and the dialog says so plainly.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Platform, AccessibilityInfo } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { randomUUID } from 'expo-crypto';
import type { RatingUpdate, TopicId, WordEntry } from '@sabd/contracts';
import { wordBankVersion } from '@sabd/wordbank';
import { playedWordIds, recordRound, topicRating } from '@sabd/storage';

import { useTheme } from '../src/theme';
import { useStorageBoot } from '../src/storage/useStorageBoot';
import { getStorage } from '../src/storage/db';
import { useRound, type RoundEndSummary } from '../src/round/useRound';
import { selectWord } from '../src/round/selectWord';
import { TOPICS } from '../src/home/topics';
import { LetterChips } from '../src/components/round/LetterChips';
import { RoundGaming } from '../src/components/round/themed/RoundGaming';
import { RoundSpace } from '../src/components/round/themed/RoundSpace';
import { RoundMusic } from '../src/components/round/themed/RoundMusic';
import { RoundInternet } from '../src/components/round/themed/RoundInternet';
import { RoundFood } from '../src/components/round/themed/RoundFood';
import { RoundWorld } from '../src/components/round/themed/RoundWorld';
import { ThemedEndBeat } from '../src/components/round/themed/ThemedEndBeat';
import { themedHues, acc } from '../src/theme/themed/themedTokens.ts';
import type { ThemedRoundProps } from '../src/components/round/themed/types.ts';

const THEMED_SCREENS: Record<TopicId, React.ComponentType<ThemedRoundProps>> = {
  gaming: RoundGaming,
  space: RoundSpace,
  music: RoundMusic,
  internet: RoundInternet,
  food: RoundFood,
  world: RoundWorld,
};

export default function RoundScreen() {
  const theme = useTheme();
  const storage = useStorageBoot();
  const params = useLocalSearchParams<{ topic?: string }>();
  const [word, setWord] = useState<WordEntry | null>(null);

  const topicMeta = TOPICS.find((t) => t.id === (params.topic as TopicId));

  // Pick the word once storage is ready (it boots in one frame on device). Difficulty
  // follows this TOPIC's score, not the global one — you can be served hard Gaming words
  // while still getting easy Music words.
  useEffect(() => {
    if (!storage.ready || word !== null) return;
    let exclude: ReadonlySet<string> | undefined;
    let score = 0;
    if (Platform.OS !== 'web') {
      try {
        const db = getStorage().db;
        // Persisted seenIds: every word this install has faced, straight from the log.
        exclude = playedWordIds(db);
        if (topicMeta) score = topicRating(db, topicMeta.bankTopic);
      } catch (err) {
        console.error('round: word selection lookup failed', err);
      }
    }
    setWord(
      selectWord({
        score,
        ...(topicMeta ? { topic: topicMeta.bankTopic } : {}),
        ...(exclude ? { exclude } : {}),
      }),
    );
  }, [storage.ready, word, topicMeta]);

  if (!storage.ready || word === null) {
    return word === null && storage.ready ? (
      <TopicExhausted />
    ) : (
      <View style={[styles.blank, { backgroundColor: theme.colors.ink }]} />
    );
  }
  return <ActiveRound key={word.id} word={word} initialRating={storage.rating} />;
}

function ActiveRound({ word, initialRating }: Readonly<{ word: WordEntry; initialRating: number }>) {
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
              ? `Solved. Plus ${outcome.update.delta} points, now ${outcome.update.newPlayerRating}. Streak ${outcome.update.streak}.`
              : summary.abandoned
                ? `Round abandoned. No points. Streak reset.`
                : `Time's up. The word was ${word.word.toUpperCase()}. No points. Streak reset.`,
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
  // word.topic is the bank's DISPLAY string ("Gaming"), not the lowercase TopicId —
  // map back via the bankTopic field (see @sabd/contracts: "WordEntry.topic is a
  // display string and stays `string`, not TopicId").
  const topicId = TOPICS.find((t) => t.bankTopic === word.topic)?.id ?? 'gaming';
  const ThemedScreen = THEMED_SCREENS[topicId];
  const a = acc(themedHues[topicId]);

  return (
    <ThemedScreen
      topicLabel={word.topic.toUpperCase()}
      rating={update?.newPlayerRating ?? initialRating}
      progress={round.clock.progress}
      timeLabel={round.timeLabel}
      critical={round.clock.critical}
      solved={solved}
      slots={round.slots}
      description={word.description}
      hintsUsed={round.hintsUsed}
      hintsDisabled={!running}
      onHint={round.takeHint}
      onKey={round.onKey}
      keyboardDisabled={!running}
      hapticsEnabled
      reducedMotion={round.reducedMotion}
      wrongGuesses={round.wrongGuesses}
      letterChips={
        round.hintsUsed.includes('letters') ? (
          <LetterChips
            correct={word.hints.letters.correct}
            decoy={word.hints.letters.decoy}
            seed={word.id}
            reducedMotion={round.reducedMotion}
            accentColor={a.main}
            textColor={a.bright}
          />
        ) : undefined
      }
      endBeat={
        !running ? (
          <ThemedEndBeat
            topic={topicId}
            solved={solved}
            answer={word.word.toUpperCase()}
            abandoned={round.abandoned}
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
        ) : undefined
      }
    />
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
      <Pressable accessibilityRole="button" onPress={() => router.dismissTo('/')} style={[styles.cta, { alignSelf: 'center' }]}>
        <Text style={{ fontFamily: t.font.brand, fontSize: 16, color: t.colors.paperDim }}>HOME</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, gap: 20 },
  cta: {
    minHeight: 44,
    paddingHorizontal: 22,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
