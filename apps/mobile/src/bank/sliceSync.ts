/**
 * Client slice sync (T10) — poll the manifest, download changed slices, verify,
 * atomic swap, keep the old version on any failure. Pure logic with injected IO so
 * the whole protocol is node-testable; expoSliceIO.ts is the device implementation.
 *
 * Rules (VERSIONING.md §5): verify sha256 + schema before accepting; a half-written
 * slice must never become readable (temp-write + move); offline or any failure →
 * the cached (or bundled) bank keeps playing. Never a hard dependency for play.
 *
 * In-lane decision: we download ALL manifest slices, not just the player's current
 * band — the whole bank is ~300 KB, and holding every tier both kills the
 * "out-climbed your downloaded band offline" failure mode for stocked topics and
 * keeps this logic trivial. (The Elo-era band restriction was a cost optimization
 * a bank this small doesn't need. Revisit if the bank grows 100×.)
 */

import type { TopicId, WordSlice, WordSliceManifest, WordTier } from '@sabd/contracts';
import { validateWordSlice, validateWordSliceManifest } from '@sabd/contracts';

/** Injected IO — throws on failure; the sync loop converts throws into "keep old". */
export interface SliceIO {
  /** GET a url, resolve to body text; reject on network/HTTP error. */
  fetchText(url: string): Promise<string>;
  /** Read a file under the bank dir; null when missing. */
  readText(name: string): Promise<string | null>;
  /** Write a file under the bank dir (temp location allowed via name). */
  writeText(name: string, content: string): Promise<void>;
  /** Atomic rename within the bank dir (same volume). */
  move(from: string, to: string): Promise<void>;
  /** Best-effort delete (missing file is fine). */
  remove(name: string): Promise<void>;
  /** SHA-256 hex of a string. */
  sha256(text: string): Promise<string>;
}

/** One stable file per cell — swap replaces it atomically. */
export function cellFileName(topicId: TopicId, tier: WordTier): string {
  return `${topicId}-${tier}.json`;
}

/**
 * Load every installed slice from disk. Self-describing files are the only state —
 * no separate index to drift. Invalid/corrupt files are dropped (bundled bank covers).
 */
export async function loadInstalledSlices(io: SliceIO, cells: ReadonlyArray<{ topicId: TopicId; tier: WordTier }>): Promise<WordSlice[]> {
  const out: WordSlice[] = [];
  for (const { topicId, tier } of cells) {
    const text = await io.readText(cellFileName(topicId, tier));
    if (text === null) continue;
    try {
      const parsed: unknown = JSON.parse(text);
      const checked = validateWordSlice(parsed);
      if (checked.ok && checked.value.topicId === topicId && checked.value.tier === tier) {
        out.push(checked.value);
      }
    } catch {
      // Corrupt file — ignore; next sync will replace it.
    }
  }
  return out;
}

export interface SyncResult {
  /** Cells updated to a new sliceVersion this run. */
  updated: string[];
  /** Cells whose download/verify failed — old version kept. */
  failed: string[];
  /** Cells already at the manifest version. */
  unchanged: string[];
  manifestVersion: string | null;
}

/** Resolve a slice's relative url against the manifest url. */
export function resolveSliceUrl(manifestUrl: string, relative: string): string {
  return new URL(relative, manifestUrl).toString();
}

/**
 * One sync pass. Every failure is contained per-cell: a slice that fails to
 * download/verify leaves its old file untouched and the rest of the batch continues.
 */
export async function syncSlices(
  io: SliceIO,
  manifestUrl: string,
  installed: ReadonlyMap<string, number>, // cellKey → installed sliceVersion
  warn: (msg: string) => void = console.warn,
): Promise<SyncResult> {
  let manifest: WordSliceManifest;
  try {
    const text = await io.fetchText(manifestUrl);
    const checked = validateWordSliceManifest(JSON.parse(text));
    if (!checked.ok) {
      warn(`bank sync: manifest invalid (${checked.errors[0] ?? 'unknown'}) — keeping cache`);
      return { updated: [], failed: [], unchanged: [], manifestVersion: null };
    }
    manifest = checked.value;
  } catch (err) {
    // Offline or server hiccup — entirely normal; cached/bundled bank plays on.
    warn(`bank sync: manifest fetch failed (${String(err)}) — keeping cache`);
    return { updated: [], failed: [], unchanged: [], manifestVersion: null };
  }

  const result: SyncResult = { updated: [], failed: [], unchanged: [], manifestVersion: manifest.wordBankVersion };

  for (const ref of manifest.slices) {
    const cellKey = `${ref.topicId}/${ref.tier}`;
    if (installed.get(cellKey) === ref.sliceVersion) {
      result.unchanged.push(cellKey);
      continue;
    }

    const finalName = cellFileName(ref.topicId, ref.tier);
    const tmpName = `${finalName}.tmp`;
    try {
      const text = await io.fetchText(resolveSliceUrl(manifestUrl, ref.url));

      // Verify BEFORE the swap: integrity, schema, and ref coherence.
      const hash = await io.sha256(text);
      if (hash !== ref.sha256) throw new Error(`sha256 mismatch for ${ref.url}`);
      const checked = validateWordSlice(JSON.parse(text));
      if (!checked.ok) throw new Error(`slice invalid: ${checked.errors[0] ?? 'unknown'}`);
      const slice = checked.value;
      if (slice.topicId !== ref.topicId || slice.tier !== ref.tier || slice.sliceVersion !== ref.sliceVersion) {
        throw new Error(`slice envelope does not match its manifest ref (${ref.url})`);
      }

      // Atomic swap: temp write, then rename over the old file.
      await io.writeText(tmpName, text);
      await io.move(tmpName, finalName);
      result.updated.push(cellKey);
    } catch (err) {
      await io.remove(tmpName).catch(() => {});
      warn(`bank sync: ${cellKey} failed (${String(err)}) — keeping previous version`);
      result.failed.push(cellKey);
    }
  }

  return result;
}
