/**
 * Rev. 3 per-category theming (docs/new-design/tsx-export/themed/themeTokens.ts,
 * ported verbatim — same hues, same `acc()`/`ok()` formulas, same grounds). Gaming↔World
 * hues are swapped vs. the old rev-2 topicHues so gaming reads green. Only gaming keeps
 * the split-flap seam + scanlines — every other category's "signature" is its own
 * ground/slot-shape/ambient-motion combination, not a shared retro treatment.
 */
import type { TopicId } from '@sabd/contracts';
import { oklchToHex, oklchToHexA } from '../color.ts';

export const themedHues: Record<TopicId, number> = {
  gaming: 150,
  space: 255,
  music: 350,
  internet: 195,
  food: 75,
  world: 300,
};

/** `oklch(l c h [/ a])` → RN-safe hex, matching `themeTokens.ts`'s `ok()`. */
export function ok(l: number, c: number, h: number, a?: number): string {
  return a === undefined ? oklchToHex(l, c, h) : oklchToHexA(l, c, h, a);
}

export interface ThemedAccent {
  main: string;
  bright: string;
  glow: string;
  border: string;
  borderDim: string;
  hintBorder: string;
}

/** hue -> standard themed accent set (`acc()` in themeTokens.ts). */
export function acc(h: number): ThemedAccent {
  return {
    main: ok(0.77, 0.15, h),
    bright: ok(0.88, 0.15, h),
    glow: ok(0.77, 0.16, h, 0.8),
    border: ok(0.75, 0.14, h, 0.55),
    borderDim: ok(0.7, 0.12, h, 0.25),
    hintBorder: ok(0.75, 0.14, h, 0.4),
  };
}

/** Each category owns its canvas — not the shared retro ink. */
export const grounds: Record<TopicId, string> = {
  gaming: '#0B0908',
  space: '#070A14',
  music: '#0C070C',
  internet: '#04100F',
  food: '#140F08',
  world: '#0A0710',
};
