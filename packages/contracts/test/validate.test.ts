import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateWordEntry,
  validateRoundResult,
  validateRoundEvent,
  validateExportFile,
  ROUND_EVENT_SCHEMA_VERSION,
} from '../src/index.ts';
import type { WordEntry, RoundResult, RoundEvent, ExportFile } from '../src/index.ts';

const goodWord: WordEntry = {
  id: 'GAM-0001',
  word: 'GAMER',
  topic: 'Gaming',
  length: 5,
  difficulty: 820,
  tier: 'low',
  description: 'Controller in hand, sleep optional',
  hints: {
    position: { index: 2, letter: 'M' },
    letters: { correct: 'R', decoy: 'T' },
  },
};

const goodResult: RoundResult = {
  solved: true,
  timeLimitSec: 60,
  timeUsedSec: 22,
  hintsUsed: ['position'],
  wordDifficulty: 820,
  mode: 'solo',
};

const goodEvent: RoundEvent = {
  roundId: 'r-uuid',
  schemaVersion: ROUND_EVENT_SCHEMA_VERSION,
  installId: 'i-uuid',
  playedAt: 1_700_000_000_000,
  wordId: 'GAM-0001',
  wordRatingAtPlay: 820,
  wordBankVersion: '1.0.0',
  topic: 'Gaming',
  solved: true,
  timeLimitSec: 60,
  timeUsedSec: 22,
  hintsUsed: ['position'],
  mode: 'solo',
  playerRatingBefore: 1200,
  engineConfigVersion: '1.0.0',
  syncedAt: null,
};

test('valid WordEntry passes', () => {
  assert.equal(validateWordEntry(goodWord).ok, true);
});

test('the real GAMER wordbank entry shape validates', () => {
  const r = validateWordEntry(goodWord);
  assert.equal(r.ok, true);
});

test('WordEntry rejects wrong tier vocabulary (easy/hard superseded)', () => {
  const r = validateWordEntry({ ...goodWord, tier: 'easy' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes('tier')));
});

test('WordEntry catches length/word mismatch', () => {
  const r = validateWordEntry({ ...goodWord, length: 6 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes('length')));
});

test('WordEntry reports every missing field, not just the first', () => {
  const r = validateWordEntry({});
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.length >= 5);
});

test('valid RoundResult passes', () => {
  assert.equal(validateRoundResult(goodResult).ok, true);
});

test('RoundResult rejects unknown hint', () => {
  const r = validateRoundResult({ ...goodResult, hintsUsed: ['position', 'reveal'] });
  assert.equal(r.ok, false);
});

test('RoundResult rejects duplicate hints', () => {
  const r = validateRoundResult({ ...goodResult, hintsUsed: ['position', 'position'] });
  assert.equal(r.ok, false);
});

test('valid RoundEvent passes; null syncedAt is allowed', () => {
  assert.equal(validateRoundEvent(goodEvent).ok, true);
});

test('RoundEvent allows optional anomaly flag', () => {
  assert.equal(validateRoundEvent({ ...goodEvent, anomaly: true }).ok, true);
});

test('RoundEvent rejects non-null non-number syncedAt', () => {
  const r = validateRoundEvent({ ...goodEvent, syncedAt: 'nope' });
  assert.equal(r.ok, false);
});

test('RoundEvent requires engineConfigVersion and wordRatingAtPlay (§4.1/§4.2)', () => {
  const { engineConfigVersion: _e, ...noConfig } = goodEvent;
  assert.equal(validateRoundEvent(noConfig).ok, false);
  const { wordRatingAtPlay: _w, ...noRating } = goodEvent;
  assert.equal(validateRoundEvent(noRating).ok, false);
});

const goodExport: ExportFile = {
  installId: 'i-uuid',
  schemaVersion: ROUND_EVENT_SCHEMA_VERSION,
  exportedAt: 1_700_000_100_000,
  rounds: [goodEvent],
};

test('valid ExportFile passes; empty rounds allowed', () => {
  assert.equal(validateExportFile(goodExport).ok, true);
  assert.equal(validateExportFile({ ...goodExport, rounds: [] }).ok, true);
});

test('ExportFile surfaces per-round errors with indexed paths', () => {
  const r = validateExportFile({ ...goodExport, rounds: [goodEvent, { bad: true }] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes('rounds[1]')));
});
