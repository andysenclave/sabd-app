#!/usr/bin/env node
// validate.js — Sabd batch validator (all rules from brief §6).
//
// Usage:
//   node src/validate.js data/raw/GAM-batch1.json [--no-api] [--max-print N]
//
// Writes  data/reports/<name>-report.json
// Splits  data/clean/<name>-passed.json / -rejected.json / -review.json
// Exits non-zero when any entry hard-fails.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookupWord } from './dict.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TOPICS = {
  Gaming: 'GAM',
  'Space & Sci-Fi': 'SPC',
  Music: 'MUS',
  'Internet & Tech Culture': 'NET',
  'Food & Drink': 'FUD',
  'World & Places': 'WLD',
};

const TIER_BANDS = { low: [800, 1200], mid: [1201, 1600], high: [1601, 2200] };
const EXPECTED_SPLIT_PER_60 = { low: 24, mid: 24, high: 12 };

// Phrases that make a free description read like a dictionary entry.
const DEFINITIONAL_PATTERNS = [
  /\bis an?\b/i,
  /\bmeans\b/i,
  /\brefers to\b/i,
  /\b(a|the) term for\b/i,
  /\btype of\b/i,
  /\bkind of\b/i,
  /\bused (to|for)\b/i,
  /\bdevice (that|for)\b/i,
  /\bsomeone who\b/i,
  /\bperson who\b/i,
  /\bthe act of\b/i,
  /\banother (word|name) for\b/i,
];

// ---------------------------------------------------------------------------

function isString(x) {
  return typeof x === 'string';
}

function descriptionTokens(desc) {
  return String(desc)
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
}

/**
 * Run every hard rule (§6 rules 1–11) against one entry.
 * Returns array of {rule, detail}.
 */
function hardCheck(entry, ctx) {
  const errors = [];
  const fail = (rule, detail) => errors.push({ rule, detail });

  const word = isString(entry.word) ? entry.word : '';

  // 1. word format
  if (!/^[A-Z]{3,8}$/.test(word)) {
    fail('word-format', `word ${JSON.stringify(entry.word)} must be UPPERCASE A-Z, 3-8 letters`);
  }

  // topic sanity (schema: exact topic name from §2; prefix must match)
  if (!(entry.topic in TOPICS)) {
    fail('topic-invalid', `topic ${JSON.stringify(entry.topic)} is not a known topic`);
  }

  // 2. length
  if (entry.length !== word.length || !Number.isInteger(entry.length)) {
    fail('length-mismatch', `length=${entry.length} but word has ${word.length} letters`);
  }

  // 3. tier
  const tierOk = ['low', 'mid', 'high'].includes(entry.tier);
  if (!tierOk) fail('tier-invalid', `tier ${JSON.stringify(entry.tier)} not in low|mid|high`);

  // 4. difficulty
  const d = entry.difficulty;
  if (!Number.isInteger(d) || d < 800 || d > 2200) {
    fail('difficulty-range', `difficulty=${d} outside 800-2200`);
  } else if (tierOk) {
    const [lo, hi] = TIER_BANDS[entry.tier];
    if (d < lo || d > hi) {
      fail('difficulty-band', `difficulty=${d} outside ${entry.tier} band ${lo}-${hi}`);
    }
  }

  // 5-6. position hint
  const pos = entry.hints?.position;
  if (!pos || !Number.isInteger(pos.index) || pos.index < 0 || pos.index >= word.length) {
    fail('position-index', `position.index=${pos?.index} out of range for ${word || '(no word)'}`);
  } else if (pos.letter !== word[pos.index]) {
    fail(
      'position-letter',
      `position.letter=${JSON.stringify(pos?.letter)} but ${word}[${pos.index}] is "${word[pos.index]}"`
    );
  }

  // 7. letters.correct
  const lt = entry.hints?.letters;
  if (!lt || !/^[A-Z]$/.test(lt.correct ?? '')) {
    fail('letters-correct', `letters.correct=${JSON.stringify(lt?.correct)} not a single A-Z char`);
  } else if (!word.includes(lt.correct)) {
    fail('letters-correct', `letters.correct="${lt.correct}" does not appear in ${word}`);
  }

  // 8. letters.decoy
  if (!lt || !/^[A-Z]$/.test(lt.decoy ?? '')) {
    fail('letters-decoy', `letters.decoy=${JSON.stringify(lt?.decoy)} not a single A-Z char`);
  } else if (word.includes(lt.decoy)) {
    fail('letters-decoy', `letters.decoy="${lt.decoy}" IS in ${word} — broken decoy`);
  }

  // 9. description
  const desc = isString(entry.description) ? entry.description.trim() : '';
  const words = desc ? desc.split(/\s+/) : [];
  if (!desc) {
    fail('description-empty', 'description is empty');
  } else if (words.length > 12) {
    fail('description-length', `description has ${words.length} words (max 12)`);
  } else if (word && descriptionTokens(desc).some((t) => t.includes(word))) {
    const tok = descriptionTokens(desc).find((t) => t.includes(word));
    fail('description-leak', `description token "${tok}" contains the word ${word}`);
  }

  // 10. id
  const expectedPrefix = TOPICS[entry.topic];
  const idRe = expectedPrefix
    ? new RegExp(`^${expectedPrefix}-\\d{4}$`)
    : /^[A-Z]{3}-\d{4}$/;
  if (!isString(entry.id) || !idRe.test(entry.id)) {
    fail('id-malformed', `id ${JSON.stringify(entry.id)} must match ${expectedPrefix ?? 'XXX'}-NNNN`);
  } else if (ctx.seenIds.has(entry.id)) {
    fail('id-duplicate', `id ${entry.id} already used by ${ctx.seenIds.get(entry.id)}`);
  }

  // 11. word duplicate
  const wkey = word.toLowerCase();
  if (word && ctx.seenWords.has(wkey)) {
    fail('word-duplicate', `word ${word} already used by ${ctx.seenWords.get(wkey)}`);
  }

  return errors;
}

