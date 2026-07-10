# Sabd — Playtest Analysis (5–10 Friends, No Backend, No SDK)

> **Project: Sabd** (शब्द — "word").
>
> **What this is:** a script that eats the JSON files your friends send you (via the
> **Send my data** button, `sabd-event-log-and-sync.md` §8) and prints the handful of numbers
> that should change what you build next.
>
> **What this replaces:** an analytics SDK. You don't need one. See §0.

---

## 0. Why there is no analytics SDK

**Analytics exists to tell you about people you cannot talk to.** You can talk to all of them.

| You wanted to know | Cheaper answer |
|---|---|
| How many installs? | You sent the links. Count them. |
| How long do people play? | Text them. You'll also learn *why they stopped* — which is the actual question. |
| Which categories are best? | Ask. Ten answers. |

An SDK would cost you: a vendor, a dashboard, **tracking disclosures on both app stores**, and a
hole punched straight through the clean minimal-data + contextual-consent story from the event
log doc. Most SDKs collect device identifiers by default.

And at **n=10, every metric is noise.** *"Gaming has a 40% higher completion rate"* means four
people liked Gaming. That is not a signal. Worse — a number **feels** authoritative in a way
*"Rahul said the hints felt stingy"* doesn't, so you'll trust the dashboard over the
conversation. **The conversation is the better data.**

**You already have the analytics: it's the event log.** Every round is in SQLite with
`topic`, `solved`, `time_used_sec`, `hints_used`, `word_id`, `played_at`. The export button
hands you all of it. Zero new infrastructure. Already covered by the consent flow you built.

**The one thing the log can't tell you:** who installed and never played — they leave no rounds.
That's also the most important number on your list. **No SDK will tell you *why*. Only a text
message will.**

**When an SDK becomes right:** hundreds of users, people you can't reach, funnel drop-offs you
can't observe. That moment is real and it will come. It is not now.

---

## 1. The rule for this script

**Every output must change a decision.** If a number wouldn't make you build differently, don't
print it. A dashboard of vanity metrics is worse than no dashboard, because you'll read it.

Each section below names the **decision** it informs.

---

## 2. Input

```
exports/
  rahul-2026-07-12.json
  priya-2026-07-12.json
  …
```

Each file is what `export.ts` emits: `{ installId, schemaVersion, exportedAt, rounds: RoundEvent[] }`.

**Treat `installId` as a pseudonym.** Map it to a friend's name in a local, gitignored
`names.json` if you like — but never commit it, and never put it in output you share.

---

## 3. The questions worth answering

### 3.1 Is the round fun? → **rounds per session**

**Decision it informs:** whether the core loop works *at all*. Nothing else matters if this is bad.

Group rounds into sessions (gap > 10 min = new session). Then:

```
Sessions:            n
Rounds per session:  median, p25, p75, max
Sessions per person: median
```

**Read it like this:**
- Median **1–2 rounds** → they tried it and left. The loop is not compelling. **Stop. Fix this before anything else.**
- Median **5–8** → healthy. People are choosing to play again.
- Someone with a **15-round session** → find out what happened. That's your best signal in the whole dataset. **Call them.**

A completion rate cannot tell you this. Rounds-per-session can.

### 3.2 Is the hint economy right? → **the most important number here**

**Decision it informs:** hint costs (`position: 8s`, `letters: 5s`) and word difficulty seeding.

```
Rounds with 0 hints:   %
Rounds with 1 hint:    %   (split: position-only / letters-only)
Rounds with 2 hints:   %

Solve rate | 0 hints:  %
Solve rate | 1 hint:   %
Solve rate | 2 hints:  %
```

**Read it like this:**

| Pattern | Means | Do |
|---|---|---|
| **>70% use zero hints** | Hints too expensive, or words too easy | Lower costs, or raise word difficulty |
| **>70% use both hints** | Hints too cheap, or words too hard | Raise costs, or lower difficulty |
| **`letters` used, `position` almost never** | One hint is dominant; the other is decoration | Rebalance costs — this is a **design bug** |
| **2-hint solve rate ≈ 0-hint solve rate** | Hints aren't actually helping | The hints are wrong, not the prices |
| **Healthy** | ~40/40/20 across 0/1/2 | Leave it alone |

The dominant-hint check is the one people miss. If nobody ever taps `position`, you built a
button, not a mechanic.

### 3.3 Is 60 seconds right? → **time-to-solve distribution**

**Decision it informs:** `timeLimitSec`. Currently 60.

```
On SOLVED rounds only:
  time_used_sec: median, p25, p75, p90
  histogram, 5-second buckets

Timeout rate: %
```

**Read it like this:**
- Solves cluster at **10–20s** → 60s is generous. There's no tension. **Consider 45s.**
- Solves cluster at **50–58s** → brutal. People are scraping through. **Consider 75s**, or easier words.
- **Healthy:** median ~25–35s, a real spread, **timeout rate 15–30%.** Some failure is what makes
  the solve feel earned. **A 2% timeout rate means the game is too easy**, not that it's good.

### 3.4 Are the seeded word ratings sane? → **the manual correction loop**

**Decision it informs:** which words to re-rate before the next `eas update`.

```
Per word (all players pooled):
  attempts, solve_rate, avg_clock_used, avg_hints, seeded_difficulty
```

