#!/usr/bin/env node
// merge.js — combine all validated (passed) batches into the final word bank.
//
// Usage: node src/merge.js
//
// Reads   data/clean/*-passed.json
// Writes  data/clean/<topic-slug>.json   (one per topic, ids re-sequenced)
//         data/clean/sabd-wordbank.json  (all topics)
//         data/clean/stats.json          (per-topic counts + histograms)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLEAN_DIR = path.join(ROOT, 'data', 'clean');

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
  const stats = { generatedAt: new Date().toISOString(), totals: { entries: 0, dropped }, topics: {} };

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

    const tierHist = { low: 0, mid: 0, high: 0 };
    const lengthHist = {};
    const difficultyHist = {}; // 200-point buckets
    for (const e of entries) {
      tierHist[e.tier] = (tierHist[e.tier] ?? 0) + 1;
      lengthHist[e.length] = (lengthHist[e.length] ?? 0) + 1;
      const bucket = `${Math.floor(e.difficulty / 200) * 200}-${Math.floor(e.difficulty / 200) * 200 + 199}`;
      difficultyHist[bucket] = (difficultyHist[bucket] ?? 0) + 1;
    }
    stats.topics[topic] = {
      count: entries.length,
      file: path.basename(topicFile),
      tiers: tierHist,
      lengths: lengthHist,
      difficulty: difficultyHist,
    };
    console.log(`${topic}: ${entries.length} entries → ${path.basename(topicFile)}`);
  }

  stats.totals.entries = bank.length;

  const bankPath = path.join(CLEAN_DIR, 'sabd-wordbank.json');
  const statsPath = path.join(CLEAN_DIR, 'stats.json');
  fs.writeFileSync(bankPath, JSON.stringify(bank, null, 2) + '\n');
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2) + '\n');

  console.log(`\nWord bank: ${bank.length} entries → ${path.relative(process.cwd(), bankPath)}`);
  console.log(`Stats:     ${path.relative(process.cwd(), statsPath)}`);
}

main();
