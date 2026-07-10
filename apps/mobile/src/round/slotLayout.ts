/**
 * Slot sizing (T14) — the locked stress clamp from DESIGN-SYSTEM.md §4.
 *
 *   width = clamp(34, (screenWidth − 48) / n − gap, 52)
 *   gap:   8 → 5 as the word gets long
 *   glyph: 36 → 28 across the same range
 *   height: 58 (tap target stays ≥ 52); one row always, for 3–8 letters.
 */
export interface SlotMetrics {
  width: number;
  gap: number;
  glyph: number;
  height: number;
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export function slotMetrics(n: number, screenWidth: number): SlotMetrics {
  const gap = n <= 6 ? 8 : 5;
  const width = clamp(34, (screenWidth - 48) / n - gap, 52);
  // 36→28 ramp; short words get the full glyph, 8-letter words the smallest.
  const glyph = n <= 5 ? 36 : n === 6 ? 34 : n === 7 ? 31 : 28;
  return { width, gap, glyph, height: 58 };
}
