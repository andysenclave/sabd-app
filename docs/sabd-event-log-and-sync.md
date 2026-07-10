# Sabd — Event Log, Local Rating & Future Sync

> **Project: Sabd** (शब्द — "word"). Competitive, Elo-rated word-guessing game.
>
> **What this doc owns:** how rounds are recorded on-device, how the player's rating is stored
> and verified, and how all of it syncs to a backend **later** without a migration.
>
> **What it does not own:** the Elo math (`sabd-elo-engine.md`), the word bank
> (`sabd-content-pipeline.md`), the UI (`sabd-mobile-app-spec.md`).
>
> **Phase 1 ships with NO backend.** This doc exists so that fact costs nothing later.

---

## 0. The one idea

**Rounds are an append-only event log. The rating is a derived value.**

Not: *"store rating = 1340."*
But: *"store every round; 1340 falls out of replaying them."*

Everything below follows from that. It is the decision that makes future sync a **replay**
instead of a **migration**.

### Why it matters

| Because the log is the truth… | You get… |
|---|---|
| The server can recompute the rating from raw events | **Anti-cheat foundation, free.** It never trusts a client-supplied number. |
| Word-rating correction is an aggregation over the same events | **No second pipeline.** |
| Uploads dedupe on `roundId` | **Idempotent sync.** Upload twice, same result. |
| The Elo engine already takes `RoundResult` → `RatingUpdate` | **The engine does not change. At all.** |

---

## 1. Decisions (locked)

| Decision | Choice |
|---|---|
| Storage | **expo-sqlite** — real queries; aggregation for word correction needs them |
| Rating storage | **Hybrid** — cached for reads, verified against the log |
| Identity | **`installId`** — random UUID, generated on first launch |
| Consent | **Contextual** — only when data leaves the device |
| Logging scope | **Minimal** — exactly what Elo + word-correction consume. Nothing else. |
| Version stamping | `wordBankVersion` **and** `engineConfigVersion` on every event |
| Onboarding | Explainer before first round, skippable *(see §9 note)* |

---

## 2. Identity — `installId`, not a device ID

```ts
// On first launch, once, forever:
const installId = randomUUID();   // expo-crypto
```

**Store it in SQLite. Never call it `deviceId`.**

| Do | Don't |
|---|---|
| Random UUID you generate | Device identifier |
| Meaningless outside Sabd | IDFA / AAID / advertising ID |
| Dies on uninstall | Stable across reinstalls or across apps |
| Asks nothing of the user | Triggers store tracking disclosures |

A real device ID is stable across apps, which makes it a **tracking identifier** and drags you
into IDFA/AAID territory on both stores. A random UUID gives you identical functionality with
none of the liability. **The name shapes how people treat it** — call it `installId`.

At sign-up (much later), the server claims the `installId` into a `userId`. Every event already
carries `installId`; the server stamps `userId` on top. **Nothing on the client is rewritten.**

---

## 3. What gets logged — and what does not

**"Minimal" is not a compromise. Minimal *is* everything the consumers need.**

Two systems consume this data. That's all. So this is the complete list:

| Consumer | Needs |
|---|---|
| Elo replay | `roundId`, `wordId`, `wordRatingAtPlay`, `solved`, `timeUsedSec`, `hintsUsed`, `playedAt` |
| Word-rating correction | The same fields, aggregated across players |

### Explicitly NOT logged
Keystroke timings · every wrong guess · session duration · screen dimensions · device model ·
OS version · IP · locale · anything about *how* they typed.

**Nothing consumes these.** Collecting them costs nothing today and becomes a liability the day
a `userId` is attached — at which point you hold a behavioural profile you never asked
permission for, can't lawfully use, and must delete. Do not collect exhaust.

---

## 4. Schema

```sql
-- One row. Ever.
CREATE TABLE player (
  install_id            TEXT PRIMARY KEY,
  created_at            INTEGER NOT NULL,      -- epoch ms
  cached_rating         INTEGER NOT NULL,      -- derived; see §5
  cached_games_played   INTEGER NOT NULL,
  cached_after_round_id TEXT,                  -- snapshot pointer; NULL before first round
  user_id               TEXT                   -- NULL until sign-up. Reserved.
);

-- Append-only. Never UPDATE. Never DELETE.
CREATE TABLE round_event (
  round_id              TEXT PRIMARY KEY,      -- client-generated UUID → idempotent upload
  schema_version        INTEGER NOT NULL,      -- bump when this shape changes
  install_id            TEXT NOT NULL,
  played_at             INTEGER NOT NULL,      -- epoch ms, client clock

  word_id               TEXT NOT NULL,         -- e.g. "GAM-0142"
  word_rating_at_play   INTEGER NOT NULL,      -- see §4.1 — critical
  word_bank_version     TEXT NOT NULL,         -- which bank served this word
  topic                 TEXT NOT NULL,

  solved                INTEGER NOT NULL,      -- 0 | 1
  time_limit_sec        REAL    NOT NULL,
  time_used_sec         REAL    NOT NULL,
  hints_used            TEXT    NOT NULL,      -- JSON: ["position"] | ["position","letters"] | []
  mode                  TEXT    NOT NULL,      -- "solo" (1v1 later)

  player_rating_before  INTEGER NOT NULL,      -- what they were rated facing this word
  engine_config_version TEXT    NOT NULL,      -- see §4.2 — critical

  synced_at             INTEGER                -- NULL = never uploaded
);

CREATE INDEX idx_round_played  ON round_event(played_at);
CREATE INDEX idx_round_unsynced ON round_event(synced_at) WHERE synced_at IS NULL;
CREATE INDEX idx_round_word    ON round_event(word_id);
```

