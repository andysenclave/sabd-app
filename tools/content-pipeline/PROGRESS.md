# Sabd Content Pipeline — Progress

**Status:** First session goal COMPLETE — final: 60 passed / 0 rejected / 0 review (after human review of 9 flagged entries; pre-review validator result was 51 passed / 0 rejected / 9 review)
**Last updated:** 2026-07-08 20:06 IST

## Build tasks (§7)

- [x] Project scaffold — package.json, /src, /data/raw, /data/clean, /data/reports
- [x] data/words.txt wordlist (npm `word-list` v4, MIT, ~274k words, SCOWL-derived; source documented in README)
- [x] src/dict.js — wordlist lookup + cached dictionaryapi.dev fallback (graceful offline degrade, `--no-api` flag; cache at data/.dict-cache.json)
- [x] src/validate.js — all §6 rules, report JSON, human summary, passed/rejected/review split, non-zero exit on hard fails
- [x] src/merge.js — per-topic merge, cross-batch dedupe, id re-sequence, sabd-wordbank.json + stats.json
- [x] README — full workflow (generate → drop raw → validate → review → merge)

## First session goal (§8)

- [x] Generated GAM batch of 60 (24 low / 24 mid / 12 high) → data/raw/GAM-batch1.json
- [x] Ran validator; report at data/reports/GAM-batch1-report.json
- [x] Validator self-tested against a deliberately broken 15-entry fixture — all 12 hard-rule categories fired (word-format, length-mismatch, tier-invalid, difficulty-band, position-index, position-letter, letters-correct, letters-decoy, description-length, description-leak, id-malformed/duplicate, word-duplicate), tier-split flagged OFF, exit code 1. Fixture deleted after.
- [x] Fixed flagged content, re-ran to clean set, merged → data/clean/sabd-wordbank.json (60 entries)

## Error patterns observed in the generated batch (tuning signal)

The batch had **zero mechanical hard failures** (no position/letter mismatches, no
in-word decoys, no length/band errors). The predicted §8 failure modes did not appear
in this hand-authored batch — expect them to show up with real LLM-generated batches;
the validator self-test proves they will be caught.

What DID get flagged (all soft, 13 flags on 60 entries):

1. **Dictionary misses on legit gaming jargon (12 words, biggest category).**
   - 6 rescued by the dictionaryapi.dev fallback: RESPAWN, NERF, ESPORTS, SPEEDRUN, GANK.
   - 7 missed by BOTH sources → review bucket: LOADOUT, HITBOX, SMURF, NETCODE,
     TICKRATE, MINMAX, TRYHARD. All are established gaming terms → human-approved to
     passed. This confirms routing wordlist misses to `review` (not `rejected`) was
     the right call — a hard-fail rule would have wrongly killed ~12% of the batch.
2. **Description quality flags (3).**
   - FARMING "Harvesting monsters, not crops" — rightly flagged too-short/literal
     (4 words); rewrote in raw to "Reaping the same monsters until the coffers fill".
   - RESPAWN ("Death **is a** suggestion…") and RELOAD ("…**means** it's time") —
     false positives of the definitional-phrase heuristic; descriptions are indirect.
     Kept the heuristic conservative on purpose (brief: description quality is the #1
     lever, surface for human eyes) and approved both in review.

## Notes / open questions

- Validator rule tuning needed: none were buggy; the definitional heuristic
  (`is a`, `means`, `refers to`, `type of`, plus ≤4-word descriptions) over-triggers
  slightly by design. Revisit if the review bucket gets noisy at scale.
- Review workflow used: approved entries were moved from `-review.json` into
  `-passed.json` (documented in README §4). Note: re-running validate.js on the raw
  batch regenerates the buckets, which un-does review approvals — approve after the
  final validation run, or consider a persistent `-approved.json` overlay later.
- dictionaryapi.dev cache lives at data/.dict-cache.json (12 words cached this session).
- Deliberate deviations from brief: none. Judgment calls: ALL dictionary misses route
  to review (can't mechanically tell jargon from gibberish); topic-name and id-prefix
  consistency validated as extra hard rules (topic-invalid / id prefix match).
- Not done yet (future sessions): batches 2–3 for GAM; all batches for SPC, MUS, NET,
  FUD, WLD.
