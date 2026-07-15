/**
 * Bank boot (T10): load installed slices from disk into the live bank, then fire a
 * background sync pass when a manifest url is configured. Fire-and-forget — play
 * never waits on the network; failures keep the cached/bundled bank (standing
 * order 5: offline never breaks).
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { TOPIC_IDS, WORD_TIERS } from '@sabd/contracts';
import type { TopicId, WordTier } from '@sabd/contracts';
import { WORDBANK_MANIFEST_URL } from './config.ts';
import { createExpoSliceIO } from './expoSliceIO.ts';
import { loadInstalledSlices, syncSlices } from './sliceSync.ts';
import { applySlices, installedVersions } from './liveBank.ts';

const ALL_CELLS: ReadonlyArray<{ topicId: TopicId; tier: WordTier }> = TOPIC_IDS.flatMap(
  (topicId) => WORD_TIERS.map((tier) => ({ topicId, tier })),
);

let booted = false;

export function useBankBoot(): void {
  useEffect(() => {
    if (Platform.OS === 'web' || booted) return; // web harness plays the bundled bank
    booted = true;

    const io = createExpoSliceIO();
    void (async () => {
      try {
        // 1. Disk → live bank (instant, no network).
        applySlices(await loadInstalledSlices(io, ALL_CELLS));

        // 2. Background refresh (only when T9 hosting is configured).
        if (WORDBANK_MANIFEST_URL !== null) {
          const result = await syncSlices(io, WORDBANK_MANIFEST_URL, installedVersions());
          if (result.updated.length > 0) {
            applySlices(await loadInstalledSlices(io, ALL_CELLS));
            console.log(`bank sync: refreshed ${result.updated.length} slices (${result.manifestVersion})`);
          }
        }
      } catch (err) {
        console.warn('bank boot: falling back to bundled bank', err);
      }
    })();
  }, []);
}
