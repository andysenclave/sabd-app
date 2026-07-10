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
- `apps/web` is a **frozen prototype**: it keeps its own local `types.ts` intentionally (its
  `RoundResult` is a UI-emit subset, not the engine contract). It is not a live consumer of
  `@sabd/contracts` and is not developed further in Phase 2.

## Status

- **Lane 1 complete (T1–T5):** monorepo scaffold, elo migrated, contracts extracted, pipeline
  migrated + wired to the wordbank, tokens built.
- **T8 complete:** `apps/mobile` is a real Expo SDK-57 Router app (RN 0.86 / React 19),
  monorepo-wired, with the ThemeProvider (+ oklch→sRGB accent bridge) and all four brand fonts.
  `pnpm -r typecheck` green; `expo export` bundles cleanly. Device run via Expo Go is
  owner-verifiable.

**Verification commands:** `pnpm -r typecheck` · `pnpm -r test` ·
`pnpm --filter @sabd/mobile exec expo export --platform android`.

**Next unblocked:** T11 (word selection), T12–T14 (keyboard / rail+timer / slot row), and
Lane 2 content (T6–T7). **Blocked:** T9/T10 (storage + event log) need
`docs/sabd-event-log-and-sync.md` to lock the `RoundEvent` schema — see the contract note above.
