#!/usr/bin/env node
/**
 * analyze-playtests — reads a folder of "Send my data" JSON exports and prints the
 * handful of numbers that should change what you build next (playtest-analysis doc).
 *
 * Usage:
 *   node src/index.ts <exports-dir> [--force] [--word-shortlist]
 *
 *   --force            proceed even if export files disagree on schemaVersion
 *   --word-shortlist   print ONLY the §3.4 outlier list, as JSON (for hand-editing
 *                      the word bank) — skips the plain-text report entirely
 *
 * Plain text to stdout. No charts, no HTML, no database — you'll read this five
 * times total.
 */
import { loadAll, MixedSchemaVersionError } from './load.ts';
import { loopReport } from './report/loop.ts';
import { hintsReport } from './report/hints.ts';
import { timingReport } from './report/timing.ts';
import { wordsReportText, computeWordStats, wordOutliers } from './report/words.ts';
import { topicsReport } from './report/topics.ts';

function main(): void {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--'));
  const force = args.includes('--force');
  const wordShortlistOnly = args.includes('--word-shortlist');

  if (!dir) {
    console.error('Usage: node src/index.ts <exports-dir> [--force] [--word-shortlist]');
    process.exit(2);
  }

  let result;
  try {
    result = loadAll(dir, force);
  } catch (err) {
    if (err instanceof MixedSchemaVersionError) {
      console.error(err.message);
      process.exit(1);
    }
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const { rounds, pseudonyms, fileCount, duplicateRoundsDropped } = result;

  if (wordShortlistOnly) {
    const outliers = wordOutliers(computeWordStats(rounds));
    process.stdout.write(JSON.stringify(outliers, null, 2) + '\n');
    return;
  }

  console.log(`Sabd playtest report`);
  console.log(`${fileCount} export file(s), ${rounds.length} round(s), ${pseudonyms.size} player(s)`);
  if (duplicateRoundsDropped > 0) {
    console.log(`(${duplicateRoundsDropped} duplicate round(s) deduped by roundId)`);
  }

  if (rounds.length === 0) {
    console.log('\nNo rounds to analyze.');
    return;
  }

  console.log(loopReport(rounds, pseudonyms));
  console.log(hintsReport(rounds));
  console.log(timingReport(rounds));
  console.log(wordsReportText(rounds));
  console.log(topicsReport(rounds, pseudonyms));

  console.log(
    '\n\nRead §3.1 first. If rounds-per-session is 1–2, nothing else here matters — go talk to people.',
  );
}

main();
