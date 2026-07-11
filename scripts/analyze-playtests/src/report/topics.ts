/**
 * §3.5 — Topics: chosen ≠ enjoyed. A topic can be picked often and finished rarely —
 * that's a difficulty-seeding problem inside the topic, not an "unpopular topic"
 * problem. With 6 topics and ~8 players, expect most to have <20 rounds; the n is
 * what tells you how thin the ice is, which is why every rate here carries one.
 */
import type { RoundEvent } from '@sabd/contracts';
import { formatRate, formatStat, heading, median, table } from '../format.ts';

export function topicsReport(rounds: readonly RoundEvent[], pseudonyms: ReadonlyMap<string, string>): string {
  const byTopic = new Map<string, RoundEvent[]>();
  for (const r of rounds) {
    const list = byTopic.get(r.topic) ?? [];
    list.push(r);
    byTopic.set(r.topic, list);
  }

  const blocks = [...byTopic.entries()]
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([topic, topicRounds]) => {
      const uniquePlayers = new Set(topicRounds.map((r) => pseudonyms.get(r.installId) ?? r.installId)).size;
      const solved = topicRounds.filter((r) => r.solved);
      const times = solved.map((r) => r.timeUsedSec);
      const hints = topicRounds.map((r) => r.hintsUsed.length);
      return table([
        [topic, `${topicRounds.length} rounds`],
        ['  unique players', `${uniquePlayers}`],
        ['  solve rate', formatRate(solved.length, topicRounds.length)],
        ['  avg hints', formatStat(hints.reduce((a, b) => a + b, 0) / hints.length, topicRounds.length, 2)],
        ['  median time', formatStat(median(times), times.length)],
      ]);
    });

  return `${heading('3.5 — Topics: chosen ≠ enjoyed')}\n${blocks.join('\n\n')}`;
}
