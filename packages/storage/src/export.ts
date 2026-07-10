/**
 * Export (event-log doc §8/§9.5) — serialize unsynced rounds into the "Send my data"
 * envelope. The Settings screen (T23) shows the ACTUAL rounds/fields/count from this
 * before anything moves; `synced_at` stays untouched by the manual loop.
 */

import type { ExportFile } from '@sabd/contracts';
import { ROUND_EVENT_SCHEMA_VERSION } from '@sabd/contracts';
import type { SqlDriver } from './driver.ts';
import { getUnsynced } from './events.ts';
import { getPlayer } from './player.ts';

export function buildExport(db: SqlDriver, exportedAt: number): ExportFile {
  const player = getPlayer(db);
  if (!player) throw new Error('buildExport: no player row — seedPlayer must run first');
  return {
    installId: player.installId,
    schemaVersion: ROUND_EVENT_SCHEMA_VERSION,
    exportedAt,
    rounds: getUnsynced(db),
  };
}

export function serializeExport(file: ExportFile): string {
  return JSON.stringify(file, null, 2);
}
