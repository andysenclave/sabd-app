/**
 * T10 client slice sync: verify-before-swap, keep-old-on-failure, per-cell failure
 * containment, unchanged skip — plus liveBank merge semantics (override replaces the
 * cell, bundled fallback elsewhere, removed words stay removed).
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import type { WordEntry, WordSlice, WordSliceManifest } from '@sabd/contracts';
import { BANK_TOPICS, WORD_SLICE_SCHEMA_VERSION } from '@sabd/contracts';
import { words as bundledWords } from '@sabd/wordbank';
import { cellFileName, loadInstalledSlices, syncSlices, type SliceIO } from '../src/bank/sliceSync.ts';
import {
  applySlices,
  bankWords,
  bankTopics,
  installedVersions,
  resetLiveBank,
} from '../src/bank/liveBank.ts';

const silent = (): void => {};
const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

/** In-memory SliceIO: a fake CDN (urls) + a fake disk (files). */
function fakeIO(cdn: Map<string, string>, disk: Map<string, string> = new Map()) {
  const io: SliceIO = {
    fetchText: (url) => {
      const hit = cdn.get(url);
      return hit === undefined ? Promise.reject(new Error(`404 ${url}`)) : Promise.resolve(hit);
    },
    readText: (name) => Promise.resolve(disk.get(name) ?? null),
    writeText: (name, content) => {
      disk.set(name, content);
      return Promise.resolve();
    },
    move: (from, to) => {
      const v = disk.get(from);
      if (v === undefined) return Promise.reject(new Error(`missing ${from}`));
      disk.delete(from);
      disk.set(to, v);
      return Promise.resolve();
    },
    remove: (name) => {
      disk.delete(name);
      return Promise.resolve();
    },
    sha256: (text) => Promise.resolve(sha(text)),
  };
  return { io, disk };
}

let seq = 0;
function word(topic: string, tier: 'low' | 'mid' | 'high', id?: string): WordEntry {
  const w = `W${String(++seq).padStart(3, '0')}`;
  return {
    id: id ?? `T-${String(++seq).padStart(4, '0')}`,
    word: w,
    topic,
    length: w.length,
    difficulty: tier === 'low' ? 900 : tier === 'mid' ? 1400 : 1800,
    tier,
    description: 'A test word, nothing more',
    hints: { position: { index: 0, letter: 'W' }, letters: { correct: 'W', decoy: 'X' } },
  };
}

function slice(topicId: 'gaming' | 'music', tier: 'low' | 'mid' | 'high', sliceVersion: number, words: WordEntry[]): WordSlice {
  return {
    schemaVersion: WORD_SLICE_SCHEMA_VERSION,
    wordBankVersion: '1.1.0',
    topicId,
    topic: BANK_TOPICS[topicId],
    tier,
    sliceVersion,
    words,
  };
}

const MANIFEST_URL = 'https://cdn.example/bank/manifest.json';

function publish(cdn: Map<string, string>, slices: WordSlice[]): WordSliceManifest {
  const manifest: WordSliceManifest = {
    schemaVersion: WORD_SLICE_SCHEMA_VERSION,
    wordBankVersion: '1.1.0',
    generatedAt: '2026-07-15T00:00:00.000Z',
    slices: slices.map((s) => {
      const text = JSON.stringify(s);
      const url = `slices/${s.topicId}/${s.tier}/v${s.sliceVersion}.json`;
      cdn.set(`https://cdn.example/bank/${url}`, text);
      return {
        topicId: s.topicId,
        topic: s.topic,
        tier: s.tier,
        sliceVersion: s.sliceVersion,
        url,
        wordCount: s.words.length,
        bytes: Buffer.byteLength(text, 'utf8'),
        sha256: sha(text),
      };
    }),
  };
  cdn.set(MANIFEST_URL, JSON.stringify(manifest));
  return manifest;
}

beforeEach(() => resetLiveBank());

test('happy path: downloads, verifies, swaps; reload sees the slice', async () => {
  const cdn = new Map<string, string>();
  publish(cdn, [slice('gaming', 'low', 1, [word(BANK_TOPICS.gaming, 'low', 'GAM-NEW')])]);
  const { io, disk } = fakeIO(cdn);

  const result = await syncSlices(io, MANIFEST_URL, new Map(), silent);
  assert.deepEqual(result.updated, ['gaming/low']);
  assert.equal(result.manifestVersion, '1.1.0');
  assert.ok(disk.has(cellFileName('gaming', 'low')));
  assert.ok(!disk.has(`${cellFileName('gaming', 'low')}.tmp`));

  const installed = await loadInstalledSlices(io, [{ topicId: 'gaming', tier: 'low' }]);
  assert.equal(installed.length, 1);
  assert.equal(installed[0]!.words[0]!.id, 'GAM-NEW');
});

