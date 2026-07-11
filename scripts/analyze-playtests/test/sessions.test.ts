import { test } from 'node:test';
import assert from 'node:assert/strict';

import { groupIntoSessions, SESSION_GAP_MS, sessionsByPlayer } from '../src/sessions.ts';
import { makeRound } from './fixtures.ts';

test('a round exactly at the 10-minute boundary stays in the SAME session', () => {
  const t0 = 1_700_000_000_000;
  const a = makeRound({ roundId: 'a', playedAt: t0 });
  const b = makeRound({ roundId: 'b', playedAt: t0 + SESSION_GAP_MS }); // exactly 10:00 later
  const sessions = groupIntoSessions([a, b]);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0]!.length, 2);
});

test('a round one millisecond past the boundary starts a NEW session', () => {
  const t0 = 1_700_000_000_000;
  const a = makeRound({ roundId: 'a', playedAt: t0 });
  const b = makeRound({ roundId: 'b', playedAt: t0 + SESSION_GAP_MS + 1 });
  const sessions = groupIntoSessions([a, b]);
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0]!.length, 1);
  assert.equal(sessions[1]!.length, 1);
});

test('groupIntoSessions handles an empty list and a single round', () => {
  assert.deepEqual(groupIntoSessions([]), []);
  const single = groupIntoSessions([makeRound()]);
  assert.equal(single.length, 1);
  assert.equal(single[0]!.length, 1);
});

test('sessionsByPlayer partitions by pseudonym, not raw installId', () => {
  const pseudonyms = new Map([
    ['install-a', 'player_1'],
    ['install-b', 'player_2'],
  ]);
  const rounds = [
    makeRound({ installId: 'install-a', playedAt: 1_700_000_000_000 }),
    makeRound({ installId: 'install-b', playedAt: 1_700_000_000_000 }),
    makeRound({ installId: 'install-a', playedAt: 1_700_000_060_000 }),
  ];
  const byPlayer = sessionsByPlayer(rounds, pseudonyms);
  assert.equal(byPlayer.get('player_1')?.[0]?.length, 2);
  assert.equal(byPlayer.get('player_2')?.[0]?.length, 1);
});
