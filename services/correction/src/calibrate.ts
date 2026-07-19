/**
 * Word self-calibration (P4-T7 — confidence-weighted rebuild).
 *
 * The signal is OBSERVED first-attempt solve rate vs the TARGET solve rate for the
 * word's tier. A word solved far more often than its tier's target is easier than
 * rated (difficulty drifts down), and vice versa. What Phase 4 changed:
 *
 *   correction magnitude SCALES WITH SAMPLE SIZE, from 5 players up.
 *     weight = min(1, uniquePlayers / SATURATION)   // 5 → 0.025, 200 → 1.0
 *     delta  = weight * gain * (target − observed)
 *
 * so a word with 5 players moves ~1–2 points, and one with 200 moves decisively —
 * replacing the old hard 30-attempt gate that did nothing until 30 then jumped.
 *
 * The guards (architect PART F):
 *  - F8: `weight` counts UNIQUE PLAYERS, not raw attempts — one grinder can't move a
 *    word alone.
 *  - F9: `observed` is the FIRST-attempt solve rate — a retry after a fail has
 *    answer-adjacent knowledge and is excluded from the signal.
 *  - F10: `maxNudge` bounds per-run movement below a tier width, and a nudge that
 *    would CROSS a tier boundary is never auto-applied (flagged for human review), so
 *    a word cannot oscillate across a boundary run after run.
 *  - F11: pre-3.0.0 evidence is dropped upstream (`calibrationEvents`).
 *  - Confounding guard: `weight` is further scaled by how broad the attempting
 *    players' score range is — a word tried only by a narrow band gives weak evidence.
 *
 * ⚠️ Scoring-coupling rule (unchanged): TIER-AT-PLAY IS FROZEN. Scoring always uses the
 * event's wordRatingAtPlay, never today's difficulty (proven by the replay freeze
 * test). A nudge that crosses a tier boundary is flagged, never auto-applied.
 */

import type { BankTier, WordEntry } from '@sabd/contracts';
import { defaultConfig, tierForDifficulty } from '@sabd/elo';
import { NOISE_FLOOR, type WordStats } from './aggregate.ts';

export interface CalibrationConfig {
  /** Target first-attempt solve rate per tier — what "correctly rated" looks like. */
  readonly targetSolveRate: Readonly<Partial<Record<BankTier, number>>>;
  /** Rating points of nudge per 1.0 of solve-rate error at FULL confidence. */
  readonly gain: number;
  /** Unique players at which the confidence weight saturates to 1.0. */
  readonly saturation: number;
  /** Max |nudge| per run — kept below a tier width so corrections stay slow (F10). */
  readonly maxNudge: number;
  /** Minimum DISTINCT players before a word is re-rated at all (F8). */
  readonly minPlayers: number;
  /**
   * Player-score range (max−min) at which the confounding guard reaches full weight;
   * narrower evidence is gently discounted (never below `spreadFloor`).
   */
  readonly spreadRef: number;
  /** Floor on the confounding-guard multiplier so narrow-but-real evidence still counts. */
  readonly spreadFloor: number;
}

export const defaultCalibration: CalibrationConfig = {
  // Unified four-tier scale (0–500). A veryEasy word should be solved by nearly
  // everyone (it greets score-0 players); hard words genuinely resist.
  targetSolveRate: { veryEasy: 0.85, easy: 0.72, medium: 0.55, hard: 0.4 },
  gain: 100,
  saturation: 200,
  maxNudge: 25,
  minPlayers: NOISE_FLOOR,
  spreadRef: 60,
  spreadFloor: 0.5,
};

export interface WordNudge {
  wordId: string;
  word: string;
  topic: string;
  uniquePlayers: number;
  solveRate: number;
  /** The confidence weight applied this run (uniquePlayers × spread guard) [0,1]. */
  weight: number;
  oldDifficulty: number;
  newDifficulty: number;
  oldTier: BankTier;
  newTier: BankTier;
}

export interface CalibrationProposal {
  /** Within-tier nudges — safe to auto-apply into the next bank PATCH. */
  autoNudges: WordNudge[];
  /** Tier crossings — scoring-visible; require human approval (T17). */
  flagged: WordNudge[];
  /** Words with data but below the minimum-players floor (report only). */
  belowFloor: number;
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** The confidence weight for a word's evidence: sample size × breadth, in [0,1]. */
export function confidenceWeight(stats: WordStats, config: CalibrationConfig): number {
  const sample = Math.min(1, stats.uniquePlayers / config.saturation);
  const breadth = clamp(stats.playerScoreSpread / config.spreadRef, config.spreadFloor, 1);
  return sample * breadth;
}

export function proposeCorrections(
  stats: readonly WordStats[],
  bank: readonly WordEntry[],
  config: CalibrationConfig = defaultCalibration,
): CalibrationProposal {
  const byId = new Map(bank.map((w) => [w.id, w]));
  const proposal: CalibrationProposal = { autoNudges: [], flagged: [], belowFloor: 0 };

  for (const s of stats) {
    const word = byId.get(s.wordId);
    if (!word) continue; // event for a word no longer in the bank — nothing to rate
    if (s.uniquePlayers < config.minPlayers) {
      proposal.belowFloor++;
      continue;
    }

    const oldTier = tierForDifficulty(word.difficulty, defaultConfig);
    const target = config.targetSolveRate[oldTier];
    if (target === undefined) continue; // tier with no configured target — skip

    const weight = confidenceWeight(s, config);
    // First-attempt signal (F9). Solved more than target → easier than rated → DOWN.
    const raw = weight * config.gain * (target - s.firstAttemptSolveRate);
    const nudge = clamp(Math.round(raw), -config.maxNudge, config.maxNudge);
    if (nudge === 0) continue;

    const newDifficulty = word.difficulty + nudge;
    const newTier = tierForDifficulty(newDifficulty, defaultConfig);
    const entry: WordNudge = {
      wordId: word.id,
      word: word.word,
      topic: word.topic,
      uniquePlayers: s.uniquePlayers,
      solveRate: s.firstAttemptSolveRate,
      weight,
      oldDifficulty: word.difficulty,
      newDifficulty,
      oldTier,
      newTier,
    };
    (newTier === oldTier ? proposal.autoNudges : proposal.flagged).push(entry);
  }

  return proposal;
}

/**
 * Apply corrections to a bank: auto nudges plus the APPROVED flagged ones. Returns
 * a new bank array; `tier` is re-derived from the new difficulty so the bank stays
 * internally consistent (slice cutting and future pay both follow it).
 */
export function applyCorrections(
  bank: readonly WordEntry[],
  nudges: readonly WordNudge[],
): WordEntry[] {
  const byId = new Map(nudges.map((n) => [n.wordId, n]));
  return bank.map((w) => {
    const n = byId.get(w.id);
    if (!n) return w;
    return { ...w, difficulty: n.newDifficulty, tier: tierForDifficulty(n.newDifficulty, defaultConfig) };
  });
}
