/**
 * Themed end-of-round beat (win/timeout) — no mockup exists for this (the rev. 3
 * handoff explicitly left Result screens "not yet themed, flag before build"; the
 * owner chose to theme it anyway). Extrapolated from each category's own Round-screen
 * accent vocabulary (`acc()`/`themedHues`) applied to the app's existing win/timeout
 * structure (verdict, word reveal, odometer rating beat, CTAs) — the layout doesn't
 * change per category, only the color. Timeout stays deliberately muted even on-theme,
 * per DESIGN-SYSTEM.md's "losses get no drama."
 */
import { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { RatingUpdate, TopicId } from '@sabd/contracts';

import { useTheme } from '../../../theme';
import { themedHues, acc } from '../../../theme/themed/themedTokens.ts';
import { Odometer } from '../../result/Odometer';

export interface ThemedEndBeatProps {
  topic: TopicId;
  solved: boolean;
  answer: string;
  /** Ended via back-gesture abandon, not a natural clock expiry — never reveal the
   * word for this: the player chose to leave, spoiling it serves nothing. */
  abandoned: boolean;
  update: RatingUpdate | null;
  initialRating: number;
  reducedMotion: boolean;
  onNext: () => void;
  onHome: () => void;
}

export const ThemedEndBeat = memo(function ThemedEndBeat({
  topic,
  solved,
  answer,
  abandoned,
  update,
  initialRating,
  reducedMotion,
  onNext,
  onHome,
}: ThemedEndBeatProps) {
  const t = useTheme();
  const a = acc(themedHues[topic]);
  const delta = update?.delta;

  return (
    <View style={styles.endBeat}>
      <Text
        style={{
          fontFamily: t.font.displayHeavy,
          fontSize: 28,
          letterSpacing: 1,
          color: solved ? a.bright : t.colors.paperDim,
          textShadowColor: solved ? a.glow : 'transparent',
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: solved ? 14 : 0,
        }}
      >
        {solved ? 'SOLVED' : abandoned ? 'ABANDONED.' : 'TIME.'}
      </Text>
      {!solved && !abandoned && (
        <Text style={{ fontFamily: t.font.mono, fontSize: 15, color: t.colors.paperDim }}>{answer}</Text>
      )}

      {update && delta !== undefined && (
        <View style={styles.ratingBeat}>
          {solved ? (
            <Odometer from={initialRating} to={update.newPlayerRating} reducedMotion={reducedMotion} fontSize={40} />
          ) : (
            <Text style={{ fontFamily: t.font.monoBold, fontSize: 22, color: t.colors.paperDim }}>
              {update.newPlayerRating}
            </Text>
          )}
          {/* Points only ever climb: on a solve show the gain, on a miss show nothing lost. */}
          <Text
            style={{
              fontFamily: t.font.mono,
              fontSize: solved ? 16 : 13,
              color: solved ? a.main : t.colors.paperDim,
              marginTop: 2,
            }}
          >
            {solved ? `+${delta}` : 'no points'}
          </Text>
          {solved && update.streak >= 2 && (
            <Text style={{ fontFamily: t.font.mono, fontSize: 12, letterSpacing: 1, color: a.main, marginTop: 4 }}>
              {`STREAK ${update.streak}`}
            </Text>
          )}
        </View>
      )}

      <View style={styles.ctaRow}>
        <Pressable onPress={onNext} accessibilityRole="button" style={[styles.cta, solved && { backgroundColor: a.main }]}>
          <Text
            style={{
              fontFamily: t.font.brand,
              fontSize: 16,
              letterSpacing: 1,
              color: solved ? '#0B0908' : t.colors.paperDim,
            }}
          >
            {solved ? 'NEXT WORD' : 'RETRY TOPIC'}
          </Text>
        </Pressable>
        <Pressable onPress={onHome} accessibilityRole="button" style={styles.cta}>
          <Text style={{ fontFamily: t.font.brand, fontSize: 16, letterSpacing: 1, color: t.colors.paperDim }}>HOME</Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
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
