#!/usr/bin/env node
// migrate-legacy.js — re-scale the shipped legacy bank onto the unified scale (P4-T4).
//
// Usage: node src/migrate-legacy.js
//
// Reads   data/clean/sabd-wordbank.json          (the merged legacy bank, 800–2200)
// Writes  data/clean/unified/<PREFIX>-migrated-passed.json   (one per topic)
//
// The transform is imported from @sabd/elo (rescaleLegacyDifficulty — the P4-T3
// monotonic, tier-preserving map; F6 property-tested there). Nothing numeric is
// reimplemented here: the transform has exactly one home.
//
// Tier is re-derived from the re-scaled difficulty using the unified bands (legacy
// `low` deliberately splits across veryEasy/easy — the cold-start win). Words,
// descriptions, and hints are carried verbatim (P4-T6 regenerates only NEW entries).
//
// Output lands directly as `-passed` files: every entry already passed legacy
// validation, and the fields this script touches (difficulty, tier) are re-checked
// by `merge --scale=unified`'s band audit plus the wordbank package tests.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rescaleLegacyDifficulty } from '@sabd/elo';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TOPIC_PREFIX = {
  Gaming: 'GAM',
  'Space & Sci-Fi': 'SPC',
  Music: 'MUS',
  'Internet & Tech Culture': 'NET',
  'Food & Drink': 'FUD',
  'World & Places': 'WLD',
};

// Unified bands — mirror @sabd/elo CONFIG_3_0_0 / validate.js SCALES.unified.
function unifiedTier(d) {
  if (d <= 50) return 'veryEasy';
  if (d <= 150) return 'easy';
  if (d <= 350) return 'medium';
  return 'hard';
}

function main() {
  const bankPath = path.join(ROOT, 'data', 'clean', 'sabd-wordbank.json');
  const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
  const outDir = path.join(ROOT, 'data', 'clean', 'unified');
  fs.mkdirSync(outDir, { recursive: true });

  const byTopic = new Map();
  for (const w of bank) {
    const difficulty = rescaleLegacyDifficulty(w.difficulty);
    const migrated = { ...w, difficulty, tier: unifiedTier(difficulty) };
    if (!byTopic.has(w.topic)) byTopic.set(w.topic, []);
    byTopic.get(w.topic).push(migrated);
  }

  for (const [topic, entries] of [...byTopic.entries()].sort()) {
    const prefix = TOPIC_PREFIX[topic] ?? 'UNK';
    const outPath = path.join(outDir, `${prefix}-migrated-passed.json`);
    fs.writeFileSync(outPath, JSON.stringify(entries, null, 2) + '\n');
    const tiers = { veryEasy: 0, easy: 0, medium: 0, hard: 0 };
    for (const e of entries) tiers[e.tier]++;
    console.log(
      `${topic}: ${entries.length} migrated → ${path.basename(outPath)} ` +
        `(veryEasy ${tiers.veryEasy} / easy ${tiers.easy} / medium ${tiers.medium} / hard ${tiers.hard})`,
    );
  }
}

main();
