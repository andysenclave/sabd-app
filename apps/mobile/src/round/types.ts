/** Shared round-state types — consumed by useRound.ts and every themed round screen. */

export type SlotState = 'empty' | 'focused' | 'typed' | 'given' | 'correct' | 'wrong';

export interface SlotModel {
  char?: string;
  state: SlotState;
}

export type KeyValue =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'
  | 'ENTER' | 'BACKSPACE';
