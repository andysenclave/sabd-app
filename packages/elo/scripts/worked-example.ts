/**
 * §6 first-session goal — worked example table.
 *
 * A 1300-rated (settled, K=32) player faces words rated 1000 / 1300 / 1600
 * across four scenarios. Prints E, s, delta, newRating as a Markdown table.
 *
 * Run: node scripts/worked-example.ts
 */

import { applyResult, type PlayerState, type RoundResult } from '../src/index.ts';

const player: PlayerState = { rating: 1300, gamesPlayed: 41 };
const wordRatings = [1000, 1300, 1600];

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

const fmt = (n: number, digits: number): string => (n === 0 ? 0 : n).toFixed(digits);

const rows: string[] = [
  '| Scenario | Word rating | E | s | delta | newRating |',
  '|---|---|---|---|---|---|',
];

for (const { label, round } of scenarios) {
  for (const opponentRating of wordRatings) {
    const result: RoundResult = {
      ...round,
      timeLimitSec: 60,
      opponentRating,
      playerRating: player.rating,
      gamesPlayed: player.gamesPlayed,
      mode: 'solo',
      challengeMode: false,
    };
    const u = applyResult(player, result);
    const delta = u.delta === 0 ? 0 : u.delta; // normalize -0
    rows.push(
      `| ${label} | ${opponentRating} | ${fmt(u.expected, 3)} | ${fmt(u.performance, 2)} | ${delta >= 0 ? '+' : ''}${delta} | ${u.newPlayerRating} |`,
    );
  }
}

console.log(rows.join('\n'));
