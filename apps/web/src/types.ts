// SABD — SHARED CONTRACT (§2 of sabd-game-ui.md). Do NOT change field names/shapes.

/** One word the round screen consumes. */
export interface WordEntry {
  id: string;
  word: string;
  topic: string;
  length: number;
  difficulty: number;
  tier: 'low' | 'mid' | 'high';
  description: string;
  hints: {
    /** index is 0-based — box 0 is the first box. */
    position: { index: number; letter: string };
    letters: { correct: string; decoy: string };
  };
}

export type HintId = 'position' | 'letters';

/** What the UI emits when a round ends — handed to the rating engine later. */
export interface RoundResult {
  solved: boolean;
  timeLimitSec: number;
  timeUsedSec: number;
  hintsUsed: HintId[];
  mode: 'solo';
}
