// dict.js — wordlist lookup with optional, cached dictionaryapi.dev fallback.
//
// Primary check: data/words.txt (from the npm `word-list` package, SCOWL-derived).
// Fallback: free Dictionary API (https://dictionaryapi.dev) for wordlist misses.
// The fallback is strictly optional: any network failure/timeouts degrade to
// "unknown" so the pipeline works fully offline. API results are cached in
// data/.dict-cache.json so a word is never fetched twice.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORDLIST_PATH = path.join(ROOT, 'data', 'words.txt');
const CACHE_PATH = path.join(ROOT, 'data', '.dict-cache.json');
const API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const API_TIMEOUT_MS = 4000;

let wordSet = null;

export function loadWordlist() {
  if (wordSet) return wordSet;
  const raw = fs.readFileSync(WORDLIST_PATH, 'utf8');
  wordSet = new Set(raw.split('\n').map((w) => w.trim().toLowerCase()).filter(Boolean));
  return wordSet;
}

/** True if the word is in the local wordlist. */
export function inWordlist(word) {
  return loadWordlist().has(String(word).toLowerCase());
}

// ---- API fallback with cache -------------------------------------------

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n');
}

/**
 * Ask dictionaryapi.dev whether a word exists.
 * Returns 'found' | 'notfound' | 'unknown' (unknown = offline/error; never cached).
 */
export async function apiLookup(word) {
  const key = String(word).toLowerCase();
  const cache = readCache();
  if (key in cache) return cache[key] ? 'found' : 'notfound';

  let result = 'unknown';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
    const res = await fetch(API_URL + encodeURIComponent(key), { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) result = 'found';
    else if (res.status === 404) result = 'notfound';
    // other statuses (429, 5xx) stay 'unknown' — do not cache
  } catch {
    result = 'unknown'; // offline / DNS / timeout — degrade gracefully
  }

  if (result !== 'unknown') {
    cache[key] = result === 'found';
    writeCache(cache);
  }
  return result;
}

/**
 * Full lookup used by the validator.
 * @param {string} word
 * @param {{useApi?: boolean}} opts
 * @returns {Promise<{inWordlist: boolean, api: 'found'|'notfound'|'unknown'|'skipped'}>}
 */
export async function lookupWord(word, opts = {}) {
  const { useApi = true } = opts;
  const local = inWordlist(word);
  if (local) return { inWordlist: true, api: 'skipped' };
  if (!useApi) return { inWordlist: false, api: 'skipped' };
  return { inWordlist: false, api: await apiLookup(word) };
}
