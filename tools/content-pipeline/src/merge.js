#!/usr/bin/env node
// merge.js — combine all validated (passed) batches into the final word bank.
//
// Usage: node src/merge.js [--scale=legacy|unified]
//
// Reads   data/clean/*-passed.json           (unified: data/clean/unified/*-passed.json)
// Writes  data/clean/<topic-slug>.json       (one per topic, ids re-sequenced)
//         data/clean/sabd-wordbank.json      (all topics)
//         data/clean/stats.json              (per-topic counts + histograms)
//         (unified: same three, under data/clean/unified/)
//
// Phase 4 (`--scale=unified`): four-tier histograms, 50-point difficulty buckets,
// a hard band-coherence check (difficulty must sit inside its tier's band), and the
// P4-T5 STOCK AUDIT — per-tier counts printed per topic; exits non-zero if any tier
// holds under 15% of its topic (a starved tier spills selection silently).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SCALES = {
  legacy: {
    tiers: ['low', 'mid', 'high'],
    bands: { low: [800, 1200], mid: [1201, 1600], high: [1601, 2200] },
    cleanSubdir: '',
    bucketSize: 200,
    minTierShare: 0, // no audit — the legacy bank is frozen history
  },
  unified: {
    tiers: ['veryEasy', 'easy', 'medium', 'hard'],
    bands: { veryEasy: [0, 50], easy: [51, 150], medium: [151, 350], hard: [351, 500] },
    cleanSubdir: 'unified',
    bucketSize: 50,
    minTierShare: 0.15, // P4-T5: no tier below ~15% of its topic
  },
};

const scaleArg = process.argv.slice(2).find((a) => a.startsWith('--scale='))?.slice('--scale='.length) ?? 'legacy';
const SCALE = SCALES[scaleArg];
if (!SCALE) {
  console.error(`Unknown --scale=${scaleArg} (expected ${Object.keys(SCALES).join('|')})`);
  process.exit(2);
}
const CLEAN_DIR = path.join(ROOT, 'data', 'clean', SCALE.cleanSubdir);

const TOPICS = {
  Gaming: 'GAM',
  'Space & Sci-Fi': 'SPC',
  Music: 'MUS',
  'Internet & Tech Culture': 'NET',
  'Food & Drink': 'FUD',
  'World & Places': 'WLD',
};

const slug = (topic) =>
  topic
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function main() {
  const files = fs
    .readdirSync(CLEAN_DIR)
    .filter((f) => f.endsWith('-passed.json'))
    .sort();

  if (files.length === 0) {
    console.error('No *-passed.json files found in data/clean — run the validator first.');
    process.exit(1);
  }

  // gather by topic, dedupe by word (first occurrence wins)
  const byTopic = new Map();
  const seenWords = new Map(); // word -> source file
  let dropped = 0;

  for (const file of files) {
    const entries = JSON.parse(fs.readFileSync(path.join(CLEAN_DIR, file), 'utf8'));
    for (const entry of entries) {
      const key = `${entry.topic}::${entry.word.toLowerCase()}`;
      if (seenWords.has(key)) {
        console.warn(`  duplicate across batches: ${entry.word} (${file}, first in ${seenWords.get(key)}) — dropped`);
        dropped++;
        continue;
      }
      seenWords.set(key, file);
      if (!byTopic.has(entry.topic)) byTopic.set(entry.topic, []);
      byTopic.get(entry.topic).push(entry);
    }
  }

  const bank = [];
  const stats = {
    generatedAt: new Date().toISOString(),
    scale: scaleArg,
    totals: { entries: 0, dropped },
    topics: {},
  };
  const bandViolations = [];
  const auditFailures = [];

  for (const [topic, entries] of [...byTopic.entries()].sort()) {
    const prefix = TOPICS[topic] ?? 'UNK';
    // stable ordering: difficulty ascending, then word
    entries.sort((a, b) => a.difficulty - b.difficulty || a.word.localeCompare(b.word));
    // re-sequence ids
    entries.forEach((e, i) => {
      e.id = `${prefix}-${String(i + 1).padStart(4, '0')}`;
    });

    const topicFile = path.join(CLEAN_DIR, `${slug(topic)}.json`);
    fs.writeFileSync(topicFile, JSON.stringify(entries, null, 2) + '\n');
    bank.push(...entries);

    const tierHist = Object.fromEntries(SCALE.tiers.map((t) => [t, 0]));
    const lengthHist = {};
    const difficultyHist = {}; // bucketSize-point buckets
    const B = SCALE.bucketSize;
    for (const e of entries) {
      tierHist[e.tier] = (tierHist[e.tier] ?? 0) + 1;
      lengthHist[e.length] = (lengthHist[e.length] ?? 0) + 1;
      const bucket = `${Math.floor(e.difficulty / B) * B}-${Math.floor(e.difficulty / B) * B + B - 1}`;
      difficultyHist[bucket] = (difficultyHist[bucket] ?? 0) + 1;
      // Band coherence — a merged entry whose difficulty escaped its tier's band
      // would corrupt slice cutting and future pay. Hard error, never a warning.
      const band = SCALE.bands[e.tier];
      if (!band || e.difficulty < band[0] || e.difficulty > band[1]) {
        bandViolations.push(`${e.id} ${e.word}: difficulty ${e.difficulty} outside ${e.tier} band`);
      }
    }
    stats.topics[topic] = {
      count: entries.length,
      file: path.basename(topicFile),
      tiers: tierHist,
      lengths: lengthHist,
      difficulty: difficultyHist,
    };

    // ---- P4-T5 stock audit (printed for every merge; enforced when minTierShare > 0)
    const shares = SCALE.tiers.map((t) => {
      const share = entries.length ? tierHist[t] / entries.length : 0;
      const flag = share < SCALE.minTierShare ? '  ** UNDER-STOCKED **' : '';
      if (flag) auditFailures.push(`${topic}/${t}: ${tierHist[t]} words (${(share * 100).toFixed(1)}% < 15%)`);
      return `${t} ${tierHist[t]} (${(share * 100).toFixed(0)}%)${flag}`;
    });
    console.log(`${topic}: ${entries.length} entries → ${path.basename(topicFile)}`);
    console.log(`  tiers: ${shares.join(' · ')}`);
  }

  stats.totals.entries = bank.length;

  const bankPath = path.join(CLEAN_DIR, 'sabd-wordbank.json');
  const statsPath = path.join(CLEAN_DIR, 'stats.json');
  fs.writeFileSync(bankPath, JSON.stringify(bank, null, 2) + '\n');
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2) + '\n');

  console.log(`\nWord bank: ${bank.length} entries → ${path.relative(process.cwd(), bankPath)}`);
  console.log(`Stats:     ${path.relative(process.cwd(), statsPath)}`);

  if (bandViolations.length > 0) {
    console.error(`\nBAND VIOLATIONS (${bandViolations.length}) — merge output is NOT publishable:`);
    for (const v of bandViolations.slice(0, 20)) console.error(`  ${v}`);
    process.exit(1);
  }
  if (auditFailures.length > 0) {
    console.error(`\nP4-T5 STOCK AUDIT FAILED (${auditFailures.length} starved tiers):`);
    for (const f of auditFailures) console.error(`  ${f}`);
    process.exit(1);
  }
}

main();
