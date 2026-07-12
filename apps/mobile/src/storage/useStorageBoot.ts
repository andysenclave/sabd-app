import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SEED_RATING } from '@sabd/contracts';

// Extensionless: Metro picks db.web.ts on web, db.ts on native.
import { initStorage, refreshRating } from './db';

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

  // Re-verify on focus: a round recorded from `/round` never unmounts this screen
  // (expo-router keeps stack screens alive), so the boot effect above only ever
  // runs once. Without this, the header rating is stuck at whatever it was on
  // cold start until the app is fully closed and reopened.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') return;
      try {
        const rating = refreshRating();
        setState((prev) => (prev.rating === rating ? prev : { ...prev, rating }));
      } catch (err) {
        console.error('storage: refreshRating failed', err);
      }
    }, []),
  );

  return state;
}
