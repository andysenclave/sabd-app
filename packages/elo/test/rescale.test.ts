/**
 * P4-T3 / edge-case F6 — the legacy→unified difficulty transform.
 *
 * Property under test: the monotonic re-scale PRESERVES tier membership. A legacy
 * `mid` word must land in unified `medium`; a legacy `high` in `hard`; a legacy `low`
 * in one of the two easiest tiers (veryEasy/easy) — never higher. Proven by sweeping
 * the entire legacy range (800–2200) at rating resolution.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bandForDifficulty,
  CONFIG_2_0_0,
  CONFIG_3_0_0,
  LEGACY_SCALE,
  rescaleLegacyDifficulty,
  UNIFIED_SCALE,
} from '../src/index.ts';

// Which unified tiers a given legacy tier is allowed to map into.
const ALLOWED: Record<string, ReadonlySet<string>> = {
  low: new Set(['veryEasy', 'easy']),
  mid: new Set(['medium']),
  high: new Set(['hard']),
};

test('anchors map exactly onto the 3.0.0 band edges', () => {
  assert.equal(rescaleLegacyDifficulty(LEGACY_SCALE.min), UNIFIED_SCALE.min); // 800  → 0
  assert.equal(rescaleLegacyDifficulty(LEGACY_SCALE.lowMax), UNIFIED_SCALE.easyMax); // 1200 → 150
  assert.equal(rescaleLegacyDifficulty(LEGACY_SCALE.midMax), UNIFIED_SCALE.mediumMax); // 1600 → 350
  assert.equal(rescaleLegacyDifficulty(LEGACY_SCALE.max), UNIFIED_SCALE.max); // 2200 → 500
});

test('the transform is monotonic non-decreasing across the whole legacy range', () => {
  let prev = -Infinity;
  for (let r = LEGACY_SCALE.min; r <= LEGACY_SCALE.max; r++) {
    const u = rescaleLegacyDifficulty(r);
    assert.ok(u >= prev, `not monotonic at ${r}: ${u} < ${prev}`);
    prev = u;
  }
});

test('F6 — tier membership is preserved for every legacy rating (no exceptions)', () => {
  for (let r = LEGACY_SCALE.min; r <= LEGACY_SCALE.max; r++) {
    const legacyTier = bandForDifficulty(r, CONFIG_2_0_0).tier;
    const unifiedTier = bandForDifficulty(rescaleLegacyDifficulty(r), CONFIG_3_0_0).tier;
    assert.ok(
      ALLOWED[legacyTier]!.has(unifiedTier),
      `rating ${r}: legacy '${legacyTier}' mapped to unified '${unifiedTier}' (not allowed)`,
    );
  }
});

test('out-of-range inputs clamp to the legacy bounds', () => {
  assert.equal(rescaleLegacyDifficulty(500), UNIFIED_SCALE.min); // below min → 0
  assert.equal(rescaleLegacyDifficulty(9999), UNIFIED_SCALE.max); // above max → 500
});

test('the result stays on the unified scale and is an integer', () => {
  for (let r = LEGACY_SCALE.min; r <= LEGACY_SCALE.max; r += 7) {
    const u = rescaleLegacyDifficulty(r);
    assert.ok(Number.isInteger(u));
    assert.ok(u >= UNIFIED_SCALE.min && u <= UNIFIED_SCALE.max);
  }
});
