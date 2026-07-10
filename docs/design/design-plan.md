# Sabd — Design Plan (§3.1) + Self-Critique (§3.2)

> **Superseded in part (Jul 2026):** the wordmark/lockup sections below predate the
> finalized logo. `logo-package/LOGO.md` and DESIGN-SYSTEM.md rev. 2 are authoritative:
> rail ABOVE the word (never through it), Khand 700, split-flap mark, शब्द rotates in
> time — never beside SABD. Retro = scoreboard brass/cream, not CRT green.

*Phase 1, direction proposal. React to this before any screen is drawn.*

---

## 0. The one idea everything hangs from (literally)

**The shirorekha.** In Devanagari, letters hang from a continuous headstroke — the horizontal
line that runs across शब्द. Sabd's letters do the same thing.

There are no OTP *boxes*. There is **one horizontal line — the Rekha — and the letters hang
from it**, exactly like Devanagari script. The Rekha is simultaneously:

1. **The letter rail** — glyph slots hang beneath it (empty slots are faint stubs).
2. **The timer** — the line *burns down* from right to left over 60 seconds. Time doesn't
   sit in a corner ring; it physically approaches your unsolved letters.
3. **The wordmark's spine** — the Sabd lockup uses the same stroke.
4. **The identity** — one line = word, time, and brand. Nothing else in the category looks
   like this, and it's honestly derived from the name's Devanagari root, not decoration.

