/**
 * Slice cutting — the pure core of the publisher (T8). No I/O; publish.ts owns disk.
 *
 * Rules (packages/contracts/VERSIONING.md):
 *  - One slice per (topicId × tier) — 6 × 3 = 18 per full bank.
 *  - `sliceVersion` is per-slice monotonic and bumps ONLY when that slice's words
 *    change, so an unchanged slice is never re-downloaded (and its already-published
 *    file is never rewritten — published files are immutable).
 *  - An unchanged slice keeps its previous ref VERBATIM (same url, same sha256, same
 *    embedded wordBankVersion — the version its content was last cut at).
 *  - Slice urls are content-addressed relative paths: slices/<topicId>/<tier>/v<N>.json
 */

import { createHash } from 'node:crypto';
import type {
  TopicId,
  WordEntry,
  WordSlice,
  WordSliceManifest,
  WordSliceRef,
  WordTier,
} from '@sabd/contracts';
import {
  BANK_TOPICS,
  TOPIC_IDS,
  WORD_SLICE_SCHEMA_VERSION,
  WORD_TIERS,
  topicIdForBankTopic,
} from '@sabd/contracts';

/** Serialized slice file content + its manifest ref. */
export interface CutSlice {
  ref: WordSliceRef;
  /** Exact file bytes to publish (null when the slice is unchanged — keep the old file). */
  fileJson: string | null;
}

export interface CutResult {
  manifest: WordSliceManifest;
  slices: CutSlice[];
  /** Bank entries whose topic is not one of the six canonical topics (publisher warns). */
  unknownTopicWords: WordEntry[];
}

/**
 * Content identity of a slice: the word list only (stable order by id), NOT the
 * metadata envelope — wordBankVersion changes every publish and must not force a
 * re-download of unchanged words.
 */
export function sliceContentKey(words: readonly WordEntry[]): string {
  const canonical = JSON.stringify([...words].sort((a, b) => (a.id < b.id ? -1 : 1)));
  return createHash('sha256').update(canonical).digest('hex');
}

export function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** Deterministic serialization of a slice file (stable word order by id). */
export function serializeSlice(slice: WordSlice): string {
  return JSON.stringify(
    { ...slice, words: [...slice.words].sort((a, b) => (a.id < b.id ? -1 : 1)) },
    null,
    2,
  ) + '\n';
}

export function sliceUrl(topicId: TopicId, tier: WordTier, sliceVersion: number): string {
  return `slices/${topicId}/${tier}/v${sliceVersion}.json`;
}

/**
 * Cut a full bank into per-(topic × tier) slices, versioned against the previous
 * manifest. `prevContentKeys` maps `topicId/tier` → the previous slice's content key
 * (publish.ts derives it from the previously published slice files).
 */
export function cutSlices(
  bank: readonly WordEntry[],
  wordBankVersion: string,
  generatedAt: string,
  prev: WordSliceManifest | null,
  prevContentKeys: ReadonlyMap<string, string>,
): CutResult {
  const prevRefs = new Map<string, WordSliceRef>(
    (prev?.slices ?? []).map((r) => [`${r.topicId}/${r.tier}`, r]),
  );

  const unknownTopicWords = bank.filter((w) => topicIdForBankTopic(w.topic) === undefined);

  const slices: CutSlice[] = [];
  for (const topicId of TOPIC_IDS) {
    const topic = BANK_TOPICS[topicId];
    for (const tier of WORD_TIERS) {
      const words = bank.filter((w) => w.topic === topic && w.tier === tier);
      const key = `${topicId}/${tier}`;
      const prevRef = prevRefs.get(key);
      const contentKey = sliceContentKey(words);

      if (prevRef && prevContentKeys.get(key) === contentKey) {
        // Unchanged — reuse the published ref verbatim; the old file stays immutable.
        slices.push({ ref: prevRef, fileJson: null });
        continue;
      }

      const sliceVersion = (prevRef?.sliceVersion ?? 0) + 1;
      const file: WordSlice = {
        schemaVersion: WORD_SLICE_SCHEMA_VERSION,
        wordBankVersion,
        topicId,
        topic,
        tier,
        sliceVersion,
        words: [...words],
      };
      const fileJson = serializeSlice(file);
      slices.push({
        ref: {
          topicId,
          topic,
          tier,
          sliceVersion,
          url: sliceUrl(topicId, tier, sliceVersion),
          wordCount: words.length,
          bytes: Buffer.byteLength(fileJson, 'utf8'),
          sha256: sha256Hex(fileJson),
        },
        fileJson,
      });
    }
  }

  return {
    manifest: {
      schemaVersion: WORD_SLICE_SCHEMA_VERSION,
      wordBankVersion,
      generatedAt,
      slices: slices.map((s) => s.ref),
    },
    slices,
    unknownTopicWords,
  };
}
