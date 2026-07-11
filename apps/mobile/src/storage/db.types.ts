/** Shared shape for the platform-split storage bootstrap (db.ts / db.web.ts). */

import type { SqlDriver, PlayerState, VerifyResult } from '@sabd/storage';

export interface Storage {
  db: SqlDriver;
  player: PlayerState;
  verify: VerifyResult;
}