### 4.1 Why `word_rating_at_play` and not just `word_id`

Word ratings **will drift** once correction begins. If you store only `word_id`, you can never
faithfully recompute a player's historical rating — you'd replay against *today's* ratings, not
the ones they actually faced. The number they beat is part of the event.

### 4.2 Why `engine_config_version`

Hint penalties and K-factors are tunable and **will change**. A round played under
`hintPenalty: 0.20` cannot be honestly replayed under `0.15`. Stamp the config version; replay
resolves it. Without this, every tuning change silently corrupts your history.

### 4.3 Why `player_rating_before`

Redundant with replay, but it makes each event **self-describing** and lets you spot drift
without a full replay. Cheap. Keep it.

---

## 5. The hybrid rating

The **cache** is what the UI reads. The **log** is the truth.

```
read rating          → player.cached_rating              (instant)
after each round     → engine.applyResult() → write cache + append event  (one transaction)
on app launch        → verifyRating()                    (cheap, see below)
```

### `verifyRating()`

Replay is `O(rounds)` and would crawl at 5,000 rounds. So **snapshot**:

- `cached_after_round_id` marks the last round folded into `cached_rating`.
- On launch, replay **only rounds after that pointer**. Usually zero.
- If the recomputed rating ≠ `cached_rating`, **the log wins.** Overwrite the cache. Log a
  warning. This is the self-healing property.
- Periodically (or on a debug action), do a **full replay from 1200** to catch deep drift.

```ts
function verifyRating(db): void {
  const { cached_rating, cached_after_round_id } = getPlayer(db);
  const tail = getRoundsAfter(db, cached_after_round_id);   // usually []
  if (tail.length === 0) return;
  const recomputed = tail.reduce(replayOne, cached_rating);
  if (recomputed !== cached_rating) reconcile(db, recomputed);
}
```

### The write must be atomic

Appending the event and updating the cache happen in **one SQLite transaction**. If the app dies
mid-round, either both landed or neither did. A crash must never produce a rating the log can't
explain.

**Seed:** new players start at `rating = 1200`, `gamesPlayed = 0` (provisional K — see the Elo
doc).

---

## 6. The Elo engine does not change

It already has the right shape. `RoundResult` in, `RatingUpdate` out, pure, deterministic.

```ts
// The log is just a list of RoundResults.
const update = applyResult(playerState, roundResult);   // @sabd/elo — untouched
```

**Replay is `reduce` over the log.** The server will run **the identical function** on the
identical events and get the identical number. That property is the whole point — and it's the
reason the engine was specced as a pure module with no I/O.

Do not scatter rating logic anywhere else. `onRoundEnd(result)` stays a single seam.

---

## 7. Sync — designed now, built later

**Phase 1 ships with none of this.** It is specified so that adding it is a Tuesday.

### 7.1 The contract

```
POST /v1/sync/rounds
  headers: X-Install-Id: <uuid>
  body:    { events: RoundEvent[] }        // only where synced_at IS NULL

  server:  dedupe on round_id (idempotent)
           replay through the SAME engine
           returns { serverRating, acceptedRoundIds, rejectedRoundIds }
```

- **The server never trusts `cached_rating`.** It replays events and computes its own. That is
  the anti-cheat foundation, and you get it for free by having built the log.
- **Idempotent by `round_id`.** Upload the same batch twice → identical result.
- On success, stamp `synced_at` locally. Never delete the event.

### 7.2 At sign-up — claim, don't merge

```
POST /v1/account/claim
  body: { installId, userId }
  → server sets user_id on all events for that installId
```

**Ask first.** *"Attach your 47 games and your 1340 rating to this account?"* — the user's own
data, but the claim is a data-scope change and deserves a tap.

**One installId claims exactly once.** Two installs both claiming one user is a merge problem —
out of scope for Phase 1. Reject the second and say so.

### 7.3 Word-rating correction

