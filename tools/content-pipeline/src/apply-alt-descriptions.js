#!/usr/bin/env node
// apply-alt-descriptions.js — inject second clues into the unified passed batches.
//
// Usage: node src/apply-alt-descriptions.js
//
// Reads   data/raw/unified/<PREFIX>-alt.json   ([{word, altDescription}] per topic)
// Updates data/clean/unified/*-passed.json     (adds `altDescription` per entry, in place)
//
// The alt files are keyed by WORD (stable across id re-sequencing), scoped by the
// topic prefix in the filename so a word that exists in two topics gets each topic's
// own clue. Injection targets the PASSED batch files — the inputs merge reads — so
// `merge --scale=unified` naturally carries the field into the bank; editing merge
// output directly would be lost on the next re-merge.
//
// Run order matters: migrate-legacy.js rewrites the -migrated-passed files WITHOUT
// altDescription, so re-run this script after any re-migration, then re-merge.
//
// Idempotent and re-runnable. Exits non-zero if any passed entry ends up without an
// altDescription (partial coverage would ship a bank the tests reject anyway).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = path.join(ROOT, 'data', 'raw', 'unified');
const CLEAN_DIR = path.join(ROOT, 'data', 'clean', 'unified');

const PREFIX_TOPIC = {
  GAM: 'Gaming',
  SPC: 'Space & Sci-Fi',
  MUS: 'Music',
  NET: 'Internet & Tech Culture',
  FUD: 'Food & Drink',
  WLD: 'World & Places',
};

function main() {
  // topic -> word -> altDescription
  const alts = new Map();
  for (const file of fs.readdirSync(RAW_DIR).filter((f) => f.endsWith('-alt.json'))) {
    const prefix = file.slice(0, 3);
    const topic = PREFIX_TOPIC[prefix];
    if (!topic) {
      console.error(`${file}: unknown topic prefix ${prefix}`);
      process.exit(1);
    }
    const entries = JSON.parse(fs.readFileSync(path.join(RAW_DIR, file), 'utf8'));
    const byWord = alts.get(topic) ?? new Map();
    for (const e of entries) byWord.set(e.word, e.altDescription);
    alts.set(topic, byWord);
    console.log(`${file}: ${entries.length} alt clues for ${topic}`);
  }

  let applied = 0;
  const missing = [];
  for (const file of fs.readdirSync(CLEAN_DIR).filter((f) => f.endsWith('-passed.json'))) {
    const p = path.join(CLEAN_DIR, file);
    const batch = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const entry of batch) {
      const alt = alts.get(entry.topic)?.get(entry.word);
      if (alt) {
        entry.altDescription = alt;
        applied++;
      } else if (entry.altDescription === undefined) {
        missing.push(`${file}: ${entry.word} (${entry.topic})`);
      }
    }
    fs.writeFileSync(p, JSON.stringify(batch, null, 2) + '\n');
  }

  console.log(`\nApplied ${applied} alt descriptions across the passed batches.`);
  if (missing.length > 0) {
    console.error(`MISSING alt descriptions (${missing.length}):`);
    for (const m of missing.slice(0, 20)) console.error(`  ${m}`);
    process.exit(1);
  }
}

main();
