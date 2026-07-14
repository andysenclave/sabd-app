/**
 * Web stub for the storage bootstrap. The web export exists ONLY as a dev preview
 * harness — persistence is native-only in Phase 2 (expo-sqlite on device). Keeping
 * expo-sqlite out of the web bundle avoids its wasm/worker setup entirely.
 *
 * Metro resolves `./db` to this file on web and to `./db.ts` on ios/android.
 */

import type { Storage } from './db.types.ts';

export type { Storage } from './db.types.ts';

export function initStorage(_dbName?: string): Storage {
  throw new Error('storage: not available on web (dev harness only)');
}

export function getStorage(): Storage {
  throw new Error('storage: not available on web (dev harness only)');
}

export function refreshRating(): number {
  throw new Error('storage: not available on web (dev harness only)');
}