Also a replay, aggregated across players. Server-side, batch:

```sql
SELECT word_id,
       COUNT(*)                                    AS attempts,
       AVG(solved)                                 AS solve_rate,
       AVG(time_used_sec / time_limit_sec)         AS avg_clock_used,
       AVG(json_array_length(hints_used))          AS avg_hints,
       AVG(player_rating_before)                   AS avg_player_rating
FROM round_event
GROUP BY word_id
HAVING attempts >= 30;                             -- below this, it's noise
```

Then nudge each word's `difficulty` via `updateWordRating()` (K=16, already in the Elo module,
flagged Phase-2-activatable). Ship the corrected bank as a **new `wordBankVersion`** via
`eas update` — no rebuild.

**Do not activate this below ~30 attempts per word.** With five testers you'd be measuring five
people's vocabularies, not the word's difficulty. Correcting on noise is worse than not
correcting.

---

## 8. Consent & the export button

**Nothing leaves the device in Phase 1.** Therefore **no startup consent wall.**

Storing a user's own game history locally, for their own benefit, does not require a consent
gate — a notes app doesn't ask permission to save notes. **Consent is required when data
moves.** A blanket startup consent for data that never moves is theatre, and it trains people
to dismiss consent screens without reading — which is precisely what you don't want when the
real one arrives.

### What exists in Phase 1
- **Settings → Privacy:** one honest paragraph. *"Your games are stored on this device. Nothing
  is sent anywhere."*
- **Settings → Send my data:** the 5-friend feedback loop.

### The export button
```
tap → show EXACTLY what will be sent (the rounds, the count, the fields — plainly)
    → "This helps me tune word difficulty. Nothing else is included."
    → [Cancel]  [Send]
    → share sheet → JSON file → WhatsApp
```

**The screen must show the actual data**, not a description of it. Contextual, specific,
inspectable. This is what real consent looks like.

### Manual correction loop (no backend, works today)
Five friends tap **Send my data** → five JSON files arrive → you run a script that aggregates
them → adjust word ratings by hand → ship a new bank via `eas update`.

**That is a functioning word-rating feedback loop with no database, no auth, no deployment.** It
does not scale past ~50 people. You do not need it to.

### Consent is a scope, not a gate
You get consent **for a stated purpose**. Using the data outside that purpose isn't covered by
the earlier tap. Sabd's need is tiny and obviously benign — *rounds you played, to compute your
rating.* Say exactly that. **A short honest screen beats a long defensive one.**

---

## 9. Build tasks

```
src/storage/
  db.ts            # open expo-sqlite, run migrations
  migrations/      # 001_init.sql — the §4 schema. Numbered. Forward-only.
  player.ts        # getPlayer, seedPlayer, updateCache
  events.ts        # appendRound (TRANSACTION), getRoundsAfter, getUnsynced, markSynced
  replay.ts        # verifyRating, fullReplay — both call @sabd/elo, never reimplement it
  export.ts        # serialize unsynced rounds → JSON for the share sheet
  identity.ts      # getOrCreateInstallId
```

1. `installId` on first launch (expo-crypto, stored in SQLite).
2. Migration runner. Numbered, forward-only. You will need it.
3. `appendRound()` — **event insert + cache update in ONE transaction.** Non-negotiable.
4. `verifyRating()` on launch. Snapshot-based. Log to console when it self-heals.
5. `export.ts` + the Settings screen with the real-data preview.
6. **Tests:** replay determinism · idempotent append · crash mid-transaction leaves no
   half-state · a corrupted cache self-heals on launch · full replay from 1200 matches the
   cache after N rounds.

### Do NOT build
The sync endpoint · auth · accounts · a server · automatic upload · word-rating
auto-correction. All of it is designed above. **None of it ships in Phase 1.**

---

## 10. Two honest notes

**On the explainer screen.** You chose *"before first round, skippable."* It's the standard
answer and it's cheap to change — one screen, one flag. But Sabd's pitch is that it's learnable
in ten seconds: boxes, clock, type the word. A screen *in front of* that is a wall between
someone and the thing that would sell them. And "skippable" means most people skip it, so you've
built a screen whose main function is teaching users to dismiss screens.

The stronger version: **let them play immediately on an easy word.** The hint buttons explain
themselves when tapped. The timer explains itself by draining. Offer the explainer *after*, when
they have context and might actually want it.

**Not overriding you.** Flagging it. Five friends will settle it faster than either of us can
argue it — and that's the right way to settle it.

**On what this doc buys you.** The entire backend is deferred, and it costs nothing, because
the log is designed to replay. When the server arrives it consumes events it already understands,
runs an engine that already exists, and computes a rating it can independently verify. **No
migration. No trust. No rewrite.**

That is the whole point of doing this now instead of later.
