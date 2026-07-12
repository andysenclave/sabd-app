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
- **T24 (a11y + stress audit) complete:** 34 findings from a full audit of every screen,
  most fixed directly (tap targets to 44px, missing labels/roles, and — the biggest gap —
  the custom keyboard now announces every keystroke/backspace/wrong-guess/hint/round-end
  via `AccessibilityInfo`, since there's no backing `TextInput` to fall back on). Checklist
  with contrast numbers, the exact slot-clamp math at n=3/n=8, and what's deliberately
  deferred (with reasons): `apps/mobile/A11Y-AUDIT.md`.
- **T28 (playtest analysis script) complete:** `scripts/analyze-playtests` — five reports
  (loop/hints/timing/words/topics), strict n<5 suppression, dedupe-by-roundId, mixed-
  schemaVersion rejection. 20 tests; verified end-to-end against a synthetic 21-round
  dataset. Run with `pnpm --filter @sabd/analyze-playtests analyze <exports-dir>`.
- **T29 (playtest kit) complete:** `docs/playtest/` — the WhatsApp invite message, 6
  post-play questions, `names.json.example`, and the install/played tracking file. Not
  git-tracked (all of `docs/` is gitignored per an earlier decision) but exists on disk,
  ready to forward.
- **Two priority bugs fixed (2026-07-12):** the app icon and Home wordmark were
  approximations, not the real designed assets — both now render the actual SVGs from
  `docs/design/logo-package/` via `react-native-svg`. Also fixed a real native-stack
  navigation crash on round-abandon (replaced a manual `beforeRemove` listener with
  react-navigation's `usePreventRemove`, per their own runtime warning's guidance).
- **Post-playtest-prep feedback round (2026-07-11):** (1) the header/Home rating was
  frozen until app relaunch — fixed with focus-triggered refresh, since expo-router keeps
  Home mounted across a round. (2) Per-topic "ratings" on the Home grid were a global-rating
  snapshot mislabeled as category-specific — `topicStats` (`@sabd/storage`) now replays
  each topic's own rounds through `@sabd/elo` independently from the 1200 seed, no schema
  change. (3) **Retro brass/cream (mockups 9b/9c) is now the app's one skin**, replacing
  modern indigo/kesar everywhere (the wordmark asset was already retro-styled and clashed
  with the old indigo background). A first pass kept per-topic accent color, which the
  owner correctly flagged as not matching 9b/9c — the actual mockup markup is full brass
  monochrome (topics read by name + icon shape, not color), plus a center-seam "fold" on
  every card/slot, a two-layer brass rail, and 4px radii throughout, none of which the
  first pass had. Corrected same day by reading the mockup's real markup instead of the
  design doc's prose summary. (4) The splash flip is bigger (real wordmark SVG at the
  SABD resolve, not plain text) with a landing shudder per script change, plus a
  synthesized placeholder "clack" sound (`expo-audio`) — swap
  `apps/mobile/assets/sound/splash-clack.wav` for a real asset later.
- **Rev. 3 per-category redesign (2026-07-11):** built from a full new design handoff
  (`docs/new-design/` — DESIGN-SYSTEM.md rev. 3 + actual TSX exports, not just a mockup
  HTML this time). Home cards are per-category-colored again (gaming↔world hues swapped so
  gaming reads green — a genuinely different hue table from Phase-1's, see
  `src/theme/themed/themedTokens.ts`), with the center-seam fold + scanlines now
  **gaming-only**. Every topic's Round screen is now fully bespoke — its own ground,
  slot shape, rail treatment, and ambient motion
  (`src/components/round/themed/Round{Gaming,Space,Music,Internet,Food,World}.tsx`) —
  replacing the single shared retro round screen entirely (old generic
  RekhaRail/SlotRow/HintBar/Keyboard deleted). Win/timeout results are themed per topic
  too (`ThemedEndBeat.tsx`, owner's call — no mockup exists for this one). Caught and
  fixed a real crash in verification: `WordEntry.topic` is a display string ("Gaming"),
  not the lowercase `TopicId`, so the initial per-topic screen dispatch resolved to
  `undefined` and blanked the whole round screen — fixed by mapping through
  `TOPICS.find(t => t.bankTopic === word.topic)`.
- **On-device fixes after the rev. 3 redesign (2026-07-11):** the web-preview pass above
  didn't catch several real-device-only bugs the owner found on their phone. (1) Animated
  `textShadowRadius` (the Home rating's glow pulse) renders as a hard rectangle on Android,
  not a soft glow — replaced with `RadialGlow.tsx`, a real blurred SVG radial gradient, with
  the pulse animating its opacity instead. (2) Slot/card backgrounds ported directly from the
  mockup's CSS alpha values read as "almost invisible" on a real phone (worst on Gaming,
  whose flap-card surface `#161310` was only 11 RGB units off its own ground) — bumped
  `@sabd/tokens.retro.surface` to `#241F17`, added borders to Gaming's slots (the other 5
  themed screens already had them), and roughly doubled every slot/hint/keyboard alpha value
  across all 6 themed screens plus every `RadialGlow` opacity (nebula/lamp/stage-floor) and
  broadened its falloff curve so atmosphere actually spreads instead of reading as a small
  dim blob. (3) Space's filled slots were supposed to bob out of phase (`k-bob`, staggered
  per letter) but the port hardcoded `delay=0` for every slot — fixed to stagger by index.
  (4) Real bug, not a rendering gap: abandoning a round via back-gesture revealed the answer
  (both visually and via the screen-reader announcement) — `useRound.ts`'s `abandon()` was
  indistinguishable from a natural timeout. Fixed by threading a new `abandoned` flag through
  `RoundEndSummary` so the word is suppressed specifically for abandons, while still recording
  the round as a rated loss.
- **Round 2 of on-device fixes, same day:** two of the round-1 fixes above shipped their own
  new bugs, plus the abandon fix was still incomplete. (1) The Home rating's new `RadialGlow`
  was wrapped too tightly (84×40 box, `rx=65/ry=60`) — the gradient's fade-out got clipped by
  its own SVG viewport before reaching zero opacity, producing a solid rounded-pill badge
  instead of a soft glow. Fixed by sizing the glow relative to the whole card instead of a
  box around just the text. (2) Gaming's Home card border was selected-only; every hue except
  gaming's green read fine unselected against the brightened surface token — now every card
  gets a subtle always-on border. (3) The abandon fix had a real render-order race:
  `core.status` flips to `'timedout'` (via `setCore`) one commit before `round.tsx`'s
  `abandoned` flag caught up (it was only set inside `onRoundEnd`, fired from an effect after
  that first render already committed) — a real, visible frame on-device where the end-beat
  showed with `abandoned` still false. Fixed by making `abandoned` a real `useState` in
  `useRound.ts`, set as a sibling call alongside `setCore` in the same handler so both land in
  one React commit, and returned directly from the hook instead of round-tripped through
  `onRoundEnd`.

**Verification commands:** `pnpm -r typecheck` · `pnpm -r test` ·
`pnpm --filter @sabd/mobile exec expo export --platform android` · web preview via
`.claude/launch.json` (`sabd-mobile-web`, after `expo export --platform web --output-dir dist`).

**Next — all owner/hardware-blocked:** T18's remaining on-device 60fps check, T26 (you run
the first real `eas build`), T27 (prove the `eas update` loop on that build), T30 (ship to
5–10 friends, log it, run T28 on the real exports — this is "Phase 2 done").

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
