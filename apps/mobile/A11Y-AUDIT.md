# Sabd mobile — accessibility & stress audit (T24)

Full audit performed 2026-07-12 against every screen (`app/*.tsx`) and every
interactive component (`src/components/**`, `src/home/TopicCard.tsx`). 34 findings
total. Below: what was fixed immediately, what's deliberately deferred with a reason,
and the stress-test results (contrast, network, slot clamp at extremes).

## Fixed this pass

**Tap targets brought to the 44px minimum** (§6 rule): Home's settings gear and
Challenge row, onboarding's SKIP button, round's `EndBeat`/`TopicExhausted` CTAs, every
`Keyboard` key (via `minHeight` + `hitSlop`), and Settings' back button, link row,
and both export-dialog buttons. All now use `minHeight: 44` rather than a bare
`height: 44` so platform font-scaling can't shrink the effective target below it.

**Missing role/label:**
- `TopicExhausted`'s HOME button had no `accessibilityRole` at all — added.
- Home's Challenge row and Settings' Switch/back button had no explicit
  `accessibilityLabel` — added (`"Challenge a rival, coming soon"`, `"Haptics"`).
- `HintBar` labels are now state-aware: `"POSITION hint, already used"` vs.
  `"...unavailable"` vs. `"...costs 8 seconds"` — previously static regardless of
  spent/disabled state, which was actively misleading for a screen-reader user.
- `TopicCard` labels now include the actual state (`"...rating 1240"` /
  `"...not yet played"` / `"...coming soon"`) instead of just the topic name.

**Decorative glyphs hidden from the a11y tree** (`◆`, `◇`, `›`, the SABD wordmark SVG):
`importantForAccessibility="no"` / `accessible={false}`, so screen readers don't read
out Unicode glyph names as noise between real content.

**Grouped scattered text into single accessible nodes:** Home's rating block, the
round screen's glance bar, and onboarding's dot row now expose one combined label
(`"Rating 1240, 12 rounds played"`, `"Topic: Gaming, rating 1240"`,
`"Step 2 of 3"`) instead of 2-3 separate stops a screen reader has to piece together.

**The single biggest functional gap, fixed:** the custom keyboard has no backing
`TextInput`, so a screen-reader user previously got *zero* auditory feedback while
typing. `useRound` now calls `AccessibilityInfo.announceForAccessibility` on every
keystroke (`"T, letter 3 of 5"`), every backspace (`"Cleared letter 4"`), every wrong
guess (`"Not in the word. Try again."`), every hint reveal, and once when the round
ends (`"Solved. Rating +23, now 1223."` / `"Time's up. The word was GUILD..."`).
`SlotRow`'s individual slot children are now `importantForAccessibility="no-hide-descendants"`
so they can never surface as separate, confusing stops — the one grouped label +
these announcements are the whole story for a screen-reader user.

**Pressure haptic:** a warning-tier haptic now fires once, the moment the Rekha enters
its final 10 seconds — previously the only cue was a color shift + pulse, invisible to
low-vision/blind users.

**Settings' export dialog** now sets `accessibilityViewIsModal` on the overlay and
`importantForAccessibility="no-hide-descendants"` on the background content while
open, plus an announcement on open (`"Send my data dialog opened, 12 rounds"`). Not a
full RN `Modal` — see "Deferred" below for why.

## Deferred, with reasons (not silently dropped)

- **`ExportPreview` is a hand-rolled overlay, not RN's `Modal` component.** The cheap
  fix above (accessibilityViewIsModal + importantForAccessibility toggling) closes the
  worst of the gap — a screen reader can no longer swipe *through* the dialog into the
  obscured Settings screen — but a true `Modal` also gets automatic Android back-button
  handling and iOS focus containment for free. Converting is a real structural change
  (state lives in the parent, needs lifting or a portal) rather than a one-line fix;
  flagged for a follow-up pass, not done under this task's time budget.
