# SABD — Game UI (Phase 1)

The playable front-end for **SABD** (शब्द, "word") — a competitive, Elo-rated
word-guessing game. This is a single-screen solo round running against **mock
words** and a **stubbed rating engine**. Modern skin ships fully; retro is a
token-remap stub.

The signature element is the **Rekha**: one horizontal headstroke that is at once
the letter rail (glyph slots hang below it) and the 60-second timer (the line
_burns_ right→left, going red in the final 10s). There are no OTP boxes and no
timer ring — see `sabd-design/DESIGN-SYSTEM.md`.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc --noEmit + vite build
npm run preview    # serve the production build
```

Web only. Requires an evergreen browser (uses `oklch()` colors).

### Play

- **Type** A–Z to fill slots (auto-advance; backspace steps back; uppercased).
  Works with a physical keyboard _or_ the on-screen keyboard.
- **⏎ / Enter** submits. Wrong/incomplete → the rail shakes, the round continues.
- **POSITION** (−8s) drops the correct letter into its slot in a "given" style and
  locks it. **LETTERS** (−5s) reveals 2 candidate letters (one real, one decoy) —
  it never says which is which or where it goes. Each hint is single-use.
- **Solve** → ceremony (rail flash → glyph wave → rating odometer). **Timeout** →
  muted answer reveal, no ceremony. The `RoundResult` object is shown on screen.

Add `?skin=retro` to the URL to preview the retro skin.

## Where things live

| Concern | File |
| --- | --- |
| Data contract (WordEntry / RoundResult, §2) | `src/types.ts` |
| Mock words (swap the deck here) | `src/mock/words.ts` |
| Config (time, hint costs, keyboard, skin, glow) | `src/config.ts` |
| Design tokens (from `sabd-design`) | `src/tokens.ts` |
| Skin layer (modern + retro remap) | `src/skins.ts` |
| Round state + timer (rAF) | `src/game/useRound.ts` |
| Screen orchestration | `src/components/GameScreen.tsx` |
| Rekha, slots, hints, chips, keyboard, result | `src/components/*` |

## Swapping the mock words

Edit `src/mock/words.ts`. Each entry must match the **§2 `WordEntry`** shape
exactly (do not rename fields). `hints.position.index` is **0-based**. Tiers are
`low | mid | high`. `topicMetaFor(topic)` maps the `topic` string to its accent
hue and display label — add a row to `TOPIC_META` if you introduce a new topic
string. (Seeded partly from the validated bank in
`sabd-content/data/clean/sabd-wordbank.json`, which is read-only reference.)

## The rating-engine seam

The round emits exactly one callback — **`onRoundEnd(result: RoundResult)`** —
wired in `App.tsx`. The engine is **stubbed**: `onRoundEnd` logs the result
(`[SABD] onRoundEnd`) and advances a fake running rating via `stubRatingDelta`
(in `GameScreen.tsx`) purely so the odometer has something to roll. Replace the
body of `handleRoundEnd` in `App.tsx` (and drop `stubRatingDelta`) to plug in real
Elo — nothing else needs to change. No rating math, matchmaking, content loading,
or auth is implemented here (out of scope for Phase 1).

## Skins & tokens

Tokens come from the design handoff (`src/tokens.ts`, mirroring
`sabd-design/tsx-export/tokens.ts`); token **names are stable**. A skin is a
**token remap + easing swap** (retro also adds a scanline overlay) — nothing
structural, per `DESIGN-SYSTEM.md`.

- `src/skins.ts` defines `modernSkin` (full) and `retroSkin` (CRT green-black +
  phosphor + `steps()` easing + scanlines).
- Components read the active skin via `useSkin()`, so swapping never touches
  component logic. Select it with `config.skin` or the `?skin=` URL param.
- To add a skin: add a `Skin` object to `SKINS` in `src/skins.ts`.

## Motion & accessibility

Three durations (`--fast`/`--beat`/`--ceremony`) and two easings, per the design.
Entrance and looping animations (glyph drops, chip rise, focus caret, ember pulse)
are **CSS** so they survive React re-renders; one-shot beats (rail shake, solve
wave, rating odometer) use Framer Motion. The burn is a Framer `MotionValue`
updated every rAF frame — smooth without re-rendering React.

`prefers-reduced-motion` is honored everywhere: translations become fades, the
odometer becomes a crossfade, the ember pulse stops — but the burn stays (it's
information, not decoration).

## Porting note

Components are presentational and skin-driven, kept RN/Expo-portable. No React
Native is built in this phase.
