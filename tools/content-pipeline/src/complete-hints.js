#!/usr/bin/env node
// complete-hints.js — fill the MECHANICAL fields of an authoring batch (P4-T6).
//
// Usage: node src/complete-hints.js data/raw/unified/GAM-u1.json
//
// Generation authors only what needs judgment: word, topic, tier, difficulty,
// description. Everything derivable is derived here, deterministically (seeded by
// the word itself, so re-runs are byte-identical — no Math.random):
//   id                 <PREFIX>-9NNN provisional (merge re-sequences)
//   length             word.length
//   hints.position     {index, letter} — a real index into the word
//   hints.letters      {correct: letter in word, decoy: plausible letter NOT in word}
//
// Idempotent: entries that already carry a field keep it verbatim (safe re-run after
// a review edit). The validator remains the authority — this script never validates.

import fs from 'node:fs';
import path from 'node:path';

const TOPIC_PREFIX = {
  Gaming: 'GAM',
  'Space & Sci-Fi': 'SPC',
  Music: 'MUS',
  'Internet & Tech Culture': 'NET',
  'Food & Drink': 'FUD',
  'World & Places': 'WLD',
};

// English letter frequency, most→least common: decoys drawn from the top feel
// plausible; the walk skips letters actually in the word.
const FREQ = 'ETAOINSRHLDCUMFPGWYBVKXJQZ';

/** Tiny deterministic hash (FNV-1a) — the word is the seed. */
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Authored hints count only when FULLY well-formed; anything partial is regenerated. */
function hintsAreComplete(entry) {
  const word = entry.word ?? '';
  const pos = entry.hints?.position;
  const lt = entry.hints?.letters;
  return (
    Number.isInteger(pos?.index) &&
    pos.index >= 0 &&
    pos.index < word.length &&
    pos.letter === word[pos.index] &&
    /^[A-Z]$/.test(lt?.correct ?? '') &&
    word.includes(lt.correct) &&
    /^[A-Z]$/.test(lt?.decoy ?? '') &&
    !word.includes(lt.decoy)
  );
}

function completeEntry(entry, seq) {
  const word = entry.word;
  const h = hash(word);
  const prefix = TOPIC_PREFIX[entry.topic] ?? 'UNK';

  // Provisional id in a 9xxx block so it can never collide with merged ids (merge
  // re-sequences from 0001 anyway).
  const id = entry.id ?? `${prefix}-${String(9000 + seq).padStart(4, '0')}`;

  // Position hint: skip index 0 when the word is long enough — revealing the first
  // letter is disproportionately strong.
  const posIndex = word.length <= 3 ? h % word.length : 1 + (h % (word.length - 1));

  // Correct-letter hint: a DIFFERENT position than the position hint when possible,
  // so the two paid hints never reveal the same letter slot's identity for free.
  // (>>> not >>: a signed shift re-signs hashes ≥ 2^31 → negative index → undefined.)
  let correctIndex = (h >>> 8) % word.length;
  if (word.length > 1 && correctIndex === posIndex) correctIndex = (correctIndex + 1) % word.length;

  // Decoy: the most common English letter NOT in the word, starting from a
  // word-seeded offset so decoys vary across the bank.
  const inWord = new Set(word);
  let decoy = 'Z';
  for (let i = 0; i < FREQ.length; i++) {
    const cand = FREQ[(((h >>> 16) % 8) + i) % FREQ.length];
    if (!inWord.has(cand)) {
      decoy = cand;
      break;
    }
  }

  return {
    id,
    word,
    topic: entry.topic,
    length: entry.length ?? word.length,
    difficulty: entry.difficulty,
    tier: entry.tier,
    description: entry.description,
    hints: hintsAreComplete(entry)
      ? entry.hints
      : {
          position: { index: posIndex, letter: word[posIndex] },
          letters: { correct: word[correctIndex], decoy },
        },
  };
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node src/complete-hints.js <authoring-batch.json>');
    process.exit(2);
  }
  const abs = path.resolve(inputPath);
  const batch = JSON.parse(fs.readFileSync(abs, 'utf8'));
  if (!Array.isArray(batch)) {
    console.error('Input must be a JSON array.');
    process.exit(2);
  }

  const completed = batch.map((e, i) => completeEntry(e, i + 1));
  fs.writeFileSync(abs, JSON.stringify(completed, null, 2) + '\n');
  console.log(`${path.basename(abs)}: completed ${completed.length} entries (ids, lengths, hints)`);
}

main();