/** Soft flags → review bucket (never hard-fail). */
function softCheck(entry) {
  const flags = [];
  const desc = isString(entry.description) ? entry.description.trim() : '';
  if (!desc) return flags;

  const wordCount = desc.split(/\s+/).length;
  if (wordCount <= 4) {
    flags.push({
      flag: 'description-short-literal',
      detail: `description is only ${wordCount} words — may be too direct`,
    });
  }
  const pat = DEFINITIONAL_PATTERNS.find((p) => p.test(desc));
  if (pat) {
    flags.push({
      flag: 'description-definitional',
      detail: `description matches definitional pattern ${pat} — reads like a dictionary entry`,
    });
  }
  return flags;
}

// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const useApi = !args.includes('--no-api');
  const maxPrintIdx = args.indexOf('--max-print');
  const MAX_PRINT = maxPrintIdx !== -1 ? Number(args[maxPrintIdx + 1]) || 5 : 5;
  const inputPath = args.find((a) => !a.startsWith('--') && a !== String(MAX_PRINT));

  if (!inputPath) {
    console.error('Usage: node src/validate.js <batch.json> [--no-api] [--max-print N]');
    process.exit(2);
  }

  const absInput = path.resolve(inputPath);
  let batch;
  try {
    batch = JSON.parse(fs.readFileSync(absInput, 'utf8'));
  } catch (e) {
    console.error(`Cannot read/parse ${absInput}: ${e.message}`);
    process.exit(2);
  }
  if (!Array.isArray(batch)) {
    console.error('Input must be a JSON array of entries.');
    process.exit(2);
  }

  const base = path.basename(absInput).replace(/\.json$/i, '');
  const ctx = { seenIds: new Map(), seenWords: new Map() };

  const passed = [];
  const rejected = [];
  const review = [];
  const entryResults = [];
  const failuresByRule = {};
  const addFailure = (rule, rec) => (failuresByRule[rule] ??= []).push(rec);

  for (const entry of batch) {
    const label = entry?.id ?? entry?.word ?? '(no id)';
    const errors = hardCheck(entry ?? {}, ctx);
    const flags = softCheck(entry ?? {});

    // Rule 12 — real-word check. Wordlist first, cached API fallback for
    // misses. A miss is NOT a mechanical reject: legitimate topic jargon
    // (e.g. RESPAWN, AGGRO) goes to the review bucket for human eyes.
    const word = isString(entry?.word) ? entry.word : '';
    if (word && /^[A-Z]{3,8}$/.test(word)) {
      const dict = await lookupWord(word, { useApi });
      if (!dict.inWordlist) {
        if (dict.api === 'found') {
          flags.push({
            flag: 'dictionary-api-only',
            detail: 'not in local wordlist; confirmed by dictionaryapi.dev',
          });
          // confirmed real word — informational flag only, still passes
        } else {
          flags.push({
            flag: 'not-in-dictionary',
            detail:
              dict.api === 'notfound'
                ? 'missing from wordlist AND dictionaryapi.dev — possible topic jargon, needs human review'
                : `missing from wordlist (API ${dict.api}) — possible topic jargon, needs human review`,
            severity: 'review',
          });
        }
      }
    }

    // register id/word AFTER dup-check so later dupes point at the first user
    if (isString(entry?.id)) ctx.seenIds.set(entry.id, label);
    if (word) ctx.seenWords.set(word.toLowerCase(), label);

    for (const e of errors) addFailure(e.rule, { id: label, word, detail: e.detail });

    const needsReview = flags.some((f) => f.severity === 'review' || f.flag.startsWith('description-'));
    let status;
    if (errors.length > 0) {
      status = 'rejected';
      rejected.push(entry);
    } else if (needsReview) {
      status = 'review';
      review.push(entry);
    } else {
      status = 'passed';
      passed.push(entry);
    }
    entryResults.push({ id: label, word, status, errors, flags });
  }

  // ---- per-batch tier split -------------------------------------------
  const actualSplit = { low: 0, mid: 0, high: 0 };
  for (const e of batch) if (e?.tier in actualSplit) actualSplit[e.tier]++;
  const scale = batch.length / 60;
  const expectedSplit = {
    low: Math.round(EXPECTED_SPLIT_PER_60.low * scale),
    mid: Math.round(EXPECTED_SPLIT_PER_60.mid * scale),
    high: Math.round(EXPECTED_SPLIT_PER_60.high * scale),
  };
  const tierSplitOk =
    actualSplit.low === expectedSplit.low &&
    actualSplit.mid === expectedSplit.mid &&
    actualSplit.high === expectedSplit.high;

  // ---- write outputs ----------------------------------------------------
  const report = {
    input: path.relative(ROOT, absInput),
    generatedAt: new Date().toISOString(),
    apiFallback: useApi ? 'enabled' : 'disabled (--no-api)',
    totals: {
      entries: batch.length,
      passed: passed.length,
      rejected: rejected.length,
      review: review.length,
    },
    tierSplit: { expected: expectedSplit, actual: actualSplit, ok: tierSplitOk },
    failuresByRule,
    entries: entryResults,
  };

  const reportsDir = path.join(ROOT, 'data', 'reports');
  const cleanDir = path.join(ROOT, 'data', 'clean');
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.mkdirSync(cleanDir, { recursive: true });

  const reportPath = path.join(reportsDir, `${base}-report.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  const writeBucket = (suffix, items) => {
    const p = path.join(cleanDir, `${base}-${suffix}.json`);
    fs.writeFileSync(p, JSON.stringify(items, null, 2) + '\n');
    return p;
  };
  writeBucket('passed', passed);
  writeBucket('rejected', rejected);
  writeBucket('review', review);

  // ---- human summary -----------------------------------------------------
  const line = '─'.repeat(60);
  console.log(line);
  console.log(`Sabd validator — ${path.basename(absInput)}`);
  console.log(line);
  console.log(
    `Entries: ${batch.length}   PASSED: ${passed.length}   REJECTED: ${rejected.length}   REVIEW: ${review.length}`
  );
  console.log(
    `Tier split (low/mid/high): actual ${actualSplit.low}/${actualSplit.mid}/${actualSplit.high}` +
      `  expected ${expectedSplit.low}/${expectedSplit.mid}/${expectedSplit.high}  ${tierSplitOk ? 'OK' : '** OFF **'}`
  );
  console.log(`Dictionary API fallback: ${report.apiFallback}`);

  const ruleIds = Object.keys(failuresByRule);
  if (ruleIds.length) {
    console.log(`\nHard failures by rule (first ${MAX_PRINT} each):`);
    for (const rule of ruleIds.sort()) {
      const fails = failuresByRule[rule];
      console.log(`  [${rule}] ×${fails.length}`);
      for (const f of fails.slice(0, MAX_PRINT)) {
        console.log(`      ${f.id} ${f.word || ''}: ${f.detail}`);
      }
      if (fails.length > MAX_PRINT) console.log(`      … and ${fails.length - MAX_PRINT} more`);
    }
  } else {
    console.log('\nNo hard failures.');
  }

  const flagged = entryResults.filter((r) => r.flags.length > 0);
  if (flagged.length) {
    console.log(`\nSoft flags (${flagged.length} entries):`);
    for (const r of flagged.slice(0, MAX_PRINT * 3)) {
      for (const f of r.flags) console.log(`  ${r.id} ${r.word}: [${f.flag}] ${f.detail}`);
    }
    if (flagged.length > MAX_PRINT * 3) console.log(`  … and more, see report`);
  }

  console.log(`\nReport:  ${path.relative(process.cwd(), reportPath)}`);
  console.log(
    `Buckets: data/clean/${base}-passed.json | -rejected.json | -review.json`
  );
  console.log(line);

  process.exit(rejected.length > 0 ? 1 : 0);
}

main();