**Signature pick (§4): the letter rail — with the clock expressed *through* it.** The boxes
and the clock were the two strongest contenders; the Rekha makes them one element. The rating
number gets the second-most craft (it's the reward beat) but stays quiet until it moves.

### Wordmark (§1.1)
**Lockup, Latin-primary:** **SABD** (all-caps, Archivo Expanded) set in the display face with
the Rekha drawn through its cap-height as a literal headstroke; **शब्द** sits beside it as a
signature mark (app icon, splash, result-screen stamp). Latin carries store/global
legibility; Devanagari carries soul. The
wordmark is not a separate asset to maintain — it's the system demonstrating itself.

### Globalization stance (Indian at heart, English-first)
**The identity is proudly Indian; the product speaks English.** India-first aesthetics, not
localization — the cultural DNA is the brand's differentiator globally, the way chess wears
its origins openly.

- **English is the product language.** All UI, topics, descriptions: Latin script, canonical
  spelling **SABD**. A player anywhere can play with zero cultural context.
- **Indianness lives in the identity layer, visibly:** the Rekha (headstroke) as the core
  mechanic's form; **kesar saffron** as the brand hue; शब्द present in the lockup, icon,
  splash, and the result-screen stamp — a signature, worn openly, never load-bearing for
  comprehension. To a global player everything still self-explains (the Rekha reads as
  rail + burning timer); to anyone who knows Devanagari, it means more.
- **Future-proofing:** slot count is data-driven and the §3a layout formula is
  script-agnostic; chosen faces cover Latin-extended for other locales later, behind the
  same tokens.

---

## 1. Palette (dark-first, indigo ink — deliberately not neutral black)

Mobile, evening, adrenaline: dark-first. To stay out of the banned "near-black + one acid
accent" cluster: the ground is a visibly **blue ink**, whites are cool, and accent color is
**per-topic** — six hues, one system — with saffron as the brand's own hue.

| Token | Hex | oklch | Role |
|---|---|---|---|
| `--ink` | `#171A24` | 0.21 0.03 275 | Ground. Indigo-ink, not black. |
| `--ink-2` | `#222634` | 0.27 0.035 275 | Raised surfaces, chips, cards. |
| `--paper` | `#E9EAF2` | 0.93 0.01 280 | Primary text. Cool white — never cream. |
| `--paper-dim` | `#8B8FA3` | 0.66 0.02 280 | The description line, secondary UI. |
| `--kesar` | `#F0A33A` | 0.78 0.13 70 | Brand saffron. Wordmark, rating, default accent. |
| `--signal` | `#E4573D` | 0.62 0.17 30 | Timer-critical + wrong-guess only. Earned, never decorative. |

**Per-topic accent** (`--accent`, swapped at round start; everything else constant). All six
share oklch **L 0.75 / C 0.13** — only hue moves, so no topic feels louder than another:

- Gaming `hue 300` violet · Space & Sci-Fi `250` blue · Music `345` magenta
- Internet & Tech `195` cyan · Food & Drink `70` saffron (shares brand hue) · World & Places `150` green

The Rekha burns in `--accent`, cools toward `--signal` in the last 10s. Solve flash, letter
chips, and focused slot all key off `--accent`. One identity, six moods.

**Retro skin note:** same tokens, remapped — `--ink`→deep CRT green-black, `--paper`→phosphor,
Rekha becomes a scanline-weight rule, motion swaps easing for steps(). Skin = token remap +
easing swap, nothing structural. (Proven with one screen in Phase 3.)

## 2. Type

The glyphs in the slots ARE the game, so the utility face gets the biggest decision.

- **Game/utility — Martian Mono** (Google). Wide, squared, engineered; letters look like
  components being slotted into a machine, tabular by nature (ratings, timer digits never
  jitter). Distinctive without novelty — this is the face you'll actually stare at.
- **Display — Archivo** (Expanded, 700–900). Athletic grotesque for the wordmark, topic
  names, big result verdicts. Competitive-sport energy, zero quiz-app rounding.
- **Body — Instrument Sans** (400/500). Quiet, compact; descriptions, buttons, meta. Used
  small and stays out of the way.
- **Devanagari — Tiro Devanagari Sanskrit**, for शब्द only. A scholarly face for a scholarly
  word; it appears as a mark, never as UI text.

Scale (mobile): slot glyphs 28–36px · rating 40px Martian · display 24–32px Archivo ·
description 15px Instrument at `--paper-dim` · minimum UI text 13px.

## 3. Layout — ASCII wireframes

> **LOCKED (mockup 3a):** the word module (timer readout → Rekha → slots → description)
> floats as ONE block, vertically centered between the glance-only top bar (topic left,
> rating right) and the bottom control dock (hint bar + keyboard). Everything tappable
> lives in the bottom ~55%; the top is glance-only; back = edge-swipe, no top-left target.
> Letters-hint chips join the centered block (mockup 3b); solve ceremony holds the same
> center (3c). The ASCII below reflects the pre-lock top-anchored draft — superseded.

### 3a. Round screen (THE screen), fresh state

```
┌──────────────────────────────┐
│  ← Gaming            ⚡ 1240 │   topic + my rating, quiet
│                              │
│                              │
│      ━━━━━━━━━━━━━━━━━━━━╍╍  │ ← the Rekha: rail + burning timer
│      ▌S ▌  ▌  ▌  ▌  ▌  ▌     │   letters HANG from it
│                              │
│   "You respawn here after    │   description: ambient, dim,
│    dying — checkpoint's      │   fixed 2-line reserve under
│    older sibling."           │   the rail, never moves
│                              │
│                              │
│  ┌────────────┐┌───────────┐ │
│  │ ◇ POSITION ││ ◇ LETTERS │ │   2 hint buttons, equal weight
│  └────────────┘└───────────┘ │
│ [Q][W][E][R][T][Y][U][I][O][P]│
│  [A][S][D][F][G][H][J][K][L] │   custom keyboard, Martian Mono
│   [⏎][Z][X][C][V][B][N][M][⌫]│
└──────────────────────────────┘
```

- **Description placement:** directly under the rail at `--paper-dim`, 15px, max 2 lines
  reserved (no reflow). It's the closest thing to the hero but 4× dimmer and 2× smaller —
  present, never competing.
- **Mid-round, Letters hint used:** a single row of letter chips slides in *between*
  description and hint bar; the LETTERS button collapses to a spent state.
- **7–8 letter stress case:** slot width `clamp(34px, (100vw − 48px)/n − gap, 52px)`, gap
  shrinks 8→5px, glyph size steps 36→28px. One row, always. Tap target = full slot height
  (52px) regardless of width.

### 3b. Home / topic select

```
┌──────────────────────────────┐
│  SABD  शब्द                  │   lockup, Rekha through it
│  ─────────────               │
│        ⚡ 1240                │   rating: biggest thing on
│      RATED · TOP 18%         │   screen after wordmark
│                              │
│  ┌─────────┐  ┌─────────┐    │
│  │ GAMING  │  │ SPACE   │    │   6 topic cards, 2×3;
│  ├─────────┤  ├─────────┤    │   each card's top border =
│  │ MUSIC   │  │ INTERNET│    │   its accent-hue Rekha
│  ├─────────┤  ├─────────┤    │
│  │ FOOD    │  │ WORLD   │    │
│  └─────────┘  └─────────┘    │
│  ┌──────────────────────┐    │
│  │      ▶ PLAY          │    │
│  └──────────────────────┘    │
│        ⚔ Challenge a rival   │
└──────────────────────────────┘
```

### 3c. Result — win / timeout

```
WIN                              TIMEOUT
│  SOLVED · 0:41 left  │        │  TIME.               │
│  ▌S▌P▌A▌W▌N▌ (solved │        │  ▌S▌P▌A▌W▌N▌ (answer │
│   rail, accent flash)│        │   fills in, dim,     │
│                      │        │   Rekha fully burnt) │
│   1240 → 1263        │        │   1240 → 1234        │
│   ⚡ +23 (odometer    │        │   −6, small, no      │
│      roll-up, THE    │        │   ceremony           │
│      dopamine beat)  │        │                      │
│  [ NEXT WORD ] [Home]│        │  [ RETRY TOPIC ][Home]│
```

### 3d. 1v1 lobby (framing only)

Two rating plaques face each other across a shared Rekha — my ⚡1240 hangs *below* the line,
opponent's ⚡1287 sits *above* it, mirrored like Devanagari vs Latin. Same round screen after;
opponent presence = a thin progress tick on the far side of the rail. Don't over-invest yet.

## 4. Motion language (one orchestrated system, 3 speeds)

Everything uses three durations — `--fast 120ms`, `--beat 260ms`, `--ceremony 700ms` — and
two easings (snap: cubic-bezier(.2,.9,.3,1); settle: standard ease-out).

- **Type a letter:** glyph drops onto the rail from 8px above, `--fast`, tiny rail dip (1px)
  on landing — the line *feels* the letter.
- **Position hint:** the revealed glyph drops from higher (24px) with `--beat`, lands already
  accent-colored — visibly *given*, not typed.
- **Letters chips:** stagger in 30ms apart, rising to *touch* the rail then settling below it.
- **Wrong guess:** rail-level shake (±4px, 3 cycles, `--fast`), slots stay put — the *line*
  flinches, not your letters.
- **Timer pressure:** the Rekha burns right→left continuously; at 10s it shifts to `--signal`
  and gains a 1px ember-glow pulse per second. No sound-and-fury — tightening, not flashing.
- **Solve (the ceremony):** remaining burn halts → whole rail flashes `--accent` → glyphs do
  a single wave-flip left to right (60ms stagger) → rating odometer rolls up digit-by-digit
  with the ⚡ mark ticking. One beat, `--ceremony`, then still.
- **`prefers-reduced-motion`:** all translations become opacity fades; odometer becomes a
  crossfade; burn remains (it's information, not decoration) but the ember pulse stops.

---

## §3.2 Self-critique — "would I ship this for any quiz app?"

1. **Rekha rail** — No. It's derived from the name itself and merges two mandatory elements
   (letters + timer). This is the keeper. *Risk:* burning line as timer is less instantly
   read than a ring → mitigated with numeric countdown at the line's burnt end, and the
   description spells nothing (players learn it in one round).
2. **Palette v1 was dimmer.** First pass had a neutral `#141414` ground — that IS the banned
   cluster. Changed to indigo-ink (visible hue 275) and moved uniqueness into the per-topic
   accent discipline (fixed L/C, hue-only swaps) — that constancy is a system, not a swatch.
3. **Type:** first instinct was Space Grotesk + JetBrains Mono — both "any dev-adjacent app
   2024." Replaced with Martian Mono (rarely used as a *hero* face; its width earns the slot
   role) and Archivo Expanded for sport-poster energy. Instrument Sans is admittedly safe —
   acceptable, it's the *quiet* layer by design.
4. **Timer ring:** rejected per brief; the burn is the justified answer because it makes time
   *spatially* threaten the word.
5. **Rating moment:** most quiz apps do confetti. Sabd does an odometer roll — chess-like,
   numeric, addictive because the number is the identity. Confetti banned globally.
6. **Remaining genericness, flagged honestly:** 2×3 topic card grid on Home is by-the-book.
   Kept for scanability; personality arrives via per-card accent Rekhas. If you want one more
   swing, Home is where I'd take it.

---

## Open questions for you (before mockups)

1. **Rekha signature** — approved, or do you want a variant where classic boxes stay and the
   burn-line sits separately?
2. **Dark-first** — confirmed? (Light mode would be Phase 2 token remap.)
3. **Palette / saffron brand hue** — react.
4. **Martian Mono as the hero glyph face** — react (I can show A/B in the mockups).
5. **Wordmark lockup** (Latin primary, शब्द as logo-level mark only) — approved?
