# Sabd — Logo

## The mark (approved playback)

Sabd's mark is a held breath before the flip. A steady line — the roof — holds still while the
word hangs beneath it and turns over: शब्द, শব্দ, sometimes слово or λέξη or 詞, arriving from
wherever, because the word is home in every language. Each character flips in a wave, 2–3 turns,
a soft clack, then stillness — and it always settles on **SABD**, the name, hanging from the roof
like everything before it. The line never moves; the world changes under it. Frozen, it is a word
hanging from a roof — never crossed out, never a corporate wordmark. At 60pt it is a single **S
under the roof**. In retro skin the scoreboard machinery shows; in modern it's silent and flat.
The mechanism is the meaning: a word, being many words, resolving to one.

## Chosen direction — 1b "The Rail"

The amber line is the **mounting rail** of a split-flap machine. Letters hang beneath it as flap
cards with a hair of air between — the mechanism is visible even frozen. The line never sits at
mid-letter height: it lives **above** the word. Nothing is ever crossed out.

Why: the founder's memory is the mechanism (cricket-scoreboard flip), the frozen mark must show
its origin story, and the rail makes the śirorekhā literal machinery rather than decoration.

## Construction

- Card: 88 × 124, gap 9, radius 9 (modern) / 4 (retro)
- Rail: 440 × 9 (modern, #F2A33C) / 440 × 12 (retro, brass #C98A2B + 2px underside #6E4A12)
- Air between rail and cards: 12
- Seam at exact vertical center of card: 2px @ 40% (modern) / 3px @ 85% black (retro)
- Latin + Devanagari: **Khand 700** (ITF, shared Latin/Devanagari). Bengali: **Hind Siliguri 700**.
- Ink: #F4F1EA on #171B23 cards (modern); #F0E6CC on #161310 (retro). Ground: #0E1116.

## Clear space & minimum sizes

- Clear space: half a card width (44 units) on all sides.
- Below 48px wordmark height: **drop the cards and seams** — rail + plain Khand wordmark only
  (see the 24px test in the direction sheet).
- App icon: single S card under the rail (`logo-icon.svg`). Square, flat, no animation.

## Motion — exact timings (at 1.0×; app default is 0.85×)

- Rest on शब्द: 900 ms
- Rotation: शब्द → শব্দ → one random guest (λέξη / слово / 詞 …) → **SABD**. Settles still.
- Wave: left → right, 90 ms stagger per card
- Flip: one Solari half-flip per round, 300 ms, easing `cubic-bezier(.55, 0, .92, .55)`
  (gravity fall, hard stop)
- Landing: 1.6 px vertical shudder, 90 ms ease-out + soft clack (bandpass noise ~1.7 kHz, 50 ms)
- Round gap: 640 ms
- At 0.85× (shipping default): rest 1059 ms · stagger 106 ms · flip 353 ms · gap 753 ms
- The rail NEVER moves. Blank cards still flip (scoreboard honesty, keeps the clack rhythm).

### React Native implementation

RN-safe by construction: each card = two clipped halves + a flap doing `rotateX` 0 → −180°
(transform-origin: seam), `transform` + `opacity` only. Reanimated v3, no backdrop-filter,
no CSS 3D tricks beyond rotateX. Front face = old top half, back face = new bottom half
(pre-rotated 180°), `backfaceVisibility: hidden`.

## Where it plays

- Launch/splash, and at rest on home. **Never during a round.**
- Retro skin: lean into the machinery (brass rail, heavy seams, shudder up).
  Modern: same mechanism at a whisper.

## Never

- Never a line through the middle of the letters. If it can read as a strikethrough, it has failed.
- Never animate during gameplay.
- Never flatten to a plain grotesque wordmark ("corporate"). The rail and the hang are the identity.
- Don't add scripts casually — Devanagari and Bengali are load-bearing; guests are occasional.

## Production note

All SVGs are fully vector: letterforms are outlined paths from **Khand Bold** (no webfont
dependency), and the files carry a `viewBox` only — no fixed width/height — so they scale to any
size. Open `preview.html` for a quick proof sheet.
