/**
 * Worked example — the points a solve is worth across tiers, streaks, and speed.
 *
 * Prints a Markdown table of `delta` (points earned) and the resulting score for a
 * player mid-streak facing low / mid / high words.
 *
 * Run: node scripts/worked-example.ts
 */

import { applyPoints, type PlayerState, type RoundResult } from '../src/index.ts';

// A player already on a 3-solve streak, score 240 (mid-tier territory).
const player: PlayerState = { rating: 240, streak: 3 };
const wordDifficulties = [1000, 1400, 1800]; // low / mid / high

interface Scenario {
  label: string;
  round: Pick<RoundResult, 'solved' | 'timeUsedSec' | 'hintsUsed'>;
}

const scenarios: Scenario[] = [
  { label: 'Instant no-hint solve (0s, 0 hints)', round: { solved: true, timeUsedSec: 0, hintsUsed: [] } },
  { label: 'Slow 2-hint solve (54s, 2 hints)', round: { solved: true, timeUsedSec: 54, hintsUsed: ['position', 'letters'] } },
  { label: 'Half-clock 1-hint solve (30s, 1 hint)', round: { solved: true, timeUsedSec: 30, hintsUsed: ['position'] } },
  { label: 'Timeout (not solved)', round: { solved: false, timeUsedSec: 60, hintsUsed: [] } },
];

const rows: string[] = [
  '| Scenario | Word difficulty | delta | new score | streak |',
  '|---|---|---|---|---|',
];

for (const { label, round } of scenarios) {
  for (const wordDifficulty of wordDifficulties) {
    const result: RoundResult = { ...round, timeLimitSec: 60, wordDifficulty, mode: 'solo' };
    const u = applyPoints(player, result);
    rows.push(
      `| ${label} | ${wordDifficulty} | +${u.delta} | ${u.newPlayerRating} | ${u.streak} |`,
    );
  }
}

console.log(rows.join('\n'));
