/**
 * Identity (event-log doc §2) — a random UUID generated once on first launch.
 *
 * It is an INSTALL id: meaningless outside Sabd, dies on uninstall, never a device
 * identifier. The UUID source is injected (expo-crypto's randomUUID in the app,
 * node:crypto in tests) so this stays pure.
 */

import type { SqlDriver } from './driver.ts';
import { getPlayer, seedPlayer, type PlayerState } from './player.ts';

export function getOrCreateInstallId(
  db: SqlDriver,
  randomUUID: () => string,
  now: number,
): PlayerState {
  return getPlayer(db) ?? seedPlayer(db, randomUUID(), now);
}
