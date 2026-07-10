/**
 * Player row — the ONE row (event-log doc §4). The cache is what the UI reads;
 * the log is the truth it derives from.
 */

import { SEED_RATING } from '@sabd/contracts';
import type { SqlDriver } from './driver.ts';

export interface PlayerState {
  installId: string;
  createdAt: number;
  cachedRating: number;
  cachedGamesPlayed: number;
  /** Last round folded into the cache; NULL before the first round. */
  cachedAfterRoundId: string | null;
  /** NULL until sign-up. Reserved; nothing writes it in Phase 2. */
  userId: string | null;
}

interface PlayerRow {
  install_id: string;
  created_at: number;
  cached_rating: number;
  cached_games_played: number;
  cached_after_round_id: string | null;
  user_id: string | null;
}

function rowToPlayer(r: PlayerRow): PlayerState {
  return {
    installId: r.install_id,
    createdAt: r.created_at,
    cachedRating: r.cached_rating,
    cachedGamesPlayed: r.cached_games_played,
    cachedAfterRoundId: r.cached_after_round_id,
    userId: r.user_id,
  };
}

export function getPlayer(db: SqlDriver): PlayerState | undefined {
  const row = db.get<PlayerRow>('SELECT * FROM player LIMIT 1');
  return row ? rowToPlayer(row) : undefined;
}

/** Seed on first launch: rating 1200, gamesPlayed 0 (§5). Idempotent. */
export function seedPlayer(db: SqlDriver, installId: string, now: number): PlayerState {
  const existing = getPlayer(db);
  if (existing) return existing;
  db.run(
    `INSERT INTO player (install_id, created_at, cached_rating, cached_games_played, cached_after_round_id, user_id)
     VALUES (?, ?, ?, ?, NULL, NULL)`,
    [installId, now, SEED_RATING, 0],
  );
  return getPlayer(db)!;
}

/** Overwrite the cache (rating + games + snapshot pointer). Caller owns transactionality. */
export function updateCache(
  db: SqlDriver,
  rating: number,
  gamesPlayed: number,
  afterRoundId: string | null,
): void {
  db.run(
    'UPDATE player SET cached_rating = ?, cached_games_played = ?, cached_after_round_id = ?',
    [rating, gamesPlayed, afterRoundId],
  );
}
