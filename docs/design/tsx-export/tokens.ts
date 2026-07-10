// SABD design tokens — from DESIGN-SYSTEM.md (locked: 5a palette, Martian Mono 4a)
import type { CSSProperties } from 'react';

export const tokens = {
  ink: '#171A24',      // ground — indigo-ink, never neutral black
  ink2: '#222634',     // raised surfaces: slots, keys, chips, cards
  paper: '#E9EAF2',    // primary text/glyphs — cool white
  paperDim: '#8B8FA3', // descriptions, secondary UI, spent states
  kesar: '#F2A33C',    // brand saffron: wordmark, rating, primary CTA
  signal: '#E4573D',   // timer-critical (<10s) + wrong guess ONLY
} as const;

// Per-topic accents: fixed oklch L 0.75 / C 0.13, hue only moves.
export type TopicId = 'gaming' | 'space' | 'music' | 'internet' | 'food' | 'world';
export const topicHues: Record<TopicId, number> = {
  gaming: 300, space: 250, music: 345, internet: 195, food: 70, world: 150,
};
export const accent = (hue: number, alpha?: number, l = 0.75): string =>
  alpha === undefined ? `oklch(${l} 0.13 ${hue})` : `oklch(${l} 0.13 ${hue} / ${alpha})`;

// Retro scoreboard skin (LOCKED): warm brass/cream remap — see DESIGN-SYSTEM.md §2.
export const retroTokens = {
  ground: '#0B0908', surface: '#161310', text: '#F0E6CC', dim: '#8F8672',
  brass: '#C98A2B', brassDark: '#6E4A12', glow: '#E8B45A',
} as const;

export const fonts = {
  brand: "'Khand', sans-serif",                    // wordmark, PLAY CTA, retro card faces (700)
  mono: "'Martian Mono', monospace",              // glyphs, keyboard, timer, rating
  display: "'Archivo', sans-serif",               // wordmark, topics, verdicts, CTAs (use with fontStretch 118–125%)
  body: "'Instrument Sans', system-ui, sans-serif", // descriptions, meta
  devanagari: "'Tiro Devanagari Sanskrit', serif",  // शब्द mark only, never UI text
} as const;

export const motion = {
  fast: 120,      // ms — typing, wrong-guess shake
  beat: 260,      // ms — hint reveals, chip stagger base
  ceremony: 700,  // ms — solve flash + odometer roll
  snap: 'cubic-bezier(.2,.9,.3,1)',
  settle: 'ease-out',
} as const;

export const screen: CSSProperties = {
  display: 'flex', flexDirection: 'column', minHeight: '100dvh',
  background: tokens.ink, boxSizing: 'border-box',
};
