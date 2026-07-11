/**
 * T15 DoD — round state machine unit tests, including every Part-A round edge case
 * that belongs to the core: hint clamp-to-zero, rapid double-hint, submit spam after
 * ceremony, lock-wins position reveal, backspace skipping locked slots, and the
 * backgrounded-round wall-time reconciliation.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createRound,
  pressKey,
  applyHint,
  revealPosition,
  expireIfDue,
  remainingSec,
  timeUsedSec,
  type RoundCore,
} from '../src/round/roundMachine.ts';
import { gameConfig, type GameConfig } from '../src/round/config.ts';

const T0 = 1_700_000_000_000;
const at = (sec: number): number => T0 + sec * 1000;
const cfg: GameConfig = gameConfig; // 60s, position 8s, letters 5s

function type(core: RoundCore, word: string, now: number): RoundCore {
  let c = core;
  for (const ch of word) c = pressKey(c, { kind: 'letter', letter: ch }, now, cfg);
  return c;
}

test('happy path: type the answer, enter, solved; timeUsedSec is wall time', () => {
  let c = createRound('GAMER', T0);
  c = type(c, 'GAMER', at(12));
  c = pressKey(c, { kind: 'enter' }, at(12), cfg);
  assert.equal(c.status, 'solved');
  assert.equal(timeUsedSec(c, cfg), 12);
});

test('wrong guess: typed letters clear, given letters stay, wrongGuesses increments', () => {
  let c = createRound('GAMER', T0);
  c = applyHint(c, 'position', at(5), cfg);
  c = revealPosition(c, 2, 'M');
  c = type(c, 'GXYE', at(10)); // fills the 4 non-given slots
  c = pressKey(c, { kind: 'enter' }, at(10), cfg);
  assert.equal(c.status, 'running');
  assert.equal(c.wrongGuesses, 1);
  assert.deepEqual(
    c.cells.map((x) => x.char),
    [null, null, 'M', null, null], // lock survives the clear
  );
});

test('enter with an incomplete row is a no-op', () => {
  let c = createRound('GAMER', T0);
  c = type(c, 'GAM', at(5));
  const before = c;
  c = pressKey(c, { kind: 'enter' }, at(5), cfg);
  assert.equal(c, before);
});

test('input locks the moment status leaves running (submit/typing spam)', () => {
  let c = createRound('GAMER', T0);
  c = type(c, 'GAMER', at(10));
  c = pressKey(c, { kind: 'enter' }, at(10), cfg);
  assert.equal(c.status, 'solved');
  const solved = c;
  c = pressKey(c, { kind: 'enter' }, at(10.2), cfg); // ceremony spam
  c = pressKey(c, { kind: 'letter', letter: 'Q' }, at(10.4), cfg);
  c = pressKey(c, { kind: 'backspace' }, at(10.6), cfg);
  assert.equal(c, solved);
});

test('backspace skips locked slots and erases the last typed letter', () => {
  let c = createRound('GAMER', T0);
  c = applyHint(c, 'position', at(2), cfg);
  c = revealPosition(c, 4, 'R'); // last slot locked
  c = type(c, 'GAME', at(5)); // row now full: G A M E [R]
  c = pressKey(c, { kind: 'backspace' }, at(6), cfg);
  assert.deepEqual(
    c.cells.map((x) => x.char),
    ['G', 'A', 'M', null, 'R'], // E erased; locked R untouched
  );
  // Backspace with only the given letter left: nothing to erase.
  c = pressKey(c, { kind: 'backspace' }, at(7), cfg);
  c = pressKey(c, { kind: 'backspace' }, at(7), cfg);
  c = pressKey(c, { kind: 'backspace' }, at(7), cfg);
  c = pressKey(c, { kind: 'backspace' }, at(8), cfg);
  assert.deepEqual(
    c.cells.map((x) => x.char),
    [null, null, null, null, 'R'],
  );
});

test('position hint over an already-typed slot: the lock wins, no duplicate', () => {
  let c = createRound('GAMER', T0);
  c = type(c, 'GAXER', at(5)); // player put X where M belongs
  c = applyHint(c, 'position', at(6), cfg);
  c = revealPosition(c, 2, 'M');
  assert.deepEqual(
    c.cells.map((x) => x.char),
    ['G', 'A', 'M', 'E', 'R'],
  );
  assert.equal(c.cells[2]!.given, true);
});

test('hints are single-use: a rapid second tap is a no-op (no double cost)', () => {
  let c = createRound('GAMER', T0);
  c = applyHint(c, 'letters', at(3), cfg);
  c = applyHint(c, 'letters', at(3), cfg); // same second, double-tap
  assert.deepEqual(c.hintsUsed, ['letters']);
  assert.equal(c.penaltySec, cfg.hintCostSec.letters);
});

test('both hints stack their costs; remaining reflects wall time + penalties', () => {
  let c = createRound('GAMER', T0);
  c = applyHint(c, 'position', at(10), cfg); // −8
  c = applyHint(c, 'letters', at(10), cfg); // −5
  assert.equal(remainingSec(c, at(10), cfg), 60 - 10 - 13);
});

test('hint cost ≥ remaining clamps to zero and ends the round timedout', () => {
  let c = createRound('GAMER', T0);
  // 54s elapsed → 6s remain; position costs 8 > 6.
  c = applyHint(c, 'position', at(54), cfg);
  assert.equal(c.status, 'timedout');
  assert.equal(remainingSec(c, at(54), cfg), 0);
  assert.deepEqual(c.hintsUsed, ['position']); // the tap still counts as used
});

test('natural timeout via the tick authority', () => {
  let c = createRound('GAMER', T0);
  c = expireIfDue(c, at(59.9), cfg);
  assert.equal(c.status, 'running');
  c = expireIfDue(c, at(60.01), cfg);
  assert.equal(c.status, 'timedout');
  assert.equal(timeUsedSec(c, cfg), 60); // capped at the limit
});

test('backgrounded round: resume recomputes from startedAt; expired-away = timedout', () => {
  let c = createRound('GAMER', T0);
  c = type(c, 'GA', at(20));
  // App backgrounded at 20s, resumed at 75s — the clock never paused.
  c = expireIfDue(c, at(75), cfg);
  assert.equal(c.status, 'timedout');
  // And input after resume stays locked.
  const locked = c;
  c = pressKey(c, { kind: 'letter', letter: 'M' }, at(76), cfg);
  assert.equal(c, locked);
});

test('backgrounded but NOT expired: play continues with wall-time deducted', () => {
  let c = createRound('GAMER', T0);
  c = expireIfDue(c, at(30), cfg); // away 30s, still 30s left
  assert.equal(c.status, 'running');
  assert.equal(remainingSec(c, at(30), cfg), 30);
  c = type(c, 'GAMER', at(35));
  c = pressKey(c, { kind: 'enter' }, at(35), cfg);
  assert.equal(c.status, 'solved');
});

test('input arriving after wall-time expiry is refused even without a tick', () => {
  let c = createRound('GAMER', T0);
  c = type(c, 'GAMER', at(10));
  // No tick ran, but the enter lands at 61s — expiry is checked before honoring input.
  c = pressKey(c, { kind: 'enter' }, at(61), cfg);
  assert.equal(c.status, 'timedout');
});
