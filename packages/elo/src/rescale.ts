/**
 * Phase 4, PART A §2 / P4-T3 — difficulty re-scale (legacy Elo → unified).
 *
 * Legacy word `difficulty` lives on the retired Elo scale (800–2200) — a fossil that
 * means nothing on its own and is bridged to the player score only by a tier lookup.
 * The unified 3.0.0 scale re-scales difficulty to 0–500 so a word's difficulty MEANS
 * "the player score this word suits" (`serveBelow === maxRating`, see CONFIG_3_0_0).
 *
 * The transform is a MONOTONIC, piecewise-linear map anchored on the tier boundaries
 * so it preserves tier membership across the re-scale (edge-case F6):
 *
 *     legacy tier   legacy range   unified range   unified tier
 *     ───────────   ────────────   ─────────────   ────────────────
 *     low           [ 800,1200] →  [  0,150]       veryEasy ∪ easy   (≤150)
 *     mid           [1201,1600] →  [151,350]       medium            (151–350)
 *     high          [1601,2200] →  [351,500]       hard              (351–500)
 *
 * The segments are HALF-OPEN and boundary-safe: each tier above `low` starts one
 * rating past the legacy boundary and maps one unit past the unified band edge, so
 * rounding a rating that sits exactly on a seam can never spill it into a neighbour's
 * band (the naïve shared-endpoint map rounds legacy 1601 down onto 350 = medium). The
 * anchors {800,1200,1600,2200} still land on the 3.0.0 band edges {0,150,350,500}.
 * Legacy `low` splits across the two easiest tiers — both strictly easier than
 * `medium`, the intended cold-start win, not a violation. No exception list is needed;
 * `rescale.test.ts` sweeps every legacy rating and asserts membership holds.
 *
 * SCOPE: this is the pure numeric transform + its inverse anchors. Applying it to the
 * shipped bank (rewriting `difficulty`, stamping a `scale` marker on the bank, and
 * flipping `ENGINE_CONFIG_VERSION` to 3.0.0) is a gated content migration (Lane 2,
 * F7) that must not run until the `veryEasy` tier is stocked — otherwise score-0
 * players get the old cold-start against an empty band.
 */

/** The legacy Elo difficulty scale bounds — the whole shipped bank lives in here. */
export const LEGACY_SCALE = Object.freeze({ min: 800, lowMax: 1200, midMax: 1600, max: 2200 });

/** The unified scale anchors the legacy bounds map onto (3.0.0 band edges). */
export const UNIFIED_SCALE = Object.freeze({ min: 0, easyMax: 150, mediumMax: 350, max: 500 });

/** Linear interpolation of `x` from [inLo,inHi] onto [outLo,outHi]. */
function lerp(x: number, inLo: number, inHi: number, outLo: number, outHi: number): number {
  return outLo + ((x - inLo) / (inHi - inLo)) * (outHi - outLo);
}

/**
 * Map a legacy Elo difficulty (800–2200) to the unified 0–500 scale. Monotonic and
 * continuous; anchors land on 3.0.0 band edges so tier membership is preserved (F6).
 * Inputs outside the legacy range are clamped to it first. Result is rounded to an
 * integer (bank ratings are integers).
 */
export function rescaleLegacyDifficulty(legacy: number): number {
  const r = Math.min(LEGACY_SCALE.max, Math.max(LEGACY_SCALE.min, legacy));
  let unified: number;
  if (r <= LEGACY_SCALE.lowMax) {
    // low: [800, 1200] → [0, 150]
    unified = lerp(r, LEGACY_SCALE.min, LEGACY_SCALE.lowMax, UNIFIED_SCALE.min, UNIFIED_SCALE.easyMax);
  } else if (r <= LEGACY_SCALE.midMax) {
    // mid: [1201, 1600] → [151, 350] — half-open so a seam rating can't round into 'easy'
    unified = lerp(r, LEGACY_SCALE.lowMax + 1, LEGACY_SCALE.midMax, UNIFIED_SCALE.easyMax + 1, UNIFIED_SCALE.mediumMax);
  } else {
    // high: [1601, 2200] → [351, 500] — half-open so 1601 can't round down into 'medium'
    unified = lerp(r, LEGACY_SCALE.midMax + 1, LEGACY_SCALE.max, UNIFIED_SCALE.mediumMax + 1, UNIFIED_SCALE.max);
  }
  return Math.round(unified);
}
