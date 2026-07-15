/**
 * Ingest/sync config (Phase-3 T14).
 *
 * `INGEST_BASE_URL = null` disables event upload + sync-down entirely — the app
 * behaves exactly as Phase 2 (events queue locally with synced_at NULL). Set it when
 * the T11 Worker deploys (JS-only change → ships via `eas update`).
 * Endpoints: POST <base>/v1/rounds, GET <base>/v1/me.
 */
export const INGEST_BASE_URL: string | null = null;

/** Max events per upload call (mirrors the server's MAX_BATCH_SIZE — do not raise). */
export const UPLOAD_BATCH_SIZE = 500;
