# @sabd/wordbank-publish — CDN word-bank publisher (Phase-3 T8/T9)

Cuts the merged word bank into **versioned static slices** — one per `(topicId × tier)`,
18 total — plus a `manifest.json`, ready to upload to any static bucket + CDN. Semantics
live in `packages/contracts/VERSIONING.md`; shapes in `@sabd/contracts`.

## Publish

```sh
pnpm --filter @sabd/wordbank-publish publish-slices            # → dist/
pnpm --filter @sabd/wordbank-publish publish-slices -- --version=1.1.0
```

Reads `packages/wordbank/data/sabd-wordbank.json` (the content pipeline's output).
Re-running against unchanged words writes nothing (per-slice `sliceVersion` bumps only
on content change) — publishing is idempotent, published files are immutable.

`dist/` is gitignored: it's the upload artifact, not source. The previous `manifest.json`
in `dist/` is the versioning baseline — keep it between publishes (or download the live
one from the CDN before cutting a new version).

## Hosting (T9) — decision pending owner account setup

**Recommendation: Cloudflare R2 + Cloudflare CDN** (free egress; the whole bank is
~300 KB across 18 slices, so cost is effectively **$0/month** at any realistic scale —
R2 free tier covers 10 GB storage + 10M reads/month).

Upload = sync the `dist/` dir:

```sh
# rclone (any S3-compatible bucket)
rclone sync dist/ r2:sabd-wordbank/ --checksum

# or wrangler (Cloudflare)
npx wrangler r2 object put ...
```

Cache headers (VERSIONING.md §4):
- `manifest.json` → `Cache-Control: public, max-age=300` (5 min)
- `slices/**` → `Cache-Control: public, max-age=31536000, immutable`

Any static host works (R2, S3+CloudFront, Bunny, GitHub Pages at a pinch) — the client
only needs the manifest at a stable HTTPS URL and relative slice paths next to it.

## Cost note (T22 input)

Static files + CDN cache: pennies to zero per month. No compute, no database, no
always-on anything. Publishing is a local CLI run (seconds); the weekly correction cron
(T16) re-runs it after re-rating.
