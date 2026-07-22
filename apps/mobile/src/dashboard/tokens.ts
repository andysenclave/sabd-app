/**
 * Profile-hub design tokens — the MODERN INDIGO-INK skin (dashboards spec 13a–13d).
 *
 * Deliberately its own palette, NOT the retro `t.colors`: the game screens ship the
 * brass-monochrome retro skin, but the profile hub is the indigo/kesar, points-only
 * identity layer with per-category color back (rev-3). Hex values are the spec's
 * "Shared foundations"; category accents reuse the locked oklch wheel already ported
 * to RN-safe hex in themedTokens (`acc`/`ok`) — same hues, same lightness/chroma.
 *
 * Device note (memory: OKLCH low-alpha fills can read invisible on real OLED): every
 * translucent fill here is paired with a solid hairline/border that carries the shape,
 * so a fill that dims out on a phone never leaves an element undefined.
 */

import type { TopicId } from '@sabd/contracts';
import { ok, themedHues } from '../theme/themed/themedTokens.ts';

/** Ground / surface / ink — the indigo-ink foundation (spec "Shared foundations"). */
export const dash = {
  ground: '#0E1017',
  card: '#171A24',
  inset: '#1B1F2A',
  hairline: 'rgba(233,234,242,0.08)',
  rowFill: 'rgba(233,234,242,0.06)',
  ink: '#E9EAF2',
  ink2: '#C9CDDB',
  inkDim: '#8B8FA3',
  inkTertiary: '#6E7284',
  inkFaint: '#4A4E5C',
  /** Kesar (brand amber) — reserved for the global total, streak, and own-identity. */
  kesar: '#F2A33C',
  kesarGlow: 'rgba(242,163,60,0.5)',
  kesarFill: 'rgba(242,163,60,0.10)',
  kesarBorder: 'rgba(242,163,60,0.28)',
} as const;

/** One category's accent roles on the locked oklch wheel (spec §"Category accents"). */
export interface DashAccent {
  hue: number;
  /** Bar / dot fill. */
  main: string;
  /** The bright score number. */
  bright: string;
  /** Category label. */
  label: string;
  /** 7-day gain marker. */
  gain: string;
  /** Glow color (use sparingly — see RadialGlow, not animated textShadow). */
  glow: string;
  /** Very-low-alpha fill for the "gap" card (paired with `border`). */
  softFill: string;
  border: string;
}

export function dashAccent(hue: number): DashAccent {
  return {
    hue,
    main: ok(0.77, 0.15, hue),
    bright: ok(0.88, 0.15, hue),
    label: ok(0.82, 0.14, hue),
    gain: ok(0.82, 0.13, hue),
    glow: ok(0.77, 0.16, hue, 0.7),
    softFill: ok(0.77, 0.15, hue, 0.09),
    border: ok(0.75, 0.14, hue, 0.32),
  };
}

/** Accent for a topic id (the canonical hue map — gaming 150 … food 75). */
export function accentFor(id: TopicId): DashAccent {
  return dashAccent(themedHues[id]);
}

/** Group-separator dot color, medal tints (leaderboard). */
export const medals: Record<number, string> = { 1: '#F2A33C', 2: '#C9CDDB', 3: '#B08A55' };

/** Thousands-separated integer, matching the mockups' `17,470`. */
export function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}
