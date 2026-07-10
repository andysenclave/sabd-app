# SABD — Game UI · Build Progress

**Project:** sabd-ui (playable front-end for the word game "Sabd" / शब्द)
**Status:** ✅ First-session goal met — playable modern-skin solo round; solve + timeout + both hints verified in-browser; `npm run build` passes; dev server clean.
**Last updated:** 2026-07-09 22:45 IST

---

## Build tasks (brief §5)

- [x] Scaffold Vite + React + TypeScript app, single-screen game route
- [x] `src/mock/words.ts` — 10 mock WordEntry objects across topics & tiers (§2 contract)
- [x] `src/config.ts` — timeLimitSec, hint costs, onScreenKeyboard, skin, glow flag
- [x] `RekhaRail` (rail + burn timer + slots) — burn via MotionValue, ember pulse, solve flash
- [x] `Description` (ambient, dim, 2-line reserve, never reflows)
- [x] `SlotRow` (hanging slots: focus / typed / given / solved states; stress-case sizing)
- [x] `HintBar` (POSITION / LETTERS, equal weight, single-use, cost labels, disable after use)
- [x] `LetterChips` (2 shuffled candidates, never reveal which is correct/position)
- [x] `GameScreen` (orchestrates round state, wires hints→timer, solve/timeout, onRoundEnd)
- [x] `ResultOverlay` (win ceremony w/ odometer vs timeout muted reveal; shows §2 result object)
- [x] `src/game/useRound.ts` — round-state hook, timer via requestAnimationFrame
- [x] Rating-engine seam: single `onRoundEnd(result)` callback, engine STUBBED (log + on-screen)
- [x] Skin system: modern shipped fully; retro = token-remap stub (CRT + phosphor + scanlines)
- [x] `prefers-reduced-motion` honored (CSS entrances neutralized; framer via useReducedMotion)
- [x] README
- [x] ErrorBoundary (bonus — no silent white-outs)

## First-session goal (brief §7)

- [x] Description shows from start; slots fill by typing (auto-advance, backspace, A–Z, upper)
- [x] Rekha burns down (rAF, MotionValue-smooth)
- [x] Position hint drops + locks a letter in "given" (accent) style, costs −8s
- [x] Letters hint shows 2 chips without revealing which is right, costs −5s
- [x] Correct submit ⇒ solve ceremony + §2 RoundResult object shown on screen
- [x] Timeout ⇒ answer revealed, muted, no ceremony, −Δ
- [x] prefers-reduced-motion honored
- [x] Verified in-browser: solve path, timeout path, both hints, wrong-guess, on-screen +
      physical keyboard, NEXT WORD cycling, retro skin. `npm run build` green.

## Design integration

- **Tokens imported from `sabd-design`:** `src/tokens.ts` mirrors
  `sabd-design/tsx-export/tokens.ts` (palette 5a, Martian Mono 4a, motion durations/easings).
  Token **names kept stable**; the skin layer remaps values only. The provided tsx-export
  components (RekhaRail/SlotRow/Keyboard/Chrome + screens) were used as the structural
  basis and made playable + animated.
- **Glow policy (DESIGN-SYSTEM.md §5c open item):** defaulted to **STAKES-ONLY** (the
  design's recommendation) — the atmospheric accent glow appears only inside the final
  `criticalSec` (10s). It's behind `config.glowPolicy` and can be flipped to `always` or
  `never` without code changes. (The ember pulse on the burn is separate — it's pressure
  *information*, always on in the critical window, and stops under reduced-motion.)
- **Where the design superseded the older UI brief:** no OTP boxes → the Rekha rail with
  hanging slots; no timer ring → the burn line; glance-only top bar (topic left, rating
  right, back = edge-swipe, no top-left button); word module vertically centered; everything
  tappable in the bottom control dock (hint bar + custom keyboard). Result/ceremony per §4.

## Notes / open questions

- **Timer is MotionValue-driven.** The burn updates a Framer `MotionValue` every rAF frame
  (no React re-render); component state (mm:ss label, critical flag) changes ~1×/sec. This
  was necessary so entrance animations aren't restarted 60×/sec by a cascading re-render.
- **Entrances/loops are CSS, one-shot beats are Framer.** Glyph drops, chip rise, focus
  caret, and ember pulse are CSS keyframes (immune to re-render restarts, neutralized in one
  place for reduced-motion). Rail shake, solve wave-flip, and the rating odometer use Framer.
- **Framer easing gotcha (fixed):** Framer rejects CSS easing strings (`'ease-out'`,
  `'cubic-bezier(...)'`). Added `ease` in `tokens.ts` (`'easeOut'` / bezier array) for Framer
  transitions; the CSS-string tokens remain for the CSS animations. (This caused an early
  crash-on-first-animation; resolved.)
- **Rating delta is a display stub** (`stubRatingDelta`), only to feed the odometer. Not Elo.
- **Mock data** is hand-authored in the design's riddle voice; GAMER is seeded verbatim from
  `sabd-content/data/clean/sabd-wordbank.json` and RESPAWN is the §2 contract example.
- **Preview caveat during verification:** the automated preview tab runs `hidden`, which
  freezes CSS/rAF animations at their first frame — so animations were verified structurally
  (DOM/state) rather than by pixels; they run normally in a visible tab (the solve-ceremony
  frame did render its accent flash + glyph glow).
- `LETTERS` chips are tappable as a convenience (types the letter into the focused slot); this
  reveals no correctness since either candidate can be entered anywhere.
