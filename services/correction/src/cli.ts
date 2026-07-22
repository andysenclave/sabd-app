#!/usr/bin/env node
/**
 * Correction review CLI (T17) — the human pass between calibration and publish.
 *
 * Weekly loop:
 *   1. node src/cli.ts propose --events=<events.json...> [--bank=<path>] [--out=corrections.json]
 *        Aggregates real events, prints the drift report, writes a corrections file:
 *        auto nudges (approved: true) + flagged tier-crossers (approved: false).
 *   2. A human edits the file — flips `approved` on the tier-crossers they accept.
 *   3. node src/cli.ts apply --corrections=corrections.json [--bank=<path>] --out=<new-bank.json>
 *        Writes the corrected bank JSON → content pipeline publish → T8 slice publish
 *        as a new wordBankVersion.
 *
 * Events input: a JSON array of RoundEvents, or an ExportFile ({ rounds: [...] }) —
 * both the playtest "Send my data" files and a D1 dump work as-is.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RoundEvent, WordEntry } from '@sabd/contracts';
import { aggregateWords, calibrationEvents } from './aggregate.ts';
import { applyCorrections, defaultCalibration, proposeCorrections, type WordNudge } from './calibrate.ts';

const SERVICE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Post-3.0.0-flip: calibration runs against the UNIFIED bank (the live one).
const DEFAULT_BANK = path.resolve(
  SERVICE_ROOT, '..', '..', 'packages', 'wordbank', 'data', 'sabd-wordbank-unified.json',
);

function args(name: string): string[] {
  return process.argv.slice(3).filter((a) => a.startsWith(`--${name}=`)).map((a) => a.split('=').slice(1).join('='));
}
function arg(name: string): string | undefined {
  return args(name)[0];
}

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

function loadEvents(paths: string[]): RoundEvent[] {
  const events: RoundEvent[] = [];
  for (const p of paths) {
    const data = readJson<RoundEvent[] | { rounds: RoundEvent[] }>(p);
    events.push(...(Array.isArray(data) ? data : data.rounds));
  }
  return events;
}

interface CorrectionsFile {
  generatedAt: string;
  bankPath: string;
  corrections: Array<WordNudge & { approved: boolean; autoApplied: boolean }>;
}

function propose(): void {
  const eventPaths = args('events');
  if (eventPaths.length === 0) {
    console.error('Usage: cli.ts propose --events=<events.json> [--events=...] [--bank=] [--out=]');
    process.exit(1);
  }
  const bankPath = arg('bank') ?? DEFAULT_BANK;
  const bank = readJson<WordEntry[]>(bankPath);
  const rawEvents = loadEvents(eventPaths);
  const events = calibrationEvents(rawEvents); // F11: drop pre-3.0.0 evidence

  const stats = aggregateWords(events);
  const proposal = proposeCorrections(stats, bank, defaultCalibration);

  console.log(
    `\n${rawEvents.length} events (${events.length} on the unified scale) → ${stats.length} words with data ` +
      `(${proposal.belowFloor} below the ${defaultCalibration.minPlayers}-player floor)\n`,
  );

  if (proposal.autoNudges.length > 0) {
    console.log('DRIFTED (within-tier — auto-apply):');
    for (const n of proposal.autoNudges) {
      console.log(
        `  ${n.wordId} ${n.word.padEnd(12)} ${String(n.oldDifficulty).padStart(4)} → ${String(n.newDifficulty).padStart(4)}` +
          `  (solve ${(n.solveRate * 100).toFixed(0)}% · ${n.uniquePlayers}p · w${n.weight.toFixed(2)})`,
      );
    }
  }
  if (proposal.flagged.length > 0) {
    console.log('\nFLAGGED (tier-crossing — needs your approval, edit "approved"):');
    for (const n of proposal.flagged) {
      console.log(
        `  ${n.wordId} ${n.word.padEnd(12)} ${String(n.oldDifficulty).padStart(4)} → ${String(n.newDifficulty).padStart(4)}` +
          `  ${n.oldTier} → ${n.newTier}  (solve ${(n.solveRate * 100).toFixed(0)}% · ${n.uniquePlayers}p)`,
      );
    }
  }
  if (proposal.autoNudges.length + proposal.flagged.length === 0) {
    console.log('No corrections proposed — everything within tolerance.');
  }

  const out = arg('out') ?? path.join(SERVICE_ROOT, 'corrections.json');
  const file: CorrectionsFile = {
    generatedAt: new Date().toISOString(),
    bankPath,
    corrections: [
      ...proposal.autoNudges.map((n) => ({ ...n, approved: true, autoApplied: true })),
      ...proposal.flagged.map((n) => ({ ...n, approved: false, autoApplied: false })),
    ],
  };
  fs.writeFileSync(out, JSON.stringify(file, null, 2) + '\n');
  console.log(`\nWrote ${out} — review, flip "approved" on accepted tier-crossers, then run apply.`);
}

function apply(): void {
  const correctionsPath = arg('corrections') ?? path.join(SERVICE_ROOT, 'corrections.json');
  const outPath = arg('out');
  if (!outPath) {
    console.error('Usage: cli.ts apply --corrections=corrections.json --out=<new-bank.json> [--bank=]');
    process.exit(1);
  }
  const file = readJson<CorrectionsFile>(correctionsPath);
  const bank = readJson<WordEntry[]>(arg('bank') ?? file.bankPath);

  const approved = file.corrections.filter((c) => c.approved);
  const skipped = file.corrections.length - approved.length;
  const corrected = applyCorrections(bank, approved);

  fs.writeFileSync(outPath, JSON.stringify(corrected, null, 2) + '\n');
  console.log(
    `Applied ${approved.length} corrections (${skipped} unapproved skipped) → ${outPath}\n` +
      'Next: content pipeline publish with a bumped --version, then wordbank-publish.',
  );
}

const command = process.argv[2];
if (command === 'propose') propose();
else if (command === 'apply') apply();
else {
  console.error('Usage: cli.ts <propose|apply> ...');
  process.exit(1);
}
