import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadAll, MixedSchemaVersionError } from '../src/load.ts';
import { makeExport, makeRound } from './fixtures.ts';

function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'sabd-playtest-'));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('dedupes rounds by roundId across files', () => {
  withTempDir((dir) => {
    const shared = makeRound({ roundId: 'shared-1' });
    writeFileSync(join(dir, 'a.json'), JSON.stringify(makeExport({ installId: 'i1', rounds: [shared] })));
    writeFileSync(join(dir, 'b.json'), JSON.stringify(makeExport({ installId: 'i1', rounds: [shared] })));

    const result = loadAll(dir, false);
    assert.equal(result.rounds.length, 1);
    assert.equal(result.duplicateRoundsDropped, 1);
    assert.equal(result.fileCount, 2);
  });
});

test('mixed schemaVersion is rejected without --force, listing offending files', () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, 'a.json'), JSON.stringify(makeExport({ schemaVersion: 1 })));
    writeFileSync(join(dir, 'b.json'), JSON.stringify(makeExport({ schemaVersion: 2 })));

    assert.throws(() => loadAll(dir, false), MixedSchemaVersionError);
    try {
      loadAll(dir, false);
      assert.fail('expected throw');
    } catch (err) {
      assert.ok(err instanceof MixedSchemaVersionError);
      assert.match(err.message, /a\.json/);
      assert.match(err.message, /b\.json/);
    }
  });
});

test('mixed schemaVersion proceeds with --force', () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, 'a.json'), JSON.stringify(makeExport({ schemaVersion: 1 })));
    writeFileSync(join(dir, 'b.json'), JSON.stringify(makeExport({ schemaVersion: 2, installId: 'i2', rounds: [makeRound({ installId: 'i2' })] })));

    const result = loadAll(dir, true);
    assert.equal(result.rounds.length, 2);
    assert.deepEqual([...result.schemaVersions].sort(), [1, 2]);
  });
});

test('installIds are pseudonymised, never surfaced raw', () => {
  withTempDir((dir) => {
    writeFileSync(
      join(dir, 'a.json'),
      JSON.stringify(makeExport({ installId: 'super-secret-uuid', rounds: [makeRound({ installId: 'super-secret-uuid' })] })),
    );
    const result = loadAll(dir, false);
    const pseudonym = result.pseudonyms.get('super-secret-uuid');
    assert.equal(pseudonym, 'player_1');
    assert.ok(![...result.pseudonyms.values()].includes('super-secret-uuid'));
  });
});

test('throws a clear error on an empty directory', () => {
  withTempDir((dir) => {
    assert.throws(() => loadAll(dir, false), /No \*\.json export files/);
  });
});

test('rejects a file that fails the ExportFile schema', () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, 'broken.json'), JSON.stringify({ not: 'an export' }));
    assert.throws(() => loadAll(dir, false), /does not match the export schema/);
  });
});
