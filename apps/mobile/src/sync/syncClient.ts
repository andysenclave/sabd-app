/**
 * Client sync (T14) — upload unsynced events on open/online (fire-and-forget, queue
 * on failure), restore a fresh install from the server's copy of its log (T13).
 * Pure logic over an injected `fetchJson` + the storage SqlDriver, so the whole flow
 * is node-testable. Failures never surface to play: events stay queued (synced_at
 * NULL) and retry next open. Airplane mode is a quiet no-op.
 *
 * Divergence note (in-lane interpretation of "server wins"): after a full upload the
 * server replays the SAME events the client holds, so a score mismatch means replay-
 * order or config drift, not data loss — it is LOGGED for diagnosis, not blindly
 * written into a cache the local log would immediately contradict (verifyRating
 * would revert it on next launch). The server snapshot is *applied* on the restore
 * path, where the log itself is adopted (restoreEvents) and cache + log agree.
 */

import type { RoundEvent, SyncUploadResponse } from '@sabd/contracts';
import { ROUND_EVENT_SCHEMA_VERSION, validateSyncDownResponse } from '@sabd/contracts';
import type { SqlDriver } from '@sabd/storage';
import { countRounds, getPlayer, getUnsynced, markSynced, restoreEvents } from '@sabd/storage';
import { UPLOAD_BATCH_SIZE } from './config.ts';

/** Injected transport: JSON in/out; throws on network or HTTP error. */
export type FetchJson = (url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) => Promise<unknown>;

export interface UploadSummary {
  uploaded: number;
  rejected: number;
  /** True when the server's replay disagreed with the local cache (logged, T12 diagnostics). */
  diverged: boolean;
}

/** Upload every unsynced event in batches; stamp synced_at for accepted + duplicates. */
export async function uploadUnsynced(
  db: SqlDriver,
  fetchJson: FetchJson,
  baseUrl: string,
  now: number,
  warn: (msg: string) => void = console.warn,
): Promise<UploadSummary> {
  const player = getPlayer(db);
  if (!player) return { uploaded: 0, rejected: 0, diverged: false };

  const summary: UploadSummary = { uploaded: 0, rejected: 0, diverged: false };
  const unsynced = getUnsynced(db);

  for (let i = 0; i < unsynced.length; i += UPLOAD_BATCH_SIZE) {
    const batch = unsynced.slice(i, i + UPLOAD_BATCH_SIZE);
    const response = (await fetchJson(`${baseUrl}/v1/rounds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installId: player.installId,
        schemaVersion: ROUND_EVENT_SCHEMA_VERSION,
        events: batch,
      }),
    })) as SyncUploadResponse;

    const done = [...response.acceptedRoundIds, ...response.duplicateRoundIds];
    if (done.length > 0) markSynced(db, done, now);
    summary.uploaded += done.length;
    summary.rejected += response.rejectedRoundIds.length;
    if (response.rejectedRoundIds.length > 0) {
      warn(`sync: server rejected ${response.rejectedRoundIds.length} events — kept local`);
    }

    // Diagnostics only — see module note.
    if (response.snapshot.global.score !== getPlayer(db)!.cachedRating) {
      summary.diverged = true;
      warn(
        `sync: server replay says ${response.snapshot.global.score}, local cache says ` +
          `${getPlayer(db)!.cachedRating} — investigate (order/config drift)`,
      );
    }
  }

  return summary;
}

export interface RestoreSummary {
  restored: number;
  rating: number;
}

/**
 * Reinstall restore (T13): a FRESH install (no local rounds) pulls its full log
 * from the server and adopts it. No-op when local rounds exist or the server has
 * nothing (genuinely new player).
 */
export async function restoreIfFresh(
  db: SqlDriver,
  fetchJson: FetchJson,
  baseUrl: string,
  now: number,
  warn: (msg: string) => void = console.warn,
): Promise<RestoreSummary | null> {
  if (countRounds(db) > 0) return null;
  const player = getPlayer(db);
  if (!player) return null;

  const raw = await fetchJson(
    `${baseUrl}/v1/me?includeEvents=1`,
    { headers: { 'X-Install-Id': player.installId } },
  );
  const checked = validateSyncDownResponse(raw);
  if (!checked.ok) {
    warn(`sync: /v1/me response invalid (${checked.errors[0] ?? 'unknown'}) — skipping restore`);
    return null;
  }
  const events: RoundEvent[] = checked.value.events ?? [];
  if (events.length === 0) return null;

  const outcome = restoreEvents(db, events, now);
  if (outcome.rating !== checked.value.snapshot.global.score) {
    warn(
      `sync: restored replay says ${outcome.rating}, server snapshot says ` +
        `${checked.value.snapshot.global.score} — investigate`,
    );
  }
  return { restored: outcome.restored, rating: outcome.rating };
}

/** One full sync pass: restore (fresh installs) then upload the queue. */
export async function syncPass(
  db: SqlDriver,
  fetchJson: FetchJson,
  baseUrl: string,
  now: number,
  warn: (msg: string) => void = console.warn,
): Promise<{ restore: RestoreSummary | null; upload: UploadSummary }> {
  const restore = await restoreIfFresh(db, fetchJson, baseUrl, now, warn);
  const upload = await uploadUnsynced(db, fetchJson, baseUrl, now, warn);
  return { restore, upload };
}
