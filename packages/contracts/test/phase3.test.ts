/**
 * Phase-3 contract tests (T1/T2): sync payloads + word slices + the canonical
 * topic mapping. Style mirrors validate.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BANK_TOPICS,
  ROUND_EVENT_SCHEMA_VERSION,
  TOPIC_IDS,
  WORD_SLICE_SCHEMA_VERSION,
  topicIdForBankTopic,
  validateCategoryScore,
  validatePlayerSnapshot,
  validateSyncUploadRequest,
  validateSyncUploadResponse,
  validateWordSlice,
  validateWordSliceManifest,
} from '../src/index.ts';
import type {
  CategoryScore,
  PlayerSnapshot,
  RoundEvent,
  SyncUploadRequest,
  SyncUploadResponse,
  WordEntry,
  WordSlice,
  WordSliceManifest,
} from '../src/index.ts';

// ─── fixtures ────────────────────────────────────────────────────────────────

const goodEvent: RoundEvent = {
  roundId: 'r-uuid-1',
  schemaVersion: ROUND_EVENT_SCHEMA_VERSION,
  installId: 'i-uuid',
  playedAt: 1_800_000_000_000,
  wordId: 'GAM-0001',
  wordRatingAtPlay: 820,
  wordBankVersion: '1.0.0',
  topic: 'Gaming',
  solved: true,
  timeLimitSec: 60,
  timeUsedSec: 22,
  hintsUsed: ['position'],
  mode: 'solo',
  playerRatingBefore: 40,
  engineConfigVersion: '2.0.0',
  syncedAt: null,
};

const goodCategory: CategoryScore = {
  topic: 'Gaming',
  score: 120,
  streak: 3,
  gamesPlayed: 9,
};

const goodSnapshot: PlayerSnapshot = {
  installId: 'i-uuid',
  engineConfigVersion: '2.0.0',
  global: { score: 150, streak: 0, gamesPlayed: 12 },
  categories: [goodCategory],
  totalRounds: 12,
  computedAt: 1_800_000_000_000,
};

const goodUpload: SyncUploadRequest = {
  installId: 'i-uuid',
  schemaVersion: ROUND_EVENT_SCHEMA_VERSION,
  events: [goodEvent],
};

const goodUploadResponse: SyncUploadResponse = {
  acceptedRoundIds: ['r-uuid-1'],
  duplicateRoundIds: [],
  rejectedRoundIds: [],
  snapshot: goodSnapshot,
};

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

const goodSlice: WordSlice = {
  schemaVersion: WORD_SLICE_SCHEMA_VERSION,
  wordBankVersion: '1.1.0',
  topicId: 'gaming',
  topic: 'Gaming',
  tier: 'low',
  sliceVersion: 3,
  words: [goodWord],
};

const goodManifest: WordSliceManifest = {
  schemaVersion: WORD_SLICE_SCHEMA_VERSION,
  wordBankVersion: '1.1.0',
  generatedAt: '2026-07-15T00:00:00.000Z',
  slices: [
    {
      topicId: 'gaming',
      topic: 'Gaming',
      tier: 'low',
      sliceVersion: 3,
      url: 'slices/gaming/low/v3.json',
      wordCount: 1,
      bytes: 512,
      sha256: 'a'.repeat(64),
    },
  ],
};

// ─── topic mapping ───────────────────────────────────────────────────────────

test('BANK_TOPICS covers every TopicId with a non-empty display string', () => {
  for (const id of TOPIC_IDS) {
    assert.ok(BANK_TOPICS[id].length > 0, `missing bank topic for ${id}`);
  }
});

test('topicIdForBankTopic round-trips every canonical topic', () => {
  for (const id of TOPIC_IDS) {
    assert.equal(topicIdForBankTopic(BANK_TOPICS[id]), id);
  }
});

test('topicIdForBankTopic returns undefined for unknown topics', () => {
  assert.equal(topicIdForBankTopic('Cooking'), undefined);
  assert.equal(topicIdForBankTopic('gaming'), undefined); // ids are not display strings
});

// ─── CategoryScore / PlayerSnapshot ──────────────────────────────────────────

test('valid CategoryScore passes', () => {
  assert.equal(validateCategoryScore(goodCategory).ok, true);
});

test('CategoryScore rejects a negative score (points are monotonic from 0)', () => {
  const r = validateCategoryScore({ ...goodCategory, score: -5 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes('score')));
});

test('valid PlayerSnapshot passes', () => {
  assert.equal(validatePlayerSnapshot(goodSnapshot).ok, true);
});

test('PlayerSnapshot rejects a bad category entry with a dotted path', () => {
  const r = validatePlayerSnapshot({
    ...goodSnapshot,
    categories: [{ ...goodCategory, streak: -1 }],
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes('categories[0].streak')));
});

// ─── SyncUploadRequest / Response ────────────────────────────────────────────

test('valid SyncUploadRequest passes', () => {
  assert.equal(validateSyncUploadRequest(goodUpload).ok, true);
});

test('SyncUploadRequest rejects an event from a different install (mixed batch)', () => {
  const r = validateSyncUploadRequest({
    ...goodUpload,
    events: [{ ...goodEvent, installId: 'someone-else' }],
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes('does not match batch installId')));
});

test('SyncUploadRequest rejects a malformed event in the batch', () => {
  const r = validateSyncUploadRequest({
    ...goodUpload,
    events: [{ ...goodEvent, solved: 'yes' }],
  });
  assert.equal(r.ok, false);
});

test('valid SyncUploadResponse passes', () => {
  assert.equal(validateSyncUploadResponse(goodUploadResponse).ok, true);
});

test('SyncUploadResponse requires all three id lists', () => {
  const { duplicateRoundIds: _drop, ...rest } = goodUploadResponse;
  const r = validateSyncUploadResponse(rest);
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes('duplicateRoundIds')));
});

// ─── Word slices ─────────────────────────────────────────────────────────────

test('valid WordSlice passes', () => {
  assert.equal(validateWordSlice(goodSlice).ok, true);
});

test('WordSlice rejects a word whose topic does not match the slice', () => {
  const r = validateWordSlice({
    ...goodSlice,
    words: [{ ...goodWord, topic: 'Music' }],
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes('does not match slice topic')));
});

test('WordSlice rejects a word whose tier does not match the slice', () => {
  const r = validateWordSlice({
    ...goodSlice,
    words: [{ ...goodWord, tier: 'mid' }],
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes('does not match slice tier')));
});

test('valid WordSliceManifest passes', () => {
  assert.equal(validateWordSliceManifest(goodManifest).ok, true);
});

test('WordSliceManifest rejects duplicate (topicId × tier) slices', () => {
  const r = validateWordSliceManifest({
    ...goodManifest,
    slices: [goodManifest.slices[0], { ...goodManifest.slices[0], sliceVersion: 4, url: 'slices/gaming/low/v4.json' }],
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes('duplicate slice for gaming/low')));
});

test('WordSliceManifest rejects a malformed sha256', () => {
  const r = validateWordSliceManifest({
    ...goodManifest,
    slices: [{ ...goodManifest.slices[0], sha256: 'not-hex' }],
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes('sha256')));
});
