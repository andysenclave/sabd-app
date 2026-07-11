/**
 * load.ts — read every export file in a directory, validate, dedupe by roundId
 * across ALL files (§4 req. 1), refuse mixed schemaVersions without --force
 * (req. 2), pseudonymise installId → player_N (req. 5 — installIds never print).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { ExportFile, RoundEvent } from '@sabd/contracts';
import { validateExportFile } from '@sabd/contracts';

export interface LoadedFile {
  path: string;
  file: ExportFile;
}

export interface LoadResult {
  rounds: readonly RoundEvent[];
  /** installId → player_N, stable within one run. */
  pseudonyms: ReadonlyMap<string, string>;
  fileCount: number;
  duplicateRoundsDropped: number;
  schemaVersions: readonly number[];
}

export class MixedSchemaVersionError extends Error {
  readonly versions: ReadonlyMap<number, readonly string[]>;

  constructor(versions: ReadonlyMap<number, readonly string[]>) {
    const lines = [...versions.entries()]
      .map(([v, files]) => `  schemaVersion ${v}: ${files.join(', ')}`)
      .join('\n');
    super(`Export files disagree on schemaVersion — pass --force to override:\n${lines}`);
    this.name = 'MixedSchemaVersionError';
    this.versions = versions;
  }
}

/** Reads every *.json file directly inside `dir` (non-recursive). */
export function readExportFiles(dir: string): LoadedFile[] {
  const names = readdirSync(dir).filter((n) => n.endsWith('.json'));
  const out: LoadedFile[] = [];
  for (const name of names) {
    const path = join(dir, name);
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const result = validateExportFile(raw);
    if (!result.ok) {
      throw new Error(`${path} does not match the export schema:\n  ${result.errors.join('\n  ')}`);
    }
    out.push({ path, file: result.value });
  }
  return out;
}

export function loadAll(dir: string, force: boolean): LoadResult {
  const files = readExportFiles(dir);
  if (files.length === 0) throw new Error(`No *.json export files found in ${dir}`);

  const versionToFiles = new Map<number, string[]>();
  for (const { path, file } of files) {
    const list = versionToFiles.get(file.schemaVersion) ?? [];
    list.push(path);
    versionToFiles.set(file.schemaVersion, list);
  }
  if (versionToFiles.size > 1 && !force) {
    throw new MixedSchemaVersionError(versionToFiles);
  }

  const pseudonyms = new Map<string, string>();
  for (const { file } of [...files].sort((a, b) => a.file.installId.localeCompare(b.file.installId))) {
    if (!pseudonyms.has(file.installId)) {
      pseudonyms.set(file.installId, `player_${pseudonyms.size + 1}`);
    }
  }

  const byRoundId = new Map<string, RoundEvent>();
  let duplicateRoundsDropped = 0;
  for (const { file } of files) {
    for (const round of file.rounds) {
      if (byRoundId.has(round.roundId)) {
        duplicateRoundsDropped++;
        continue;
      }
      byRoundId.set(round.roundId, round);
    }
  }

  return {
    rounds: [...byRoundId.values()].sort((a, b) => a.playedAt - b.playedAt),
    pseudonyms,
    fileCount: files.length,
    duplicateRoundsDropped,
    schemaVersions: [...versionToFiles.keys()],
  };
}
