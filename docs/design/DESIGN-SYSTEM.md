# SABD — Design System Handoff (Phase 1, rev. 2 — final branding)

> **Rev. 2 (Jul 2026):** updated to the finalized logo & splash (see `logo-package/LOGO.md`).
> Key changes: split-flap mark, Khand 700 wordmark, rail ABOVE the word, amber #F2A33C,
> शब्द removed from static lockups (scripts rotate in time via the splash flip), retro skin
> redefined as warm scoreboard brass/cream. Mockups turn 9 shows the applied branding.

For the UI-build phase. Locked decisions are marked **LOCKED**; defaults not yet
explicitly locked by the manager are marked *default* (chosen baseline; see mockup ids
in `SABD Mockups.dc.html` for alternates).

---

## 1. Identity

**SABD** (शब्द, "word") — competitive, Elo-rated word guessing. Indian at heart,
English-first: all product UI is English/Latin; the Indian DNA lives in the identity
layer (Rekha, kesar, शब्द mark) and never carries gameplay meaning.

### The Rekha (signature — LOCKED, revised)
One horizontal headstroke. Per the final logo, the line is the **mounting rail** of a
split-flap machine — it lives **ABOVE** the word, never through it (if it can read as a
strikethrough, it has failed). It is simultaneously:
1. **Letter rail** — glyph slots hang beneath it with a hair of air. Empty slots faint;
   focused slot shows an accent underscore stub.
2. **Timer** — the line burns right→left over 60s. Numeric readout above its right end.
3. **Wordmark spine** — the rail above SABD (Khand 700).
4. **1v1 axis** — opponent above the line, you below.

No OTP boxes. No timer rings. No confetti — ever. **The animated logo (split-flap) never
plays during a round** — launch/splash and at rest on Home only.

### Wordmark & logo (from LOGO.md — authoritative)
- Full mark: flap-card wordmark under the amber rail (`logo-package/logo-static.svg`).
- **In-app lockups below 48px wordmark height: rail + plain Khand 700 "SABD" only** — no
  cards, no seams (Home header uses this).
- शब्द never sits beside SABD in static lockups. Scripts (शब्द → শব্দ → guest → SABD)
  occupy the same slot **in time**, in the splash flip. Bengali is load-bearing.
- App icon: single S card under the rail (`logo-package/logo-icon.svg`).
- Result-screen stamp: the S-card icon (quiet, 40%), replacing the old शब्द text stamp.

## 2. Color tokens (**LOCKED** — mockup 5a)

| Token | Value | Role |
|---|---|---|
| `--ink` | `#171A24` | Ground. Indigo-ink — never neutral black. |
| `--ink-2` | `#222634` | Raised surfaces: slots (filled), keys, chips, hint buttons. |
| `--paper` | `#E9EAF2` | Primary text/glyphs. Cool white — never cream. |
| `--paper-dim` | `#8B8FA3` | Description, secondary UI, spent states. |
| `--kesar` | `#F2A33C` | Brand amber (unified with logo rail): wordmark rail, rating ◆, primary CTA, +Δ rating. |
| `--signal` | `#E4573D` | Timer-critical (<10s) + wrong-guess only. Never decorative. |

Empty slots: `rgba(233,234,242,.04)`; focused slot `.06` + accent stub.
Rekha track: `rgba(233,234,242,.12)`.

### Per-topic accent (`--accent`)
Swapped at round start; everything else constant. All six share **oklch L 0.75 / C 0.13**
(hue only moves):

