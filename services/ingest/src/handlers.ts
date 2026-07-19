/**
 * HTTP-agnostic handlers (T11/T13) — pure request-shape → response-shape functions
 * over an injected EventStore. The Worker adapter (worker.ts) only parses/serializes.
 *
 * No auth (Phase 3): the anonymous installId is the identity. Nothing is trusted
 * beyond "these events happened" — every numeric truth is recomputed by replay.
 */

import type { RoundEvent, SyncDownResponse, SyncUploadResponse } from '@sabd/contracts';
import { validateRoundEvent } from '@sabd/contracts';
import { configForVersion, isPointsEraConfig } from '@sabd/elo';
import { computeSnapshot } from './replay.ts';
import type { EventStore } from './store.ts';

export interface HandlerError {
  status: 400 | 404;
  errors: readonly string[];
}

export type HandlerResult<T> = { ok: true; body: T } | { ok: false; error: HandlerError };

/** Hard cap per upload call — a weeks-offline backlog arrives as multiple batches. */
export const MAX_BATCH_SIZE = 500;

/**
 * POST /v1/rounds — idempotent on roundId. A bad batch ENVELOPE (shape, missing
 * installId, oversize) rejects the whole request; a bad EVENT rejects only that
 * event (it lands in rejectedRoundIds, is NOT stored, and the rest proceed).
 * Duplicates are success. The response carries the authoritative post-replay
 * snapshot so a divergent client heals immediately.
 */
export async function handleUploadRounds(
  store: EventStore,
  body: unknown,
  now: number,
): Promise<HandlerResult<SyncUploadResponse>> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: { status: 400, errors: ['body: expected object'] } };
  }
  const b = body as Record<string, unknown>;
  const installId = b['installId'];
  if (typeof installId !== 'string' || installId.length === 0) {
    return { ok: false, error: { status: 400, errors: ['installId: required'] } };
  }
  const rawEvents = b['events'];
  if (!Array.isArray(rawEvents)) {
    return { ok: false, error: { status: 400, errors: ['events: expected array'] } };
  }
  if (rawEvents.length > MAX_BATCH_SIZE) {
    return {
      ok: false,
      error: { status: 400, errors: [`batch too large (${rawEvents.length} > ${MAX_BATCH_SIZE})`] },
    };
  }

  const valid: RoundEvent[] = [];
  const rejectedRoundIds: string[] = [];
  for (const raw of rawEvents) {
    const checked = validateRoundEvent(raw);
    // Config-versioned replay (F1): a POINTS-ERA event (major ≥ 2 — one that WOULD be
    // scored) stamped with a config we can't resolve is QUARANTINED at the boundary —
    // never stored. Storing it would poison every future replay of this install
    // (computeSnapshot would throw on the unknown stamp). Elo-era (1.x) events are a
    // different case: they are stored on purpose (they feed calibration) and simply
    // filtered out of scoring, so they are NOT quarantined. The client keeps a
    // quarantined event locally and surfaces a diagnostic — "fail loudly, never guess".
    const scorable = checked.ok && isPointsEraConfig(checked.value.engineConfigVersion);
    const resolvable = checked.ok && (!scorable || configForVersion(checked.value.engineConfigVersion) !== undefined);
    // An event claiming another install is rejected, not silently re-attributed.
    if (checked.ok && checked.value.installId === installId && resolvable) {
      valid.push(checked.value);
    } else {
      const rid =
        typeof raw === 'object' && raw !== null && typeof (raw as Record<string, unknown>)['roundId'] === 'string'
          ? ((raw as Record<string, unknown>)['roundId'] as string)
          : '(unidentifiable)';
      rejectedRoundIds.push(rid);
    }
  }

  const outcome = await store.insertEvents(valid, now);
  const snapshot = computeSnapshot(installId, await store.eventsForInstall(installId), now);

  return {
    ok: true,
    body: {
      acceptedRoundIds: outcome.inserted,
      duplicateRoundIds: outcome.duplicates,
      rejectedRoundIds,
      snapshot,
    },
  };
}

/**
 * GET /v1/me — the authoritative snapshot (T13). `includeEvents` returns the whole
 * stored log for the reinstall-restore path. An unknown installId is a valid empty
 * account (fresh install syncing down before ever uploading) — zeroes, not a 404.
 */
export async function handleGetMe(
  store: EventStore,
  installId: string,
  includeEvents: boolean,
  now: number,
): Promise<HandlerResult<SyncDownResponse>> {
  if (installId.length === 0) {
    return { ok: false, error: { status: 400, errors: ['installId required'] } };
  }
  const events = await store.eventsForInstall(installId);
  const snapshot = computeSnapshot(installId, events, now);
  return {
    ok: true,
    body: includeEvents ? { snapshot, events } : { snapshot },
  };
}
