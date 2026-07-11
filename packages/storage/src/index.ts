/**
 * @sabd/storage — the event log core (event-log doc, T9/T10).
 *
 * Pure logic against the SqlDriver seam; the app provides an expo-sqlite adapter,
 * tests provide node:sqlite. The log is the truth; the rating is derived.
 */

export type { SqlDriver, SqlValue } from './driver.ts';
export { MIGRATIONS, getSchemaVersion, runMigrations, type Migration } from './migrations.ts';
export { getPlayer, seedPlayer, updateCache, type PlayerState } from './player.ts';
export {
  appendRound,
  countRounds,
  getRoundsAfter,
  getUnsynced,
  markSynced,
  playedWordIds,
  topicStats,
  type AppendResult,
  type TopicStats,
} from './events.ts';
export {
  recordRound,
  type RecordRoundInput,
  type RecordRoundOutcome,
} from './recordRound.ts';
export {
  eventToRoundResult,
  fullReplay,
  replayEvents,
  verifyRating,
  type ReplayOutcome,
  type VerifyResult,
} from './replay.ts';
export { buildExport, serializeExport } from './export.ts';
export { getOrCreateInstallId } from './identity.ts';
