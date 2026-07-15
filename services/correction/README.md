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

## The rules (architect Lane 5)

- **Noise floor**: `< 30` attempts → never re-rated. Five testers' vocabularies are
  not a word's difficulty.
- **Slow**: nudges clamp to ±50 rating points per run (`maxNudge`); a drifted word
  converges over several weeks.
- **Direction**: observed solve rate vs the tier's target (`low 80% / mid 60% /
  high 40%`). Over-solved → easier than rated → difficulty drops. (Points-era
  redesign: the Elo-side `updateWordRating` formula died with `expectedScore`.)
- **Tier crossings are never auto-applied.** difficulty → tier → base pay, so a
  crossing changes what future rounds pay — it's flagged for the human pass.
- **Tier-at-play is frozen.** Scoring always reads `wordRatingAtPlay` from the
  event; re-rating a word never moves a historical score (replay-tested).
  Calibration affects only future selection + future rounds' pay.

## The "cron"

A weekly local run of the three steps above (minutes, mostly the human review).
Automate later at zero cost as a GitHub Action on a schedule if the manual loop
gets old — the CLI is already non-interactive apart from the review edit.

## Tuning

`defaultCalibration` in `src/calibrate.ts`: `targetSolveRate`, `gain`, `maxNudge`,
`noiseFloor`. Validate targets against real exports before trusting them —
they're reasoned guesses until playtest data says otherwise.