- **8-letter words on a 320px-wide device.** The locked clamp formula
  (`clamp(34, (screenWidth−48)/n − gap, 52)`) computes to *exactly* 34px — the floor —
  at n=8 on a 360px reference screen, with zero slack. Math for a hypothetical 320px
  screen: raw width would be `(320−48)/8 − 5 = 29px`, clamped up to the 34px floor,
  making the total row width (`8×34 + 8×5 = 312px`) exceed the available 272px space.
  This needs a real narrow device (or simulator) to confirm whether it actually clips
  visually or whether `justifyContent:'center'` + horizontal scroll masks it — I don't
  have one in this environment. **Action for the owner:** test an 8-letter word on the
  smallest Android device available; if it clips, the fix is lowering the width floor
  or the screen-inset assumption for n≥7.
- **RekhaRail progress bar has no `accessibilityRole="progressbar"` / `accessibilityValue`.**
  Low priority — the text readout (`"0:52 remaining"`) already conveys the same
  information non-visually. Worth adding for VoiceOver rotor parity, not blocking.
- **Odometer has no live region.** The final rating is already exposed via the Δ text
  next to it and the round-end announcement above; the rolling animation itself has no
  independent accessible value, which is fine — nothing is lost, just not reinforced.

## Contrast — computed via the WCAG relative-luminance formula

| Pair | Ratio | AA normal (4.5:1) | AA large/bold (3:1) |
|---|---|---|---|
| `paper` #E9EAF2 / `ink` #171A24 | 14.48:1 | Pass (AAA too) | Pass |
| `paperDim` #8B8FA3 / `ink` #171A24 | 5.42:1 | Pass (thin margin above 4.5) | Pass |
| `signal` #E4573D / `ink` #171A24 | 4.74:1 | Pass (thin margin) | Pass |
| `kesar` #F2A33C / `ink` #171A24 | 8.33:1 | Pass (AAA too) | Pass |
| `signal` #E4573D / `ink2` #222634 (SlotRow "wrong" glyph) | 4.11:1 | **Fails** | Pass (glyphs are 28-36px, qualifies as large text) |

Nothing here is a defect at current sizes, but `signal`-on-`ink2` is fragile: it only
clears WCAG because the slot glyph is large. **Do not reduce slot glyph size below
~24px in any future redesign without re-checking this pair.**

## Network — confirmed zero calls (airplane-mode requirement)

`grep -rn "fetch(\|axios\|XMLHttpRequest\|http://\|https://"` across `src/` and `app/`
returns nothing except an inert XML namespace string in `Logo.tsx`
(`xmlns="http://www.w3.org/2000/svg"` — SVG boilerplate, not a request). "Send my
data" uses `expo-file-system` (write local file) + `expo-sharing` (native OS share
sheet) — never an HTTP client. **The app makes zero network calls anywhere in its own
code**, confirmed by source inspection.

## Slot clamp — 3 and 8 letters at the 360pt reference width

| n | gap | glyph | width (raw → clamped) | height | row total |
|---|---|---|---|---|---|
| 3 | 8px | 36px | 96.0 → **52px** (max clamp) | 58px | 180px |
| 8 | 5px | 28px | 34.0 → **34px** (min clamp, exact) | 58px | 312px |

Both land correctly inside the locked [34, 52] bounds at the reference width; glyph
sizes match `type.slotGlyphMax`/`Min`; height (58px) clears the 52px tap minimum. The
n=8 case has **zero slack** at exactly 360px — see "Deferred" above for the narrower-
device risk this implies.

## Android hardware back / edge-swipe mid-round

Fixed as a separate priority bug this session (not originally part of this audit):
the abandon-confirmation flow used a manual `beforeRemove` listener, which
react-navigation's own runtime warning names as unreliable under native-stack.
Replaced with `usePreventRemove`. Compiles and runs clean; **true native back-gesture
behavior still needs an on-device confirmation** since it doesn't reproduce in a web
preview — recommended smoke test: start a round, background it, resume, then hit the
hardware back button and confirm the abandon dialog appears exactly once.

## Reduced motion

`useReducedMotion` (wired into `RekhaRail`, `LetterChips`, the splash flip, and the
round machine) already routes every animated element to the DESIGN-SYSTEM §5 rule:
translations → fades, the odometer → crossfade (no roll), the ember pulse stops, but
the Rekha burn itself stays (it's information, not decoration). Verified by code
inspection; not device-tested with the OS setting actually toggled on.
