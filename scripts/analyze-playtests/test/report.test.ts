import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeWordStats, wordOutliers } from '../src/report/words.ts';
import { hintsReport } from '../src/report/hints.ts';
import { loopReport } from '../src/report/loop.ts';
import { makeRound } from './fixtures.ts';

test('wordOutliers flags an under-rated word (low tier, sub-50% solve) at n>=5', () => {
  const rounds = Array.from({ length: 6 }, (_, i) =>
    makeRound({
      roundId: `r${i}`,
      wordId: 'GAM-0002',
      wordRatingAtPlay: 900,
      solved: i < 2, // 2/6 ≈ 33%
    }),
  );
  const outliers = wordOutliers(computeWordStats(rounds));
  assert.equal(outliers.length, 1);
  assert.ok(outliers[0]!.flags.some((f) => f.includes('under-rated')));
});

test('wordOutliers stays silent on solve-rate flags below n=5 (no bare percentage)', () => {
  const rounds = Array.from({ length: 2 }, (_, i) =>
    makeRound({ roundId: `r${i}`, wordId: 'GAM-0003', wordRatingAtPlay: 900, solved: false }),
  );
  const outliers = wordOutliers(computeWordStats(rounds));
  // n=2 is below suppression — the under-rated flag (which needs solve_rate) must not fire.
  assert.equal(outliers.some((o) => o.flags.some((f) => f.includes('under-rated'))), false);
});

test('wordOutliers CAN still flag avg_hints≈2.0 at low n (non-percentage signal)', () => {
  const rounds = [
    makeRound({ roundId: 'r1', wordId: 'GAM-0004', hintsUsed: ['position', 'letters'] }),
    makeRound({ roundId: 'r2', wordId: 'GAM-0004', hintsUsed: ['position', 'letters'] }),
  ];
  const outliers = wordOutliers(computeWordStats(rounds));
  assert.equal(outliers.length, 1);
  assert.ok(outliers[0]!.flags.some((f) => f.includes('avg_hints')));
});

test('hintsReport flags a dominant single-hint pattern (design bug)', () => {
  const rounds = Array.from({ length: 6 }, (_, i) =>
    makeRound({ roundId: `r${i}`, hintsUsed: ['position'] }), // letters NEVER used
  );
  const text = hintsReport(rounds);
  assert.match(text, /decoration, not a mechanic/);
});

test('loopReport does not crash on a realistic multi-session, multi-player dataset', () => {
  const pseudonyms = new Map([['install-a', 'player_1']]);
  const rounds = [
    makeRound({ roundId: 'a', playedAt: 1_700_000_000_000 }),
    makeRound({ roundId: 'b', playedAt: 1_700_000_060_000 }),
    makeRound({ roundId: 'c', playedAt: 1_700_001_000_000 }), // new session, gap > 10min
  ];
  const text = loopReport(rounds, pseudonyms);
  assert.match(text, /Sessions/);
});
