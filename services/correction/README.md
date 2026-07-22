# @sabd/correction — word self-calibration (Phase-3 T15–T17)

Words learn their true difficulty from real solve rates. Weekly, human-in-the-loop:

```sh
# 1. Propose (aggregate real events → drift report + corrections.json)
pnpm --filter @sabd/correction propose -- --events=path/to/events.json

# 2. Review: open corrections.json, flip "approved" on tier-crossers you accept.

# 3. Apply → corrected bank JSON → content pipeline publish (bump version) → slice publish
pnpm --filter @sabd/correction apply -- --out=corrected-bank.json
```

Events input: a JSON array of `RoundEvent`s or an `ExportFile` — playtest
"Send my data" files and D1 dumps both work. D1 dump:
`npx wrangler d1 execute sabd-ingest --command "SELECT * FROM round_event" --json`
(or run the aggregation directly in SQL — event-log doc §7.3 has the query).

## The rules (Phase-4 P4-T7 — confidence-weighted)

- **Confidence-weighted, from 5 players.** Correction magnitude scales with sample
  size instead of a hard gate: `weight = min(1, uniquePlayers / 200)`, so 5 players
  move a word ~1–2 points and 200 move it decisively. `delta = weight · gain ·
  (target − observed)`.
- **Unique players, not attempts** (F8): one grinder replaying a word 40 times is
  one player's worth of signal — below the 5-player floor, nothing moves.
- **First attempts only** (F9): a retry after a fail has answer-adjacent knowledge;
  the signal is each player's FIRST attempt (`firstAttemptSolveRate`).
- **Slow**: nudges clamp to ±25 points per run (`maxNudge`), below a tier width so a
  word can't oscillate across a boundary (F10); a drifted word converges over weeks.
- **Unified-scale evidence only** (F11): pre-3.0.0 events (old 800–2200 ratings) are
  dropped before aggregating (`calibrationEvents`).
- **Confounding guard**: weight is further scaled by the spread of attempting
  players' scores — a word tried only by a narrow band gives weak evidence.
- **Direction**: observed solve rate vs the tier's target (`veryEasy 85% / easy 72% /
  medium 55% / hard 40%`). Over-solved → easier than rated → difficulty drops.
- **Tier crossings are never auto-applied.** difficulty → tier → base pay, so a
  crossing changes what future rounds pay — it's flagged for the human pass.
- **Tier-at-play is frozen** (P4-T8). Scoring always reads `wordRatingAtPlay` from the
  event; re-rating a word never moves a historical score (replay-tested).
  Calibration affects only future selection + future rounds' pay.

## The "cron"

A weekly local run of the three steps above (minutes, mostly the human review).
Automate later at zero cost as a GitHub Action on a schedule if the manual loop
gets old — the CLI is already non-interactive apart from the review edit.

## Tuning

`defaultCalibration` in `src/calibrate.ts`: `targetSolveRate`, `gain`, `saturation`,
`maxNudge`, `minPlayers`, `spreadRef`, `spreadFloor`. Validate targets against real
exports before trusting them — they're reasoned guesses until playtest data says
otherwise.
