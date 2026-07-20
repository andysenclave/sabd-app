/**
 * HTTP-agnostic handlers (T11/T13) — pure request-shape → response-shape functions
 * over an injected EventStore. The Worker adapter (worker.ts) only parses/serializes.
 *
 * No auth (Phase 3): the anonymous installId is the identity. Nothing is trusted
 * beyond "these events happened" — every numeric truth is recomputed by replay.
 */

import type {
  ClaimCodeResponse,
  ClaimResponse,
  PlayerSnapshot,
  RoundEvent,
  SyncDownResponse,
  SyncUploadResponse,
} from '@sabd/contracts';
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

/** How long a transfer code stays redeemable. Short — it's a device-to-device handoff. */
export const CLAIM_CODE_TTL_MS = 15 * 60 * 1000;

/**
 * The authoritative snapshot for an install, ACCOUNT-AWARE: when the install is bound
 * to an account (P4-T9), the snapshot is the merged replay across every install in the
 * account; otherwise it's the install's own events. Returns the events folded, so the
 * restore path can adopt exactly what was scored.
 */
async function resolveSnapshot(
  store: EventStore,
  installId: string,
  now: number,
): Promise<{ snapshot: PlayerSnapshot; events: RoundEvent[]; accountId: string | null }> {
  const accountId = await store.accountForInstall(installId);
  const events = accountId ? await store.eventsForAccount(accountId) : await store.eventsForInstall(installId);
  return { snapshot: computeSnapshot(installId, events, now, accountId), events, accountId };
}

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
  const { snapshot } = await resolveSnapshot(store, installId, now);

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
  const { snapshot, events } = await resolveSnapshot(store, installId, now);
  return {
    ok: true,
    body: includeEvents ? { snapshot, events } : { snapshot },
  };
}

/**
 * POST /v1/account/code — the calling install mints a single-use transfer code (P4-T9).
 * The install's account is created lazily on first request (binding this install), so
 * "enable sync" and "get a code" are one step. `mkAccountId`/`mkCode` are injected
 * (crypto in the worker, deterministic in tests); `now` sets the expiry.
 */
export async function handleCreateCode(
  store: EventStore,
  installId: string,
  now: number,
  mkAccountId: () => string,
  mkCode: () => string,
): Promise<HandlerResult<ClaimCodeResponse>> {
  if (installId.length === 0) {
    return { ok: false, error: { status: 400, errors: ['installId required'] } };
  }
  const { accountId } = await store.ensureAccount(installId, mkAccountId);
  const code = mkCode();
  const expiresAt = now + CLAIM_CODE_TTL_MS;
  await store.putClaimCode(code, accountId, expiresAt);
  return { ok: true, body: { accountId, code, expiresAt } };
}

/**
 * POST /v1/account/claim — redeem a transfer code on another install. On success the
 * install joins the account and the response carries the merged snapshot + full log
 * (the client adopts it via the reinstall-restore path). On failure `reason` names a
 * designed state; `already_claimed` (F12) means this install already owns a history.
 */
export async function handleClaim(
  store: EventStore,
  body: unknown,
  now: number,
): Promise<HandlerResult<ClaimResponse>> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: { status: 400, errors: ['body: expected object'] } };
  }
  const b = body as Record<string, unknown>;
  const installId = b['installId'];
  const code = b['code'];
  if (typeof installId !== 'string' || installId.length === 0) {
    return { ok: false, error: { status: 400, errors: ['installId: required'] } };
  }
  if (typeof code !== 'string' || code.length === 0) {
    return { ok: false, error: { status: 400, errors: ['code: required'] } };
  }

  const outcome = await store.redeemClaimCode(code, installId, now);
  if (outcome.status !== 'ok') {
    // A rejection is a valid 200 with ok:false — the client shows the designed state,
    // it is not a transport error to retry.
    return { ok: true, body: { ok: false, accountId: outcome.accountId, reason: outcome.status } };
  }

  const { snapshot, events } = await resolveSnapshot(store, installId, now);
  return { ok: true, body: { ok: true, accountId: outcome.accountId, snapshot, events } };
}

/**
 * DELETE /v1/account — erase the calling install's account and every install's events
 * in it (F14). Published word-calibration aggregates are derived snapshots; deletion
 * affects only FUTURE calibration runs (documented in the privacy note). An unbound
 * install is a no-op success (nothing to erase).
 */
export async function handleDeleteAccount(
  store: EventStore,
  installId: string,
): Promise<HandlerResult<{ deletedEvents: number; deletedInstalls: number }>> {
  if (installId.length === 0) {
    return { ok: false, error: { status: 400, errors: ['installId required'] } };
  }
  const accountId = await store.accountForInstall(installId);
  if (!accountId) return { ok: true, body: { deletedEvents: 0, deletedInstalls: 0 } };
  const result = await store.deleteAccount(accountId);
  return { ok: true, body: result };
}
