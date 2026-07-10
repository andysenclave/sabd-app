// SABD skin layer. Per DESIGN-SYSTEM.md a skin is a TOKEN REMAP + easing swap +
// (retro) a scanline overlay — nothing structural. Modern ships fully; retro is
// the token-remap stub proven in mockup 1h (CRT green-black + phosphor + steps()).
//
// Components read the active skin via `useSkin()` so swapping skins never touches
// component logic. `config.skin` (or ?skin= URL param) selects the default.
import { createContext, useContext } from 'react';
import { tokens as modernTokens, fonts, surfaces as modernSurfaces } from './tokens';

export type SkinId = 'modern' | 'retro';

export interface Skin {
  id: SkinId;
  tokens: {
    ink: string;
    ink2: string;
    paper: string;
    paperDim: string;
    kesar: string;
    signal: string;
  };
  surfaces: { rekhaTrack: string; slotEmpty: string; slotFocused: string };
  fonts: typeof fonts;
  easing: { snap: string; settle: string };
  /** Per-topic accent. Modern keys off hue; retro ignores it (one phosphor). */
  accent: (hue: number, alpha?: number, l?: number) => string;
  /** CRT scanline overlay on top of the frame. */
  scanlines: boolean;
}

const modernAccent = (hue: number, alpha?: number, l = 0.75): string =>
  alpha === undefined ? `oklch(${l} 0.13 ${hue})` : `oklch(${l} 0.13 ${hue} / ${alpha})`;

export const modernSkin: Skin = {
  id: 'modern',
  tokens: { ...modernTokens },
  surfaces: { ...modernSurfaces },
  fonts,
  easing: { snap: 'cubic-bezier(.2,.9,.3,1)', settle: 'ease-out' },
  accent: modernAccent,
  scanlines: false,
};

// Retro (mockup 1h): CRT green-black + phosphor. accent() collapses every topic
// hue to one phosphor green; motion uses steps() easing; scanline overlay on.
const PHOSPHOR = { h: 135, c: 0.16 };
const retroAccent = (_hue: number, alpha?: number, l = 0.82): string =>
  alpha === undefined
    ? `oklch(${l} ${PHOSPHOR.c} ${PHOSPHOR.h})`
    : `oklch(${l} ${PHOSPHOR.c} ${PHOSPHOR.h} / ${alpha})`;

export const retroSkin: Skin = {
  id: 'retro',
  tokens: {
    ink: '#06120A', // deep CRT green-black
    ink2: '#0E2116', // raised phosphor surface
    paper: '#B6F5C6', // phosphor text
    paperDim: '#5E8F6C', // dim phosphor
    kesar: '#F0C93A', // amber phosphor stands in for saffron
    signal: '#F0573A', // still red for critical/wrong
  },
  surfaces: {
    rekhaTrack: 'rgba(182,245,198,.14)',
    slotEmpty: 'rgba(182,245,198,.05)',
    slotFocused: 'rgba(182,245,198,.08)',
  },
  fonts,
  easing: { snap: 'steps(4, end)', settle: 'steps(5, end)' },
  accent: retroAccent,
  scanlines: true,
};

export const SKINS: Record<SkinId, Skin> = { modern: modernSkin, retro: retroSkin };

export const SkinContext = createContext<Skin>(modernSkin);
export const useSkin = (): Skin => useContext(SkinContext);

export function resolveSkin(id: SkinId): Skin {
  return SKINS[id] ?? modernSkin;
}
