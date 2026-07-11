import type { RoundEvent, ExportFile } from '@sabd/contracts';
import { ROUND_EVENT_SCHEMA_VERSION } from '@sabd/contracts';

let counter = 0;

export function makeRound(overrides: Partial<RoundEvent> = {}): RoundEvent {
  counter += 1;
  return {
    roundId: `round-${counter}`,
    schemaVersion: ROUND_EVENT_SCHEMA_VERSION,
    installId: 'install-a',
    playedAt: 1_700_000_000_000 + counter * 60_000,
    wordId: 'GAM-0001',
    wordRatingAtPlay: 1000,
    wordBankVersion: '1.0.0',
    topic: 'Gaming',
    solved: true,
    timeLimitSec: 60,
    timeUsedSec: 20,
    hintsUsed: [],
    mode: 'solo',
    playerRatingBefore: 1200,
    engineConfigVersion: '1.0.0',
    syncedAt: null,
    ...overrides,
  };
}

export function makeExport(overrides: Partial<ExportFile> = {}): ExportFile {
  return {
    installId: 'install-a',
    schemaVersion: ROUND_EVENT_SCHEMA_VERSION,
    exportedAt: 1_700_000_100_000,
    rounds: [makeRound()],
    ...overrides,
  };
}
