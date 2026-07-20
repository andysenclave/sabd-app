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
| `POST /v1/account/code` | Mint a single-use transfer code for the calling install (P4-T9). Creates the install's account lazily on first request. Response: `{ accountId, code, expiresAt }` (TTL 15 min). |
| `POST /v1/account/claim` | Redeem a code from another install (`{ installId, code }`). On success the install joins the account → `{ ok: true, accountId, snapshot, events }`. On failure `{ ok: false, reason }` (a 200, not a transport error). |
| `DELETE /v1/account` | Erase the calling install's account: all bound installs' events, bindings, and codes (F14). |

## Accounts & transfer-code claim (P4-T9)

Anonymous play is the default identity (the `installId`). An **account** owns the
merged history of one-or-more installs; a device opts in by minting a **transfer
code** that another device claims. No third-party provider — the code is the bearer
credential. When an install is bound, `GET /v1/me` and `/v1/rounds` snapshot the
**merged account** replay; unbound installs snapshot their own events (zero friction).

- **One install claims once** (F12): an install already bound to account A that tries
  to claim account B's code is rejected with `reason: 'already_claimed'` — the client
  shows a designed state ("this device already has a history; keep playing here or
  contact support"). Never a silent rebind.
- **Codes are single-use + short-lived**: consumed atomically on first redeem
  (`UPDATE … WHERE used_at IS NULL`), so a lost race reads as spent (`unknown_code`).
- **Epoch travels with history** (F2): the server excludes Elo-era (1.x) events
  uniformly, so merging installs needs no per-install epoch pointer.
- **Sign-out** (F13): the device starts a fresh guest (new installId); the claimed
  history stays server-side, reachable again via a new code.
- **Fresh-device restore is exact**; a device with pre-existing local rounds joins the
  account server-side but its LOCAL replay is insert-ordered (see `syncClient.ts`).

### Privacy note (F14)

`DELETE /v1/account` erases every event for the account's installs. Published
word-calibration aggregates are **derived snapshots** taken at run time — deletion
affects only FUTURE calibration runs, never corrupts an already-published aggregate.

## Semantics worth knowing

- **Replay order**: `(playedAt, roundId)` — deterministic across out-of-order and
  partial batch uploads.
- **Epoch**: only points-era events (`engineConfigVersion` major ≥ 2) fold into
  scores. Elo-era events are stored (calibration data, T15) but never scored.
- **Global ≠ sum of categories** — independent replays with independent streaks
  (locked owner decision).
- Anonymous `installId` is the default identity; a bound install additionally carries
  an `accountId` (P4-T9, transfer-code claim — see above).

## Architecture

`handlers.ts` (pure, node-tested) → `store.ts` (async `EventStore` interface;
`MemoryEventStore` for tests) → `worker.ts` (Cloudflare Worker adapter + D1 store,
parse/route/serialize only). The full client flow is e2e-tested in
`apps/mobile/test/syncClient.test.ts` — real handlers, real client storage, fake fetch.

## Deploy (owner account required)

```sh
npx wrangler d1 create sabd-ingest        # paste database_id into wrangler.toml
npx wrangler d1 execute sabd-ingest --file=schema.sql --remote   # round_event + install_account + claim_code
npx wrangler deploy
```

Then set `INGEST_BASE_URL` in `apps/mobile/src/sync/config.ts` and ship via
`eas update`.

## Cost note (T22 input)

Workers free tier: 100k requests/day. A playtest of 50 actives syncing a few times
daily is ~hundreds of requests/day; D1 free tier (5 GB) holds years of round events
(~300 bytes each). **$0/month** at any realistic Phase-3 scale.
