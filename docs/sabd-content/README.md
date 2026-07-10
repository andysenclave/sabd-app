# Sabd — Content Pipeline

Generates, validates, and merges the word bank for **Sabd** (शब्द — "word"), a
competitive, Elo-rated word-guessing game. This repo is the content pipeline only —
no game UI, no Elo engine, no matchmaking.

## Layout

```
data/raw/       LLM-generated batches land here (e.g. GAM-batch1.json)
data/clean/     validator buckets, per-topic files, final sabd-wordbank.json
data/reports/   machine-readable validation reports
data/words.txt  English wordlist (primary real-word check)
src/validate.js batch validator (all §6 rules)
src/merge.js    merges passed batches into the final bank
src/dict.js     wordlist lookup + cached dictionaryapi.dev fallback
```

## Wordlist source

`data/words.txt` comes from the npm [`word-list`](https://www.npmjs.com/package/word-list)
package (v4, MIT license, ~274k English words, derived from SCOWL). To refresh it:

```sh
npm install
node -e "import('word-list').then(m => require('fs').copyFileSync(m.default, 'data/words.txt'))"
```

## Workflow

1. **Generate a batch.** Feed the §5 generation prompt from
   `../sabd-docs/sabd-content-pipeline.md` to an LLM, one topic at a time,
   substituting `{TOPIC}` and `{PREFIX}` (Gaming/GAM, Space & Sci-Fi/SPC, Music/MUS,
   Internet & Tech Culture/NET, Food & Drink/FUD, World & Places/WLD). Each run yields
   a JSON array of 60 entries: 24 low / 24 mid / 12 high.

2. **Drop the raw batch** into `data/raw/`, named `<PREFIX>-batchN.json`
   (e.g. `data/raw/GAM-batch1.json`).

3. **Validate:**

   ```sh
   node src/validate.js data/raw/GAM-batch1.json
   ```

   - Runs every hard rule (word format, length, tier/difficulty bands, hint
     integrity, description leaks, id/word duplicates, real-word check) plus soft
     description-quality heuristics.
   - Writes `data/reports/GAM-batch1-report.json` and splits entries into
     `data/clean/GAM-batch1-passed.json`, `-rejected.json`, `-review.json`.
   - Exits non-zero if anything was rejected.
   - Words missing from the wordlist are cross-checked against
     [dictionaryapi.dev](https://dictionaryapi.dev) (results cached in
     `data/.dict-cache.json`). Legitimate topic jargon that both sources miss goes to
     the **review** bucket, never to `rejected`. Offline? The API is skipped
     gracefully; pass `--no-api` to skip it explicitly.
   - `--max-print N` controls how many failures per rule are printed (default 5).

4. **Review.** Open `data/clean/<name>-review.json` and the report. For each entry:
   - Real topic jargon with a good description → move the entry into the
     corresponding `-passed.json` file.
   - Weak/definitional description → rewrite the description, then move to passed.
   - Junk → delete.
   Rejected entries should be fixed in the raw batch and re-validated (the clean
   bucket files are overwritten on every run).

5. **Merge:**

   ```sh
   node src/merge.js
   ```

   Combines all `data/clean/*-passed.json` files, dedupes across batches,
   re-sequences ids per topic prefix, and writes:
   - `data/clean/<topic>.json` — one file per topic (e.g. `gaming.json`)
   - `data/clean/sabd-wordbank.json` — **the final word bank**
   - `data/clean/stats.json` — per-topic counts, tier/length/difficulty histograms

## Targets

~150–200 words per topic (3 batches × 60), 6 topics ⇒ ~1,050 entries.
Tier bands: low 800–1200, mid 1201–1600, high 1601–2200; 24/24/12 per batch.
