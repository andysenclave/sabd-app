/**
 * The prop contract every themed Round screen implements. round.tsx renders whichever
 * one matches `word.topic`, passing the SAME live game state/handlers from useRound —
 * only the visual chrome differs per topic, never the interaction model.
 */
import type { ReactNode } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import type { PaidHint } from '@sabd/contracts';
import type { SlotModel, KeyValue } from '../../../round/types.ts';

export interface ThemedRoundProps {
  topicLabel: string;
  rating: number;
  progress: SharedValue<number>;
  timeLabel: string;
  critical: boolean;
  solved: boolean;
  slots: readonly SlotModel[];
  description: string;
  hintsUsed: readonly PaidHint[];
  hintsDisabled: boolean;
  onHint: (hint: PaidHint) => void;
  onKey: (key: KeyValue) => void;
  keyboardDisabled: boolean;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  wrongGuesses: number;
  /** Rendered right after the description when the Letters hint has been used. */
  letterChips?: ReactNode;
  /** Rendered inside the word module, right after the description, when the round ends. */
  endBeat?: ReactNode;
}
