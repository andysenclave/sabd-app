// SABD design tokens — imported from sabd-design/tsx-export/tokens.ts
// (locked: 5a palette, Martian Mono 4a, motion 3-durations/2-easings).
// Token NAMES are stable per DESIGN-SYSTEM.md; the `skins` layer remaps VALUES.
import type { CSSProperties } from 'react';

export const tokens = {
  ink: '#171A24', // ground — indigo-ink, never neutral black
  ink2: '#222634', // raised surfaces: slots, keys, chips, cards
  paper: '#E9EAF2', // primary text/glyphs — cool white
  paperDim: '#8B8FA3', // descriptions, secondary UI, spent states
  kesar: '#F0A33A', // brand saffron: wordmark, rating, primary CTA
  signal: '#E4573D', // timer-critical (<10s) + wrong guess ONLY
} as const;

// Per-topic accents: fixed oklch L 0.75 / C 0.13, hue only moves.
export type TopicId = 'gaming' | 'space' | 'music' | 'internet' | 'food' | 'world';
export const topicHues: Record<TopicId, number> = {
  gaming: 300,
  space: 250,
  music: 345,
  internet: 195,
  food: 70,
  world: 150,
};

export const accent = (hue: number, alpha?: number, l = 0.75): string =>
  alpha === undefined ? `oklch(${l} 0.13 ${hue})` : `oklch(${l} 0.13 ${hue} / ${alpha})`;

export const fonts = {
  mono: "'Martian Mono', monospace", // glyphs, keyboard, timer, rating
  display: "'Archivo', sans-serif", // wordmark, topics, verdicts, CTAs (fontStretch 118–125%)
  body: "'Instrument Sans', system-ui, sans-serif", // descriptions, meta
  devanagari: "'Tiro Devanagari Sanskrit', serif", // शब्द mark only, never UI text
} as const;

export const motion = {
  fast: 120, // ms — typing, wrong-guess shake
  beat: 260, // ms — hint reveals, chip stagger base
  ceremony: 700, // ms — solve flash + odometer roll
  snap: 'cubic-bezier(.2,.9,.3,1)', // CSS form (global.css / CSS animations)
  settle: 'ease-out', // CSS form
} as const;

// framer-motion easings. framer REJECTS CSS strings like 'ease-out' /
// 'cubic-bezier(...)', so its transitions must use these (named or bezier array).
export const ease = {
  snap: [0.2, 0.9, 0.3, 1] as [number, number, number, number],
  settle: 'easeOut' as const,
} as const;

// Rekha track + slot surface alphas (DESIGN-SYSTEM.md §2).
export const surfaces = {
  rekhaTrack: 'rgba(233,234,242,.12)',
  slotEmpty: 'rgba(233,234,242,.04)',
  slotFocused: 'rgba(233,234,242,.06)',
} as const;

export const screen: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100dvh',
  background: tokens.ink,
  boxSizing: 'border-box',
};

/** ms → framer-motion seconds. */
export const sec = (ms: number) => ms / 1000;
