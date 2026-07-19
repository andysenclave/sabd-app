/**
 * Word self-calibration (T16 — REBUILD, points-era design).
 *
 * The Elo-era `updateWordRating` ran the Elo formula from the word's side; the
 * points engine has no expectedScore, so calibration is redesigned around the
 * signal we actually have: OBSERVED SOLVE RATE vs the TARGET solve rate for the
 * word's tier. A word solved far more often than its tier's target is easier than
 * rated (difficulty drifts down), and vice versa. Nudges are small (maxNudge per
 * weekly run) so a word converges over several runs — "corrections move ratings
 * slowly".
 *
 * ⚠️ Scoring-coupling rule (architect Lane 5, critical):
 *   difficulty → tier → base pay. So:
 *   1. TIER-AT-PLAY IS FROZEN — scoring always uses the event's wordRatingAtPlay,
 *      never today's difficulty. Historical scores never shift (replay test).
 *   2. A nudge that would CROSS a tier boundary is NEVER auto-applied — it is
 *      flagged for human review (it changes what future rounds pay).
 *   In-lane reading of "re-categorization": tier crossings (the scoring-visible
 *   change). Within-tier nudges auto-apply into the next bank PATCH version.
 */

import type { BankTier, WordEntry } from '@sabd/contracts';
import { defaultConfig, tierForDifficulty } from '@sabd/elo';
import { NOISE_FLOOR, type WordStats } from './aggregate.ts';

export interface CalibrationConfig {
  /** Target solve rate per tier — what "correctly rated" looks like. */
  readonly targetSolveRate: Readonly<Partial<Record<BankTier, number>>>;
  /** Rating points of nudge per 1.0 of solve-rate error. */
  readonly gain: number;
  /** Max |nudge| per run — keeps corrections slow. */
  readonly maxNudge: number;
  /** Attempts below this are noise; never re-rated. */
  readonly noiseFloor: number;
}

export const defaultCalibration: CalibrationConfig = {
  // Post-3.0.0-flip: the live bank is the UNIFIED four-tier scale (0–500). A veryEasy
  // word should be solved by nearly everyone (it greets score-0 players); hard words
  // should genuinely resist. Targets step down across the tiers.
  // NOTE (F11): pre-3.0.0 events carry old-scale wordRatingAtPlay; the confidence-
  // weighted rebuild (P4-T7) will discard that evidence. Aggregate solve RATE is
  // scale-independent, so today's nudges stay sound in the meantime.
  targetSolveRate: { veryEasy: 0.85, easy: 0.72, medium: 0.55, hard: 0.4 },
  // Smaller step on the unified scale (0–500 vs 800–2200): gain/maxNudge scaled ~1/4.
  gain: 100,
  maxNudge: 12,
  noiseFloor: NOISE_FLOOR,
};

export interface WordNudge {
  wordId: string;
  word: string;
  topic: string;
  attempts: number;
  solveRate: number;
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
  /** Words with data but below the noise floor (report only). */
  belowFloor: number;
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
    if (s.attempts < config.noiseFloor) {
      proposal.belowFloor++;
      continue;
    }

    const oldTier = tierForDifficulty(word.difficulty, defaultConfig);
    const target = config.targetSolveRate[oldTier];
    if (target === undefined) continue; // tier with no configured target — skip
    // Solved more than target → easier than rated → difficulty moves DOWN.
    const raw = config.gain * (target - s.solveRate);
    const nudge = Math.max(-config.maxNudge, Math.min(config.maxNudge, Math.round(raw)));
    if (nudge === 0) continue;

    const newDifficulty = word.difficulty + nudge;
    const newTier = tierForDifficulty(newDifficulty, defaultConfig);
    const entry: WordNudge = {
      wordId: word.id,
      word: word.word,
      topic: word.topic,
      attempts: s.attempts,
      solveRate: s.solveRate,
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
