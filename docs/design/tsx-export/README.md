# SABD — TSX Screens

React + TypeScript components for the locked Phase-1 design
(layout 3a · Martian Mono 4a · palette 5a · turn-7 Home refresh).

## Files

- `tokens.ts` — color/type/motion tokens. Import everywhere; no hardcoded values.
- `components/` — shared: `RekhaRail` (rail + burn timer + slots), `Keyboard`, `Chrome` (GlanceBar, HintBar).
- `HomeScreen.tsx` — topic select with per-topic background motifs + glowing card ratings.
- `RoundScreen.tsx` — fresh round (locked centered layout).
- `RoundHintScreen.tsx` — mid-round, Letters hint used.
- `SolveScreen.tsx` — solve ceremony (static mid-wave frame).
- `ResultWinScreen.tsx` / `ResultTimeoutScreen.tsx` — results.
- `VersusLobbyScreen.tsx` — 1v1 lobby.

## Setup

Fonts (index.html or CSS import):

```html
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Martian+Mono:wght@400;500;700&family=Instrument+Sans:wght@400;500;600&family=Tiro+Devanagari+Sanskrit&display=swap" rel="stylesheet">
```

No other dependencies — plain React, inline styles.

## Notes

- Screens are static snapshots of the mockups with example data; wire real
  state/handlers (Keyboard `onKey`, HintBar `onHint`, TopicCard `onSelect`).
- Motion specs (durations, easings, the solve ceremony, reduced-motion rules)
  are in `tokens.ts` + DESIGN-SYSTEM.md §5 — animations are not implemented here.
- `oklch()` colors require modern browsers (all evergreen browsers OK).
- Full spec: DESIGN-SYSTEM.md in the project.
