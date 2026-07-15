/**
 * The why-you-earned-it line (T19): every non-zero component of the engine's
 * breakdown, so effort is legible — speed visibly pays, hints visibly cost,
 * the streak visibly compounds. e.g. "BASE 20 · SPEED +5 · HINTS −3 · STREAK +8".
 */
import type { RatingUpdate } from '@sabd/contracts';

export function breakdownLine(update: RatingUpdate): string {
  const b = update.breakdown;
  const parts = [`BASE ${b.tierBase}`];
  if (b.speedBonus > 0) parts.push(`SPEED +${b.speedBonus}`);
  if (b.hintPenalty < 0) parts.push(`HINTS ${b.hintPenalty}`);
  if (b.streakBonus > 0) parts.push(`STREAK +${b.streakBonus}`);
  return parts.join(' · ');
}
