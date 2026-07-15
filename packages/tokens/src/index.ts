/**
 * @sabd/tokens — the design tokens, from docs/design/DESIGN-SYSTEM.md (rev. 2).
 *
 * Framework-agnostic: plain typed values, no React/RN types. Both apps import these.
 * Where any other document disagrees, DESIGN-SYSTEM.md rev. 2 + LOGO.md win.
 *
 * DoD (T5): values match the design doc exactly.
 */

import type { TopicId } from '@sabd/contracts';

// ─── Color (LOCKED — mockup 5a) ──────────────────────────────────────────────

export const colors = {
  /** Ground. Indigo-ink — never neutral black. */
  ink: '#171A24',
  /** Raised surfaces: slots (filled), keys, chips, hint buttons. */
  ink2: '#222634',
  /** Primary text/glyphs. Cool white — never cream. */
  paper: '#E9EAF2',
  /** Description, secondary UI, spent states. */
  paperDim: '#8B8FA3',
  /** Brand amber (unified with logo rail): wordmark rail, rating ◆, primary CTA, +Δ. */
  kesar: '#F2A33C',
  /** Timer-critical (<10s) + wrong-guess only. Never decorative. */
  signal: '#E4573D',

  /**
   * Semantic "submit / go" (FB-002, Phase-3 design 2026-07-15). FIXED across all
   * topics & skins, like `signal` — never remapped per topic. oklch(0.58 0.14 165):
   * deeper + cooler than the Gaming topic accent oklch(0.77 0.15 150) so the two
   * never blur on a Gaming round. Used on the keyboard's Enter key.
   */
  confirm: '#0E9268',
  /** Inset bottom edge of a confirm control (physical key depth). oklch(0.40 0.10 165). */
  confirmEdge: '#085C42',

  /** Empty slot fill. */
  slotEmpty: 'rgba(233,234,242,.04)',
  /** Focused slot fill (+ accent stub). */
  slotFocused: 'rgba(233,234,242,.06)',
  /** Rekha (rail) track. */
  railTrack: 'rgba(233,234,242,.12)',
} as const;

// ─── Per-topic accent ────────────────────────────────────────────────────────
// All six share oklch L 0.75 / C 0.13 — hue only moves. Swapped at round start.

export const topicHues: Record<TopicId, number> = {
  gaming: 300,
  space: 250,
  music: 345,
  internet: 195,
  food: 70, // kesar's hue
  world: 150,
} as const;

/** Fixed chroma/lightness for every accent. */
export const ACCENT_L = 0.75;
export const ACCENT_C = 0.13;

/** Build an accent color for a hue, optionally with alpha and a lightness override. */
export const accent = (hue: number, alpha?: number, l: number = ACCENT_L): string =>
  alpha === undefined
    ? `oklch(${l} ${ACCENT_C} ${hue})`
    : `oklch(${l} ${ACCENT_C} ${hue} / ${alpha})`;

/** Accent for a topic id (convenience). */
export const topicAccent = (topic: TopicId, alpha?: number, l?: number): string =>
  accent(topicHues[topic], alpha, l);

// ─── Type ────────────────────────────────────────────────────────────────────

export const fonts = {
  /** Wordmark, PLAY CTA label, retro card faces (700 / 600 secondary). */
  brand: 'Khand',
  /** Slot glyphs, keyboard, timer, rating, chips, small labels. Tabular numerals. */
  mono: 'Martian Mono',
  /** Topic names, verdicts (SOLVED / TIME.). Expanded, wdth ~118–125. */
  display: 'Archivo',
  /** Descriptions, meta, helper text. */
  body: 'Instrument Sans',
  /** शब्द mark only, never UI text. */
  devanagari: 'Tiro Devanagari Sanskrit',
  /** Bengali splash flip only. */
  bengali: 'Hind Siliguri',
} as const;

/** Mobile type scale (px), from §3. Numerals always Martian (tabular). */
export const type = {
  slotGlyphMin: 28,
  slotGlyphMax: 36,
  ratingHeroMin: 40,
  ratingHeroMax: 56,
  verdictMin: 24,
  verdictMax: 32,
  description: 15,
  /** Minimum UI text. */
  uiMin: 13,
  /** 11px only for letterspaced mono labels. */
  monoLabelMin: 11,
  keyboard: 13,
} as const;

