/**
 * §3.2 — Is the hint economy right? The decision it informs: hint costs
 * (position/letters) and word difficulty seeding. The dominant-hint check is the one
 * people miss: if nobody ever taps `position`, you built a button, not a mechanic.
 */
import type { RoundEvent } from '@sabd/contracts';
import { formatRate, heading, table } from '../format.ts';

export function hintsReport(rounds: readonly RoundEvent[]): string {
  const total = rounds.length;
  const zero = rounds.filter((r) => r.hintsUsed.length === 0);
  const one = rounds.filter((r) => r.hintsUsed.length === 1);
  const two = rounds.filter((r) => r.hintsUsed.length === 2);
  const positionOnly = one.filter((r) => r.hintsUsed[0] === 'position');
  const lettersOnly = one.filter((r) => r.hintsUsed[0] === 'letters');

  const solveRate = (subset: readonly RoundEvent[]): string =>
    formatRate(subset.filter((r) => r.solved).length, subset.length);

  const usage = table([
    ['Rounds with 0 hints', formatRate(zero.length, total)],
    ['Rounds with 1 hint', formatRate(one.length, total)],
    ['  · position-only', formatRate(positionOnly.length, one.length)],
    ['  · letters-only', formatRate(lettersOnly.length, one.length)],
    ['Rounds with 2 hints', formatRate(two.length, total)],
  ]);

  const solving = table([
    ['Solve rate | 0 hints', solveRate(zero)],
    ['Solve rate | 1 hint', solveRate(one)],
    ['Solve rate | 2 hints', solveRate(two)],
  ]);

  const flags: string[] = [];
  if (total >= 5) {
    const zeroPct = zero.length / total;
    const twoPct = two.length / total;
    if (zeroPct > 0.7) flags.push('⚡ >70% use zero hints — hints too expensive, or words too easy.');
    if (twoPct > 0.7) flags.push('⚡ >70% use both hints — hints too cheap, or words too hard.');
    if (one.length >= 5 && (positionOnly.length === 0 || lettersOnly.length === 0)) {
      flags.push(
        '⚡ One single-hint type is never used — that hint is decoration, not a mechanic. Design bug.',
      );
    }
  }

  const flagText = flags.length ? `\n${flags.map((f) => `  ${f}`).join('\n')}` : '';
  return `${heading('3.2 — Is the hint economy right?')}\n${usage}\n\n${solving}${flagText}`;
}
