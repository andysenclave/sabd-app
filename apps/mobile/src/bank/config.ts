/**
 * Word-bank sync config (Phase-3 T10).
 *
 * `WORDBANK_MANIFEST_URL = null` disables online slice sync entirely — the app plays
 * the bundled bank exactly as in Phase 2. Set it when the T9 bucket/CDN goes live
 * (JS-only change → ships via `eas update`). Slice urls resolve relative to this.
 */
export const WORDBANK_MANIFEST_URL: string | null = null;

/** Directory (relative to the app's document dir) holding downloaded slice files. */
export const BANK_DIR = 'wordbank';
