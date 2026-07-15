# @sabd/ingest — ingestion + sync service (Phase-3 T11–T13)

Thin serverless endpoints over an append-only event store. **Scores are never
stored** — every response recomputes them by replaying the install's events through
the same `@sabd/elo` the client runs. Nothing numeric is trusted from a client
(the anti-cheat foundation).

## Endpoints

| | |
|---|---|
| `POST /v1/rounds` | Batch upload of `RoundEvent`s (≤ 500), **idempotent on roundId**. Bad envelope → 400; bad event → rejected by id, rest proceed; duplicate → success. Response: accepted/duplicate/rejected ids + the authoritative `PlayerSnapshot`. |
| `GET /v1/me` | Authoritative snapshot by `X-Install-Id` header (or `?installId=`). Unknown install = valid empty account. `?includeEvents=1` returns the full stored log — the reinstall-restore path (the client re-appends it locally so every replay, including seenIds, restores from truth). |

## Semantics worth knowing

- **Replay order**: `(playedAt, roundId)` — deterministic across out-of-order and
  partial batch uploads.
- **Epoch**: only points-era events (`engineConfigVersion` major ≥ 2) fold into
  scores. Elo-era events are stored (calibration data, T15) but never scored.
- **Global ≠ sum of categories** — independent replays with independent streaks
  (locked owner decision).
- No auth: the anonymous `installId` is the identity (Phase 3). Account claiming is
  Phase 6 (`user_id` column reserved in the on-device schema).

## Architecture

`handlers.ts` (pure, node-tested) → `store.ts` (async `EventStore` interface;
`MemoryEventStore` for tests) → `worker.ts` (Cloudflare Worker adapter + D1 store,
parse/route/serialize only). The full client flow is e2e-tested in
`apps/mobile/test/syncClient.test.ts` — real handlers, real client storage, fake fetch.

## Deploy (owner account required)

```sh
npx wrangler d1 create sabd-ingest        # paste database_id into wrangler.toml
npx wrangler d1 execute sabd-ingest --file=schema.sql --remote
npx wrangler deploy
```

Then set `INGEST_BASE_URL` in `apps/mobile/src/sync/config.ts` and ship via
`eas update`.

## Cost note (T22 input)

Workers free tier: 100k requests/day. A playtest of 50 actives syncing a few times
daily is ~hundreds of requests/day; D1 free tier (5 GB) holds years of round events
(~300 bytes each). **$0/month** at any realistic Phase-3 scale.
