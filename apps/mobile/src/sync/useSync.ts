/**
 * Sync boot (T14): one fire-and-forget sync pass (restore-if-fresh, then upload the
 * unsynced queue) once storage is ready. Never blocks play; every failure just
 * leaves events queued for the next open. Off entirely until INGEST_BASE_URL is
 * configured (T11 deploy).
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { getStorage } from '../storage/db';
import { INGEST_BASE_URL } from './config.ts';
import { syncPass, type FetchJson } from './syncClient.ts';

const fetchJson: FetchJson = async (url, init) => {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json() as Promise<unknown>;
};

let ran = false;

/** Call with `ready` from useStorageBoot; runs one pass per app launch. */
export function useSync(storageReady: boolean): void {
  useEffect(() => {
    if (!storageReady || ran || Platform.OS === 'web' || INGEST_BASE_URL === null) return;
    ran = true;

    const baseUrl = INGEST_BASE_URL;
    void (async () => {
      try {
        const { restore, upload } = await syncPass(getStorage().db, fetchJson, baseUrl, Date.now());
        if (restore) console.log(`sync: restored ${restore.restored} rounds → rating ${restore.rating}`);
        if (upload.uploaded > 0) console.log(`sync: uploaded ${upload.uploaded} rounds`);
      } catch (err) {
        // Offline / server down — events stay queued; next open retries.
        console.warn('sync: pass failed, will retry next open', err);
      }
    })();
  }, [storageReady]);
}
