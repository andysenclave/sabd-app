# Sabd — Word-bank versioning & slice contract (T2)

> The written spec both the CDN publisher (`services/wordbank-publish`, T8) and the client
> slice-sync (T10) obey. Shapes live in `src/types.ts` (`WordSliceManifest`, `WordSliceRef`,
> `WordSlice`); this file defines their *semantics*. Changing anything here is a
> contract-level decision — stop and surface, never improvise.

## 1. `wordBankVersion` — the bank publish version

- **Semver string** (`MAJOR.MINOR.PATCH`), stamped on every manifest, every slice, and —
  via the round recorder — on every `RoundEvent` (`wordBankVersion`: which bank served
  this word).
- **PATCH** — difficulty re-calibrations only (the weekly correction cron, T16). No words
  added/removed, no tier-band redefinition. The common case.
- **MINOR** — words added or removed, or a word's topic re-categorized (human-approved,
  T17).
- **MAJOR** — a change that breaks how a client interprets the bank (tier-band boundary
  change, `WordEntry` shape change). Requires a client update; the manifest's
  `schemaVersion` likely bumps with it.
- Versions only move forward. A published version is **immutable** — corrections publish a
  new version, they never edit an old one.

## 2. The slice unit: one slice per (topic × tier)

**Decision (supersedes the Elo-era "overlapping rating bands" prose in the architect doc):**
slices are cut per `(topicId, tier)` — 6 topics × 3 tiers = 18 slices per bank version.

Why: selection is tier-driven (`tierForScore` + nearest-tier spill, `@sabd/elo`). A player's
download need is "my earned tier in this topic, plus its spill neighbours" — which is just
*tiers*. Overlap coverage comes from holding a topic's neighbouring tier slices, not from
overlapping difficulty cuts. Tier boundaries are the engine's `tierBands`
(`lowMax: 1200`, `midMax: 1600` — `packages/elo/src/config.ts`); the publisher slices by the
word's `tier` field, which the content pipeline derives from the same bands.

## 3. `sliceVersion` — per-slice content version

- A **monotonic integer per (topicId, tier)**, independent of `wordBankVersion`.
- Bumps **only when that slice's content changes**. A weekly correction that touches 12
  Gaming words bumps `gaming/low` (say v4 → v5) and leaves the other 17 slices' versions
  unchanged — so clients re-download only what actually changed.
- `sha256` in the ref is the integrity check; a client verifies it before swapping.

## 4. URLs & immutability (content-addressed)

```
<base>/manifest.json                          ← stable URL, short cache (e.g. 5 min)
<base>/slices/<topicId>/<tier>/v<sliceVersion>.json   ← immutable, cache forever
```

- `WordSliceRef.url` is **relative to the manifest's URL**, so the bank can move hosts
  without republishing content.
- Slice files are immutable: a given `v<N>.json` never changes. CDN caches them forever
  (`Cache-Control: public, max-age=31536000, immutable`). Only `manifest.json` is
  re-fetched to learn about new versions.

## 5. Client polling & swap rules (T10 obeys these)

1. Poll `manifest.json` on app open when online, or when a category runs low. Never on a
   timer during play.
2. For each slice the player needs (current earned tier + spill neighbours of played
   topics), compare the manifest's `sliceVersion` to the locally-held one; download only
   the changed ones.
3. Verify `sha256` and `validateWordSlice()` before accepting. On any mismatch: **keep the
   old slice**, retry later.
4. **Version swap is atomic** per slice: write to a temp location, verify, then swap. A
   half-written slice must never be readable by selection.
5. Offline or fetch fails → play the cached (or bundled) bank. The bundled bank in
   `@sabd/wordbank` remains the first-run cache and airplane-mode fallback — the network
   is never a hard dependency for solo play.

## 6. Scoring coupling (the T16 freeze rule — restated here because slices carry it)

A word's `difficulty` (hence `tier`, hence its base pay) can drift across bank versions.
Scoring always uses **`wordRatingAtPlay`** from the event — the difficulty at the moment
the round was played — never today's re-calibrated value. Replays are therefore stable
across bank versions; calibration affects only *future* selection and *future* rounds'
pay. Any design that needs the event to know its *tier* directly (decoupling tier from
difficulty) is a `RoundEvent` schema bump — stop and surface.

## 7. Manifest `schemaVersion`

`WORD_SLICE_SCHEMA_VERSION` (currently 1) stamps both the manifest and every slice file.
A client refuses (keeps its cache and logs) any file with a schemaVersion newer than it
understands — old clients keep playing their cached bank until they update.
