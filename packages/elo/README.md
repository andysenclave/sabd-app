# @sabd/elo — the Sabd scoring engine (monotonic points)

> **Naming note:** the package keeps its historical name `@sabd/elo`, but the Elo rating
> engine (seed 1200, bidirectional) shipped **replaced** on 2026-07-13 by engine `2.0.0` —
> a **monotonic points model**. The authoritative description is
> `docs/SCORING-HANDOFF.md`; this README is the package-level summary.

Pure, standalone, framework-agnostic TypeScript module — no UI, no network, no database,
**zero runtime dependencies**, ESM, fully deterministic (no I/O, no globals, no
`Date.now()`, no randomness — time comes in via `RoundResult`).

## The model

The score is a **monotonic point total**. Every player and every category starts at **0**.

- A **solve** earns `max(minSolvePoints, tierBase + speedBonus − hintPenalty)` plus an
  escalating **streak bonus** (`+2, +4, +6…` capped at `+20`).
- A **miss** (timeout or abandon) earns **0** and resets the streak. The score never drops.
- The score picks the **difficulty tier** of words served (`tierForScore`): `< 100 → low`,
  `< 300 → mid`, `else → high`. Because the score only climbs, earned difficulty never
  regresses — a broken streak costs the bonus, not the level.

One signal (score) drives difficulty; one (streak) drives reward — they never cross.

## Public API

```ts
import {
  applyPoints,           // (playerState, result, config?) => RatingUpdate
  tierForScore,          // (score, config?) => 'low' | 'mid' | 'high' — selection tier
  tierForDifficulty,     // (difficulty, config?) => WordTier — a word's tier from its rating
  countPaidHints,        // (result) => 0 | 1 | 2
  defaultConfig,         // every tunable (PointsConfig)
  ENGINE_CONFIG_VERSION, // stamped on every RoundEvent — bump on ANY tunable change
} from '@sabd/elo';
```

`PlayerState` is `{ rating, streak }`; `RatingUpdate` is
`{ delta, newPlayerRating, streak, breakdown: { tierBase, speedBonus, hintPenalty, streakBonus } }`
with `delta ≥ 0` always (exactly 0 on a miss). Shared shapes (`RoundResult`,
`RatingUpdate`, `WordEntry`) implement `@sabd/contracts` verbatim.

## Formula (engine 2.0.0)

```
miss:  delta = 0, streak → 0                             // score unchanged, always
solve: tier        = tierForDifficulty(word.difficulty)  // bands: ≤1200 low, ≤1600 mid, else high
       tierBase    = { low: 10, mid: 20, high: 30 }[tier]
       speedBonus  = round(10 × (1 − timeUsed/timeLimit))
       hintPenalty = −3 × paidHintsUsed                   // max 2 paid hints ⇒ −6
       solvePoints = max(5, tierBase + speedBonus + hintPenalty)
       streakBonus = min(20, 2 × (newStreak − 1))
       delta       = solvePoints + streakBonus
```

Worked examples live in `docs/SCORING-HANDOFF.md` §3.

## Tuning

Every knob lives in `src/config.ts` (`PointsConfig`); every engine function accepts an
override, so playtest tuning never touches the math. A rebalance is pure JS → ships
over-the-air via `eas update`. **Bump `ENGINE_CONFIG_VERSION` whenever a default
changes** — replay warns on mismatch.

| Constant | Default | Meaning |
|---|---|---|
| `tierBase` | `{low: 10, mid: 20, high: 30}` | Base pay per word tier |
| `speedBonusMax` | 10 | Instant-solve bonus, scales to 0 at the buzzer |
| `hintPenaltyPerHint` | 3 | Per paid hint (max 2) |
| `minSolvePoints` | 5 | A solve always pays at least this |
| `streakStep` | 2 | Bonus escalation per consecutive solve |
| `streakBonusMax` | 20 | Streak bonus cap |
| `tierThresholds` | `{mid: 100, high: 300}` | Score → served tier (the ramp; most tuning-likely) |
| `tierBands` | `{lowMax: 1200, midMax: 1600}` | Word difficulty → tier (mirrors content pipeline) |

Symptom → knob: slow ramp → lower `tierThresholds` · too-fast ramp → raise them ·
streak not worth chasing → `streakStep`/`streakBonusMax` · hints mispriced →
`hintPenaltyPerHint`.

## Replay is the truth

The score is never stored authoritatively — it is `reduce(applyPoints)` over the
append-only event log (`RoundEvent`, schema v1, LOCKED), from 0, folding only rounds
after the scoring epoch. Client and server run this same package over the same events
and must get the same number; that property is the anti-cheat foundation. Scoring uses
`wordRatingAtPlay` from the event — never a word's *current* (re-calibrated) difficulty —
so historical scores never shift when words re-rate (Phase-3 T16 freeze rule).

## What was removed with Elo (do not reintroduce)

`expectedScore` · `kFactor` · `computePerformance` · `applyResult` · `updateWordRating`
(returns in Phase 3 as a *server-side* job, not an engine export) · the ±band/form-lean
selection · the 1200 seed · any falling rating. 1v1/Challenge scoring lost its Elo
foundation and needs its own design before it ships (`recordRound` still rejects
challenge rounds under schema v1).

## Development

Requires Node >= 23.6 (tests run `.ts` directly via native type stripping).

```sh
pnpm install         # dev deps only: typescript, @types/node
pnpm test            # node:test — zero runtime deps
pnpm typecheck       # tsc --noEmit
pnpm worked-example  # print a points table for sample rounds
```
