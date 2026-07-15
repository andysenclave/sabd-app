#!/usr/bin/env node
/**
 * publish.ts — cut the merged word bank into CDN-ready static slices (T8).
 *
 * Usage:  node src/publish.ts [--out=dist] [--bank=<path>] [--version=<semver>]
 *
 * Reads   packages/wordbank/data/sabd-wordbank.json   (the published merged bank)
 *         packages/wordbank/data/wordbank.meta.json   (wordBankVersion fallback)
 *         <out>/manifest.json                         (previous publish, if any)
 * Writes  <out>/slices/<topicId>/<tier>/v<N>.json     (only slices whose words changed)
 *         <out>/manifest.json                         (written LAST — the "commit")
 *
 * Published slice files are IMMUTABLE: an unchanged slice keeps its old file and ref;
 * a changed one gets a new version file alongside the old (VERSIONING.md §3/§4).
 * The out dir is uploaded as-is to the static bucket (T9).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WordEntry, WordSliceManifest } from '@sabd/contracts';
import {
  validateWordEntry,
  validateWordSliceManifest,
  validateWordSlice,
} from '@sabd/contracts';
import { cutSlices, sliceContentKey } from './slice.ts';

const SERVICE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(SERVICE_ROOT, '..', '..');
const WB_DATA = path.join(REPO_ROOT, 'packages', 'wordbank', 'data');

function arg(name: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : undefined;
}

function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
  } catch {
    return null;
  }
}

function main(): void {
  const outDir = path.resolve(SERVICE_ROOT, arg('out') ?? 'dist');
  const bankPath = arg('bank') ?? path.join(WB_DATA, 'sabd-wordbank.json');

  const bank = readJson<WordEntry[]>(bankPath);
  if (!Array.isArray(bank) || bank.length === 0) {
    console.error(`No bank at ${bankPath} — run the content pipeline's publish first.`);
    process.exit(1);
  }

  // Refuse to publish an invalid bank — a bad entry on the CDN reaches every device.
  const badEntries = bank
    .map((w, i) => ({ i, r: validateWordEntry(w, `bank[${i}]`) }))
    .filter(({ r }) => !r.ok);
  if (badEntries.length > 0) {
    for (const { r } of badEntries.slice(0, 10)) {
      if (!r.ok) for (const e of r.errors) console.error(`  ${e}`);
    }
    console.error(`Bank failed validation: ${badEntries.length} bad entries. Not publishing.`);
    process.exit(1);
  }

  const meta = readJson<{ wordBankVersion?: string }>(path.join(WB_DATA, 'wordbank.meta.json'));
  const version = arg('version') ?? meta?.wordBankVersion;
  if (!version) {
    console.error('No --version and no wordbank.meta.json version. Not publishing.');
    process.exit(1);
  }

  // Previous publish state: the manifest + each previous slice's content key.
  const prev = readJson<WordSliceManifest>(path.join(outDir, 'manifest.json'));
  if (prev && !validateWordSliceManifest(prev).ok) {
    console.error(`Existing ${outDir}/manifest.json is invalid — refusing to version against it.`);
    process.exit(1);
  }
  const prevContentKeys = new Map<string, string>();
  for (const ref of prev?.slices ?? []) {
    const file = readJson<{ words: WordEntry[] }>(path.join(outDir, ref.url));
    if (file?.words) prevContentKeys.set(`${ref.topicId}/${ref.tier}`, sliceContentKey(file.words));
  }

  const { manifest, slices, unknownTopicWords } = cutSlices(
    bank,
    version,
    new Date().toISOString(),
    prev,
    prevContentKeys,
  );

  if (unknownTopicWords.length > 0) {
    const topics = [...new Set(unknownTopicWords.map((w) => w.topic))];
    console.warn(
      `WARNING: ${unknownTopicWords.length} words have non-canonical topics (${topics.join(', ')}) ` +
        `and were NOT sliced. They remain in the bundled bank only.`,
    );
  }

  // Self-check every output against the contract before touching disk.
  const manifestCheck = validateWordSliceManifest(manifest);
  if (!manifestCheck.ok) {
    for (const e of manifestCheck.errors) console.error(`  ${e}`);
    console.error('Cut produced an invalid manifest — bug in the publisher. Not publishing.');
    process.exit(1);
  }
  for (const s of slices) {
    if (s.fileJson === null) continue;
    const check = validateWordSlice(JSON.parse(s.fileJson));
    if (!check.ok) {
      for (const e of check.errors) console.error(`  ${e}`);
      console.error(`Cut produced an invalid slice ${s.ref.url} — bug in the publisher.`);
      process.exit(1);
    }
  }

  // Write slice files first, manifest LAST — a crash mid-publish leaves the old
  // manifest pointing exclusively at old (still-present, immutable) files.
  let written = 0;
  for (const s of slices) {
    if (s.fileJson === null) continue;
    const target = path.join(outDir, s.ref.url);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, s.fileJson);
    written++;
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log(
    `Published bank v${version} → ${outDir}: ${slices.length} slices ` +
      `(${written} new/changed, ${slices.length - written} unchanged).`,
  );
  for (const s of slices) {
    const mark = s.fileJson === null ? ' (unchanged)' : ' *';
    console.log(`  ${s.ref.url}  ${s.ref.wordCount} words${mark}`);
  }
}

main();