test('sha mismatch: slice rejected, old file kept, other slices still land', async () => {
  const cdn = new Map<string, string>();
  const good = slice('music', 'low', 1, [word(BANK_TOPICS.music, 'low')]);
  const bad = slice('gaming', 'low', 2, [word(BANK_TOPICS.gaming, 'low')]);
  const manifest = publish(cdn, [bad, good]);
  // Corrupt the gaming payload AFTER hashing (CDN corruption / truncation).
  const badUrl = `https://cdn.example/bank/${manifest.slices[0]!.url}`;
  cdn.set(badUrl, cdn.get(badUrl)!.slice(0, -2) + '}]');

  const oldFile = JSON.stringify(slice('gaming', 'low', 1, [word(BANK_TOPICS.gaming, 'low', 'GAM-OLD')]));
  const { io, disk } = fakeIO(cdn, new Map([[cellFileName('gaming', 'low'), oldFile]]));

  const result = await syncSlices(io, MANIFEST_URL, new Map([['gaming/low', 1]]), silent);
  assert.deepEqual(result.failed, ['gaming/low']);
  assert.deepEqual(result.updated, ['music/low']);
  assert.equal(disk.get(cellFileName('gaming', 'low')), oldFile); // old version intact
});

test('manifest fetch failure (offline): nothing changes, no throw', async () => {
  const { io, disk } = fakeIO(new Map(), new Map([['gaming-low.json', '{"x":1}']]));
  const result = await syncSlices(io, MANIFEST_URL, new Map(), silent);
  assert.equal(result.manifestVersion, null);
  assert.deepEqual(result.updated, []);
  assert.equal(disk.get('gaming-low.json'), '{"x":1}');
});

test('already-installed version is skipped (no download, no write)', async () => {
  const cdn = new Map<string, string>();
  publish(cdn, [slice('gaming', 'low', 3, [word(BANK_TOPICS.gaming, 'low')])]);
  const { io, disk } = fakeIO(cdn);

  const result = await syncSlices(io, MANIFEST_URL, new Map([['gaming/low', 3]]), silent);
  assert.deepEqual(result.unchanged, ['gaming/low']);
  assert.equal(disk.size, 0);
});

test('a slice whose envelope disagrees with its ref is rejected', async () => {
  const cdn = new Map<string, string>();
  const manifest = publish(cdn, [slice('gaming', 'low', 2, [word(BANK_TOPICS.gaming, 'low')])]);
  // Serve a DIFFERENT (valid, correctly-hashed) slice at that url — wrong version.
  const impostor = JSON.stringify(slice('gaming', 'low', 9, [word(BANK_TOPICS.gaming, 'low')]));
  const url = `https://cdn.example/bank/${manifest.slices[0]!.url}`;
  cdn.set(url, impostor);
  cdn.set(MANIFEST_URL, JSON.stringify({
    ...manifest,
    slices: [{ ...manifest.slices[0]!, sha256: sha(impostor), bytes: Buffer.byteLength(impostor, 'utf8') }],
  }));

  const { io } = fakeIO(cdn);
  const result = await syncSlices(io, MANIFEST_URL, new Map(), silent);
  assert.deepEqual(result.failed, ['gaming/low']);
});

test('corrupt installed file is dropped on load (bundled bank covers)', async () => {
  const { io } = fakeIO(new Map(), new Map([[cellFileName('gaming', 'low'), '{not json']]));
  const installed = await loadInstalledSlices(io, [{ topicId: 'gaming', tier: 'low' }]);
  assert.deepEqual(installed, []);
});

// ─── liveBank merge semantics ────────────────────────────────────────────────

test('no overrides → exactly the bundled bank', () => {
  assert.equal(bankWords().length, bundledWords.length);
});

test('an applied slice REPLACES its (topic × tier) cell; other cells untouched', () => {
  const bundledGamingLow = bundledWords.filter((w) => w.topic === BANK_TOPICS.gaming && w.tier === 'low');
  const bundledRest = bundledWords.length - bundledGamingLow.length;

  const replacement = [word(BANK_TOPICS.gaming, 'low', 'GAM-X1'), word(BANK_TOPICS.gaming, 'low', 'GAM-X2')];
  applySlices([slice('gaming', 'low', 2, replacement)]);

  const live = bankWords();
  assert.equal(live.length, bundledRest + 2);
  const liveGamingLow = live.filter((w) => w.topic === BANK_TOPICS.gaming && w.tier === 'low');
  assert.deepEqual(liveGamingLow.map((w) => w.id).sort(), ['GAM-X1', 'GAM-X2']);
  // A bundled gaming/low word removed by the correction stays removed (no union).
  assert.ok(!live.some((w) => w.id === bundledGamingLow[0]!.id));
});

test('an empty downloaded slice empties its cell (removal is honored)', () => {
  applySlices([slice('music', 'high', 2, [])]);
  const live = bankWords();
  assert.ok(!live.some((w) => w.topic === BANK_TOPICS.music && w.tier === 'high'));
  assert.ok(bankTopics().has(BANK_TOPICS.music)); // other music tiers still stocked
});

test('installedVersions reflects applied slices (drives the next sync diff)', () => {
  applySlices([slice('gaming', 'low', 4, [word(BANK_TOPICS.gaming, 'low')])]);
  assert.equal(installedVersions().get('gaming/low'), 4);
});