Flag the outliers:
- **Low-rated word (<1200) with solve rate <50%** → under-rated. Raise it.
- **High-rated word (>1600) with solve rate >85%** → over-rated. Lower it.
- **Any word with avg_hints ≈ 2.0** → too hard, or its `description` is too oblique.
- **Any word with solve rate 100% and fast times** → too easy for its tier.

> ⚠️ **Hard gate: do not auto-adjust anything.** The event-log doc sets the bar at **≥30 attempts
> per word** before correction means anything. With five friends you'll have 1–3 attempts per
> word. **This section produces a shortlist for your eyeballs, not a correction.** Adjusting a
> rating on n=2 is fitting noise, and it's worse than leaving the seed alone.

What this section *is* good for: catching **obviously broken words** — a clue that gives it away,
a word nobody has heard of, a bad decoy. Those show up at n=2 just fine.

### 3.5 Topics: chosen ≠ enjoyed

**Decision it informs:** which topic banks to expand first; whether a topic is mis-calibrated.

```
Per topic:  rounds_played, unique_players, solve_rate, avg_hints, median_time
```

The interesting split: a topic can be **picked often and finished rarely.** Someone loves Gaming
and times out constantly — that's not a topic problem, it's a *difficulty seeding* problem inside
that topic. Don't confuse "unpopular" with "too hard."

Also: with 6 topics and ~8 players, expect **most topics to have <20 rounds.** Report the counts
next to every rate so you can see how thin the data is. **Never print a percentage without its n.**

### 3.6 Who never played

Not in the data. That's the point.

```
Sent the APK to:   10
Sent you a JSON:    6
Played ≥1 round:    6
Played ≥5 rounds:   3
```

Track this **by hand, in a text file.** The four people who installed and never played are the
most valuable people in the study. **Text them. Ask why.** No log will ever tell you.

---

## 4. The script

Node, zero dependencies. Reads a folder, prints a report.

```
scripts/analyze-playtests/
  index.ts        # CLI: node analyze exports/
  load.ts         # read + validate JSON, check schemaVersion, dedupe by roundId
  sessions.ts     # group rounds into sessions (10-min gap)
  report/
    loop.ts       # §3.1 rounds per session
    hints.ts      # §3.2 hint economy
    timing.ts     # §3.3 time-to-solve distribution
    words.ts      # §3.4 per-word outlier shortlist
    topics.ts     # §3.5 per-topic breakdown
  format.ts       # plain text tables to stdout. No charts. No HTML.
```

**Requirements:**
1. **Dedupe by `roundId`** across files. Someone will export twice.
2. **Refuse to mix `schemaVersion`s** without an explicit `--force`. Say which files disagree.
3. **Print `n` next to every rate.** `solve_rate: 62% (n=13)` — never a bare percentage.
4. **Suppress any statistic where n < 5.** Print `insufficient data (n=3)` instead. Be strict
   about this; it's the whole discipline of small-n analysis.
5. **Never print `installId`s** in output. Pseudonymise to `player_1`, `player_2`.
6. **`--word-shortlist`** flag → emits just the §3.4 outlier list as JSON, ready for hand-editing
   the word bank.
7. Output is **plain text to stdout.** Resist building a dashboard. You will read it five times
   total.

---

## 5. What to do with the output

In order:

1. **Read §3.1 first.** If rounds-per-session is 1–2, **nothing else in the report matters.** The
   loop is broken. Go talk to people.
2. **Then §3.2.** The hint economy is your most tunable lever and it's pure JS — ship a fix via
   `eas update` in seconds.
3. **Then §3.3.** `timeLimitSec` is one number in `config.ts`.
4. **§3.4 and §3.5 are shortlists**, not conclusions. Eyeball them. Fix the obviously broken words.
5. **Then put the report down and text your friends.** The report tells you *what* happened. Only
   they can tell you *why*.

**The report is a prompt for conversations, not a substitute for them.**

---

## 6. Build tasks

1. Scaffold `scripts/analyze-playtests/` in the monorepo (Node + TS, no deps).
2. `load.ts` — parse, validate against `schemaVersion`, dedupe by `roundId`, pseudonymise.
3. `sessions.ts` — 10-minute gap rule. Make the gap a constant; you'll want to tune it.
4. The five report modules (§3.1–3.5). Each prints a small plain-text table.
5. **Enforce the n<5 suppression rule globally**, in `format.ts`, not per-module. It must be
   impossible to accidentally print a percentage on n=2.
6. `--word-shortlist` → JSON out.
7. **Tests:** dedupe works · mixed schema versions are rejected · n<5 suppression fires ·
   session grouping handles a round exactly at the 10-min boundary.

**Do NOT build:** a dashboard, an HTML report, charts, a database, an upload endpoint, or an
analytics SDK. Plain text, five files, one command.

---

## 7. The honest summary

You have 5–10 friends and a complete event log of everything they did. That is a **better dataset
than most funded startups have at launch**, and it needs no infrastructure whatsoever.

The temptation is to build a pipeline. Resist it. The script above is an afternoon, answers every
question you actually asked, and leaves your privacy story and your store listings clean.

**And the single most valuable thing you'll learn this month will arrive as a WhatsApp message,
not a metric.**
