import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { countRounds, topicStats, type TopicStats } from '@sabd/storage';

import { getStorage } from '../storage/db';

export interface HomeStats {
  rounds: number;
  /** Keyed by bank topic string. */
  byTopic: ReadonlyMap<string, TopicStats>;
}

const EMPTY: HomeStats = { rounds: 0, byTopic: new Map() };

/** Log-derived Home numbers. Web harness (no SQLite) reports zeros. */
export function useHomeStats(storageReady: boolean): HomeStats {
  const [stats, setStats] = useState<HomeStats>(EMPTY);

  useEffect(() => {
    if (!storageReady || Platform.OS === 'web') return;
    try {
      const { db } = getStorage();
      setStats({
        rounds: countRounds(db),
        byTopic: new Map(topicStats(db).map((s) => [s.topic, s])),
      });
    } catch (err) {
      console.error('home: stats failed', err);
    }
  }, [storageReady]);

  return stats;
}
