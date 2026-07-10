import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SEED_RATING } from '@sabd/contracts';

import { initStorage } from './db.ts';

export interface StorageBoot {
  ready: boolean;
  /** Verified rating (log-backed) on native; the seed on web (dev harness — no SQLite). */
  rating: number;
  installId: string | null;
}

/**
 * Boots the storage singleton once (migrations → installId → verifyRating).
 * On web — our dev preview harness only — expo-sqlite isn't configured, so we skip
 * persistence and report the seed. Real devices always take the native path.
 */
export function useStorageBoot(): StorageBoot {
  const [state, setState] = useState<StorageBoot>({
    ready: false,
    rating: SEED_RATING,
    installId: null,
  });

  useEffect(() => {
    if (Platform.OS === 'web') {
      setState({ ready: true, rating: SEED_RATING, installId: null });
      return;
    }
    try {
      const s = initStorage();
      setState({ ready: true, rating: s.verify.rating, installId: s.player.installId });
    } catch (err) {
      console.error('storage: init failed', err);
      setState({ ready: true, rating: SEED_RATING, installId: null });
    }
  }, []);

  return state;
}
