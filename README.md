# Sabd (शब्द) — monorepo

Competitive, Elo-rated word-guessing game. **Phase 2** consolidates four Phase-1 outputs
into one monorepo, builds the Expo mobile app to the locked design, and ships an Android APK
to friends. See [`docs/sabd-phase2-architect.md`](docs/sabd-phase2-architect.md) for the
orders, roadmap (T1–T30), and edge cases; [`docs/design/DESIGN-SYSTEM.md`](docs/design/DESIGN-SYSTEM.md)
(rev. 2) + [`docs/design/logo-package/LOGO.md`](docs/design/logo-package/LOGO.md) are
authoritative for anything visual.

## Layout

```
apps/
  mobile/               # Expo app — the Phase-2 product (scaffolded in T8; shell for now)
  web/                  # @sabd/web — the Phase-1 React prototype, FROZEN reference
packages/
  contracts/            # @sabd/contracts — the schema law (types + validators). Import from here.
  elo/                  # @sabd/elo — pure, deterministic rating engine. Never reimplement.
  tokens/               # @sabd/tokens — design tokens from DESIGN-SYSTEM.md rev. 2
  wordbank/             # @sabd/wordbank — generated, typed, validated word data + query surface
tools/
  content-pipeline/     # @sabd/content-pipeline — validate / merge / dict / publish scripts
scripts/
  analyze-playtests/    # @sabd/analyze-playtests — playtest export analysis (T28; shell for now)
docs/                   # specs + design (versioned with the code). Originals of the four
                        # Phase-1 folders are kept here frozen (sabd-ui / sabd-elo / sabd-content).
```

Toolchain: **pnpm workspaces + Turborepo**, Node ≥ 23.6 (native TypeScript execution — no
build step for the node packages), strict TS. `@sabd/*` cross-package imports resolve via
workspace symlinks and `tsconfig.base.json` path mappings.

## Running the app

**The game is `apps/mobile` (Expo).** `apps/web` is the frozen Phase-1 prototype — it does
not receive new work and will never reflect current progress.

```bash
pnpm dev            # Expo dev server for the REAL app (apps/mobile)
                    #   → press `w` to open in the browser (hot reload)
                    #   → scan the QR with Expo Go to run on your phone
pnpm dev:android    # same, but launches straight onto a connected Android device
pnpm dev:prototype  # the frozen Phase-1 web prototype (apps/web, :5173) — reference only
```

On a phone you get the full loop: solve a round, relaunch, the rating persists (SQLite is
native-only; the browser preview skips persistence).

## Commands

```bash
pnpm install                # workspace deps + symlinks
pnpm -r typecheck           # typecheck every package (the Lane-1 gate)
pnpm -r test                # run every package's tests
pnpm exec eslint "packages/*/src/**/*.ts"   # lint
pnpm content:validate       # validate the GAM word batch (needs network for the dict API)
pnpm content:merge          # merge validated batches → data/clean/sabd-wordbank.json
pnpm content:build-bank     # publish the merged bank into @sabd/wordbank (--version=x.y.z)
```

## Contract notes (read before changing shared types)

`WordEntry`, `RoundResult`, `RatingUpdate`, `RoundEvent` live **only** in
`@sabd/contracts`. Changing any is a contract-level decision — surface it, don't improvise.

- `WordEntry.tier` is canonically **`low | mid | high`** (the content pipeline, its validator,
  the data, and the web UI all use these; elo's former `easy|hard` labels were on a field the
  engine never reads, and are superseded).
- **`RoundEvent` is LOCKED** to `docs/sabd-event-log-and-sync.md` §4 (schema v1) and
  implemented by `@sabd/storage` (append-only log, atomic appendRound, verifyRating/fullReplay,
  export). `challengeMode` is not persisted in v1 — `recordRound` rejects challenge rounds
  (Challenge is disabled in Phase 2; shipping it = schema bump = contract decision). New
  players seed at **1200**.
- `apps/web` is a **frozen prototype**: it keeps its own local `types.ts` intentionally (its
  `RoundResult` is a UI-emit subset, not the engine contract). It is not a live consumer of
  `@sabd/contracts` and is not developed further in Phase 2.

## Status

- **Lane 1 (T1–T5), T8 (Expo scaffold), T9–T10 (event log storage), T15–T17 (playable round),
  T19 (real Home) all complete** — see git log for detail per task.
- **T6–T7 complete:** the full 6-topic, 360-word bank is generated, validated (zero hard
  failures), reviewed, and published as `wordBankVersion 1.0.0`. All topic cards are live.
- **T11 complete:** word selection is random within the ±150 rating window (not deterministic
  — every player gets a different sequence) with seenIds persisted via the event log, so a
  word never repeats across sessions.
- **T20–T23 complete:** dedicated result beat with an odometer rating roll on solve
  (`Odometer`, reduced-motion crossfades), a 3-panel skippable onboarding shown once
  before first play, and a Settings screen (haptics toggle, replay onboarding, the
  "Send my data" export flow with a real data preview + share sheet).
- **T21 (splash flip)** and **T18 (wrong-guess rail shake)** are in — the शब्द→শব্দ→SABD
  flip plays once at cold start; a wrong guess shakes the Rekha, not the letters.
- **T25 (EAS config) complete:** `eas.json` (`preview` internal APK profile, `production`
  store stub), `runtimeVersion: {policy: "appVersion"}`, ready for `eas update`. See
  **Shipping the APK** below — `eas login` / `eas build:configure` need your Expo account,
  so that step is yours to run (T26).

**Verification commands:** `pnpm -r typecheck` · `pnpm -r test` ·
`pnpm --filter @sabd/mobile exec expo export --platform android` · web preview via
`.claude/launch.json` (`sabd-mobile-web`, after `expo export --platform web --output-dir dist`).

**Next:** T24 (a11y + stress audit), T18 remainder (full motion ledger pass, 60fps check on
device), T26 (owner runs the first real build), T27 (prove the `eas update` loop), T28–T30
(playtest analysis + kit + ship).

## Shipping the APK (T25/T26 — per `docs/sabd-distribution.md`)

One-time setup (needs your Expo account — this step is yours to run):

```bash
cd apps/mobile
npm i -g eas-cli
eas login
eas build:configure       # links this project to your Expo account, fills extra.eas.projectId
```

Then, the free/instant Android path:

```bash
eas build --platform android --profile preview
```

EAS returns a shareable link + QR code — friends scan, download the APK, tap install (Android
will warn "unknown source"; tell them in advance). No Play Store, no account, free.

**Iterating after that first build** — push JS/asset changes to an already-installed build in
seconds, no rebuild:

```bash
eas update --branch preview --message "what changed"
```

Reopen the app on the test device — the update lands. Only native changes (new native
dependency, icon, SDK bump) need a fresh `eas build`.
