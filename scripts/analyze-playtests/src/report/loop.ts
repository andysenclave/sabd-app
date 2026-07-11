/**
 * §3.1 — Is the round fun? Rounds per session. The decision it informs: whether the
 * core loop works at all. If this is bad, nothing else in the report matters.
 */
import type { RoundEvent } from '@sabd/contracts';
import { sessionsByPlayer } from '../sessions.ts';
import { formatStat, heading, median, percentile, table } from '../format.ts';

export function loopReport(rounds: readonly RoundEvent[], pseudonyms: ReadonlyMap<string, string>): string {
  const byPlayer = sessionsByPlayer(rounds, pseudonyms);
  const allSessions = [...byPlayer.values()].flat();
  const roundsPerSession = allSessions.map((s) => s.length);
  const sessionsPerPerson = [...byPlayer.values()].map((sessions) => sessions.length);

  const n = allSessions.length;
  const lines = table([
    ['Sessions', `${n}`],
    ['Rounds per session (median)', formatStat(median(roundsPerSession), n, 1)],
    ['Rounds per session (p25)', formatStat(percentile(roundsPerSession, 25), n, 1)],
    ['Rounds per session (p75)', formatStat(percentile(roundsPerSession, 75), n, 1)],
    ['Rounds per session (max)', n < 5 ? `insufficient data (n=${n})` : `${Math.max(...roundsPerSession)}`],
    ['Sessions per person (median)', formatStat(median(sessionsPerPerson), sessionsPerPerson.length, 1)],
  ]);

  const longest = [...allSessions].sort((a, b) => b.length - a.length)[0];
  const flag =
    longest && longest.length >= 15
      ? `\n  ⚡ A ${longest.length}-round session exists — that's your best signal in the dataset. Find out who and call them.`
      : '';

  return `${heading('3.1 — Is the round fun? (rounds per session)')}\n${lines}${flag}`;
}