// ─── Layout / spacing / radii (§4, §6) ───────────────────────────────────────

export const spacing = {
  /** Slot gap (stress case tightens to 5). */
  slotGap: 8,
  slotGapMin: 5,
  /** Total horizontal screen inset used by the slot clamp ((100vw − 48)/n). */
  screenInset: 48,
  /** 390px is the layout reference width. */
  referenceWidth: 390,
} as const;

export const radii = {
  /** Slots hang from the rail: square top, rounded bottom. */
  slot: { topLeft: 0, topRight: 0, bottomRight: 8, bottomLeft: 8 },
  /** Default surface radius (cards/keys/chips). Retro drops this to 4. */
  surface: 12,
  retroSurface: 4,
} as const;

/** Slot sizing (§4). 5-letter reference + the locked stress clamp for 3–8 letters. */
export const slot = {
  refWidth: 48,
  refHeight: 58,
  /** clamp(min, (100vw − screenInset)/n − gap, max). */
  clampMinWidth: 34,
  clampMaxWidth: 52,
  minTapHeight: 52,
} as const;

/** Minimum tap targets (§6). One primary (kesar) CTA per screen, max. */
export const tap = {
  min: 44,
  hintBar: 48,
  slotHeight: 52,
  primaryCta: 56,
} as const;

export const home = {
  /** Topic grid is 2×3, cards ≥150px, stretch to fill. */
  minCardSize: 150,
  /** Scattered glyph wallpaper opacity range (not illustration). */
  cardGlyphOpacity: { min: 0.08, max: 0.15 },
  /** Card rating glow. */
  ratingGlow: '0 0 16px',
} as const;

// ─── Motion (§5) ─────────────────────────────────────────────────────────────

/** Three durations (ms). */
export const duration = {
  fast: 120, // typing, wrong-guess shake
  beat: 260, // hint reveals, chip stagger base
  ceremony: 700, // solve flash + odometer roll
} as const;

/** Two easings. */
export const easing = {
  snap: 'cubic-bezier(.2,.9,.3,1)',
  settle: 'ease-out',
} as const;

/** Named motion specifics called out in §5 (data only — the app owns the animation). */
export const motion = {
  typeGlyphDropPx: 8,
  railDipPx: 1,
  positionHintDropPx: 24,
  chipStaggerMs: 30,
  wrongShakePx: 4,
  wrongShakeCount: 3,
  pressureThresholdSec: 10,
  emberPulsePx: 1,
  softTickUnderSec: 5,
  waveFlipStaggerMs: 60,
} as const;

// ─── Retro skin (LOCKED — mockups 9b/9c) — token remap, data only ────────────

export const retro = {
  ground: '#0B0908', // warm black
  // Mockup value was #161310 — barely distinguishable from `ground` on a real phone
  // (owner-verified on-device, 2026-07-11: "card backgrounds are not properly
  // visible... the dark is too dark"). Brightened for contrast; still reads as
  // "warm black on warm black," just with enough separation to actually see the edge.
  surface: '#241F17', // flap-card charcoal
  text: '#F0E6CC', // cream ink
  dim: '#8F8672', // warm dim
  brass: '#C98A2B', // rail / accent
  brassUnderside: '#6E4A12', // 2px rail underside (physical depth)
  glow: '#E8B45A', // ratings, burn tip
  /** Per-topic accents collapse to brass monochrome in retro. */
  accentsCollapseToBrass: true,
  /** Slots/cards get a 2px center seam @85% black; radius drops 12→4; easing → steps(). */
  cardSeam: 'rgba(0,0,0,.85)',
  cardSeamWidth: 2,
  radius: 4,
} as const;

// ─── Bundled export ──────────────────────────────────────────────────────────

export const tokens = {
  colors,
  topicHues,
  fonts,
  type,
  spacing,
  radii,
  slot,
  tap,
  home,
  duration,
  easing,
  motion,
  retro,
} as const;

export type Tokens = typeof tokens;
export type { TopicId } from '@sabd/contracts';
