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
- **`RoundEvent` is PROVISIONAL.** Its authoritative spec (`docs/sabd-event-log-and-sync.md`)
  is missing from the tree. The current shape lets Lane 1 typecheck; it **must** be reconciled
  against that doc before T9/T10/T23. Do not build persistence on it until confirmed.
- **`RoundEvent` is LOCKED** to `docs/sabd-event-log-and-sync.md` §4 (schema v1) and
  implemented by `@sabd/storage` (append-only log, atomic appendRound, verifyRating/fullReplay,
  export). `challengeMode` is not persisted in v1 — `recordRound` rejects challenge rounds
  (Challenge is disabled in Phase 2; shipping it = schema bump = contract decision). New
  players seed at **1200**.
- `apps/web` is a **frozen prototype**: it keeps its own local `types.ts` intentionally (its
  `RoundResult` is a UI-emit subset, not the engine contract). It is not a live consumer of
  `@sabd/contracts` and is not developed further in Phase 2.

## Status

- **Lane 1 complete (T1–T5):** monorepo scaffold, elo migrated, contracts extracted, pipeline
  migrated + wired to the wordbank, tokens built.
- **T8 complete:** `apps/mobile` is a real Expo SDK-57 Router app (RN 0.86 / React 19),
  monorepo-wired, with the ThemeProvider (+ oklch→sRGB accent bridge) and all four brand fonts.
- **T12–T14 complete:** custom keyboard, Rekha rail + authoritative timer (`useRoundClock`),
  and slot row — built to the locked design and verified rendering/interacting in a browser
  (typed→correct flip, solve flash, timeout lock). Dev harness at `/round-demo`.
- **T9–T10 complete:** `RoundEvent` locked to the event-log doc; `@sabd/storage` implements
  the append-only log (atomic `appendRound`, idempotent on `round_id`, snapshot `verifyRating`
  + `fullReplay`, export envelope) with the full §9.6 test suite green (14 tests); app boots
  SQLite → migrations → installId → verifyRating on launch.
- **T15–T17 complete:** the round is playable end-to-end. Pure `roundMachine` core (13 unit
  tests over the Part-A edge cases), `useRound` (clock + haptics + AppState resume + the
  once-only `onRoundEnd` seam → `recordRound`), HintBar/LetterChips (costs 8s/5s from
  `src/round/config.ts` — the eas-update tunables), assembled `/round` screen per locked 3a
  with confirm-abandon (= timeout, recorded before leaving). Verified end-to-end in-browser.

**Verification commands:** `pnpm -r typecheck` · `pnpm -r test` ·
`pnpm --filter @sabd/mobile exec expo export --platform android` · web preview via
`.claude/launch.json` (`sabd-mobile-web`, after `expo export --platform web --output-dir dist`).

**Next unblocked:** T18 (round feel pass), T19 (real Home), T20 (result screens), T11
(finish word selection: persisted seenIds), T21–T24 (splash/onboarding/settings/a11y),
Lane 2 content (T6–T7). **Blocked:** T25–T27 still need `docs/sabd-distribution.md`.
**Device check recommended:** run on a phone via Expo Go — solve a round, relaunch, confirm
the rating persisted (the log-backed loop end-to-end on hardware).