| Topic | Hue | | Topic | Hue |
|---|---|---|---|---|
| Gaming | 300 | | Internet & Tech | 195 |
| Space & Sci-Fi | 250 | | Food & Drink | 70 (kesar's hue) |
| Music | 345 | | World & Places | 150 |

`--accent` drives: topic name, Rekha burn, timer readout, focused-slot stub, hint
diamonds, hint-chip borders, solve flash. Burn shifts to `--signal` in the last 10s.

**Atmospheric variant (mockup 5c):** same tokens + accent radial vignette behind the
word module, rail glow, slot elevation. If adopted, reserve for high-stakes beats
(final 10s, match point) rather than always-on.

**Light mode (Phase 2, proven in 5d):** remap only — bg `#EDEEF4`, surfaces `#FFF`,
text `#1A1D29`, accents drop to L 0.5, kesar → `#B87A17`.

**Retro skin (LOCKED — mockups 9b/9c; replaces the old CRT-green proof):** warm
**scoreboard brass/cream**, matching the retro logo. Token remap + flap machinery, nothing
structural:

| Token | Retro value | Note |
|---|---|---|
| ground | `#0B0908` | warm black |
| surface / cards | `#161310` | flap-card charcoal |
| text | `#F0E6CC` | cream ink |
| dim | `#8F8672` | warm dim |
| rail / accent | `#C98A2B` brass + 2px underside `#6E4A12` | rail gains physical depth |
| glow amber | `#E8B45A` | ratings, burn tip |

Per-topic accents **collapse to brass monochrome** in retro. Slots/cards get a center
seam (2px @85% black), radius drops 12→4px, CTA gets an inset brass underside, easing
swaps to `steps()`, shudder + clack per LOGO.md. Card faces switch to Khand 700.

## 3. Type

| Role | Face | Usage |
|---|---|---|
| **Wordmark / brand** | **Khand** 700 (600 secondary) | SABD lockups, PLAY CTA label, retro card faces. Shared Latin/Devanagari; Bengali: Hind Siliguri 700 (splash only) |
| Game/utility (**LOCKED**, 4a) | **Martian Mono** 400/500/700 | Slot glyphs, keyboard, timer, rating, chips, small labels (letterspaced) |
| Display | **Archivo** Expanded (wdth ~118–125) 700–900 | Topic names, verdicts (SOLVED / TIME.) |
| Body | **Instrument Sans** 400/500 | Descriptions, meta, helper text |

Scale (mobile): slot glyphs 28–36px · rating hero 40–56px · verdicts 24–32px ·
description 15px `--paper-dim` · minimum UI text 13px (11px only for letterspaced
mono labels). Numerals always Martian (tabular — no jitter).

Alternates considered: Azeret Mono (4b), Archivo-caps glyphs (4c).

## 4. Layout — **LOCKED (mockup 3a)**

### Round screen
Vertical order, 390px reference:
1. **Glance bar** (top, nothing tappable): topic name left (Archivo, accent),
   ◆ rating right. Back = edge-swipe; no top-left touch target.
2. **Flexible space** — then the **word module, vertically centered** between glance
   bar and controls: timer readout (right-aligned) → Rekha → slots → description
   (15px, centered, 2-line reserve, never reflows) → letter chips (when Letters hint
   used, mockup 3b).
3. **Control dock** (bottom ~55% holds everything tappable): hint bar (POSITION /
   LETTERS, 48px, equal weight) → custom keyboard (3 rows, 44px keys, Martian 13px).

Slots: 48×58px (5 letters), `border-radius 0 0 8px 8px` (square top — they hang from
the rail), gap 8px. Stress case (7–8 letters): width
`clamp(34px, (100vw−48px)/n − gap, 52px)`, gap 8→5px, glyph 36→28px, one row always;
tap target stays 52px+ tall.

### Home (**LOCKED** — mockup 8b)
Tight header: wordmark left, glowing rating + percentile right (nothing else up top).
Topic grid (2×3, cards ≥150px, stretch to fill) + PLAY CTA in the thumb zone; ⚔ Challenge
below PLAY. Each card: accent-hue Rekha top edge, **scattered mini-pattern** of 4–5
category glyphs in the accent (opacity .08–.15, varied size/rotation — wallpaper, not
illustration): gaming △○✕□ (generic face-button geometry — never PS/Xbox trademarks),
space ✦✧, music ♪♫, internet @#/〈/〉, food ♨●, world ◉▲. Card rating sits at hero
position in the accent with a soft glow (`text-shadow 0 0 16px accent/.75`); unplayed =
dim UNPLAYED, no glow. Reference TSX: `tsx-export/HomeScreen.tsx`.

### Result
Win: verdict + solved rail (accent-tinted) → centered rating beat (big number,
1240 → +23 in kesar, odometer roll-up) → NEXT WORD (kesar CTA) / HOME (ghost).
Timeout: "TIME." in `--paper-dim`, answer fills dim, burnt rail in signal-tint,
−Δ small, **no ceremony**. RETRY TOPIC / HOME both ghost.

### 1v1
Lobby: opponent plaque above the shared kesar Rekha, you below, VS punched through the
line. In-round: opponent progress = thin tick on their side of the rail.

## 5. Motion

Three durations: `--fast 120ms` · `--beat 260ms` · `--ceremony 700ms`.
Two easings: snap `cubic-bezier(.2,.9,.3,1)`; settle: ease-out.

- **Type:** glyph drops 8px onto rail, `--fast`; 1px rail dip on landing.
- **Position hint:** glyph drops 24px, `--beat`, lands accent-colored (given, not typed).
- **Letters chips:** stagger in 30ms apart, rise to touch the rail, settle below.
- **Wrong guess:** the rail shakes (±4px ×3, `--fast`), slots stay put.
- **Pressure:** burn continuous; at 10s → `--signal` + 1px ember pulse per second.
- **Solve:** burn halts → rail flashes accent → glyph wave-flip L→R (60ms stagger) →
  rating odometer rolls digit-by-digit, ◆ ticking. One `--ceremony`, then still.
- **reduced-motion:** translations → fades; odometer → crossfade; burn stays (it's
  information); ember pulse stops.

## 6. Ergonomics rules (apply everywhere)

- Everything tappable in the bottom ~55% of the screen; top is glance-only.
- Min tap target 44px (48px for hint bar, 52px slot height, 56px primary CTA).
- Back navigation = edge swipe; never a top-corner button.
- One primary (kesar) CTA per screen, max.

## 7. Voice

Descriptions are riddles, not definitions — conversational, a wink, ≤2 lines
("You respawn here after dying — checkpoint's older sibling."). Verdicts are terse:
SOLVED / TIME. Losses get no drama; wins get exactly one beat of ceremony.

## 8. References

- Mockups: `SABD Mockups.dc.html` — **turn 9 (final branding: lockup + retro skin)**,
  turn 6 (final flow), 8 (locked Home cards), 5 (color), 4 (type), 3 (locked layout).
- Logo: `logo-package/` — **LOGO.md is authoritative** for the mark, motion timings
  (split-flap, RN/Reanimated implementation), clear space, minimum sizes.
- Rationale + self-critique: `design-plan.md`.
- Rationale + self-critique: `design-plan.md`.

### Open (flag for manager before build)
1. 5c glow policy: always / stakes-only / never.
2. Rev. 2 note: turn-6 screens still show the pre-logo lockup (शब्द beside SABD, line through
   caps); turn 9 shows the corrected branding — apply 9a's lockup pattern everywhere at build.
