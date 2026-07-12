/**
 * ThemeProvider — the single seam between `@sabd/tokens` and the RN app.
 *
 * It exposes the active palette, the type scale, and motion. The current topic is
 * still tracked (`t.topic`/`setTopic`) for callers that key off it structurally
 * (word bank lookups, etc.) but no longer drives any COLOR — see below.
 *
 * The app ships the RETRO skin (mockups 9b/9c) as its one look, not the modern
 * indigo/kesar palette `@sabd/tokens.colors` describes — that palette stays in the
 * package as the historical/locked reference, but `retroColors` below is what
 * every screen actually reads through `t.colors`, by owner decision (2026-07-11):
 * the logo asset is already retro-styled and clashed with an indigo background.
 *
 * `accentsCollapseToBrass` IS honored, per a pixel-level check against the actual
 * mockup markup (not just the design doc's prose): 9b/9c use brass (`#C98A2B`) for
 * every rail, border, diamond, and wallpaper glyph, on every topic, with zero hue
 * variation — topics stay distinguishable by name and icon SHAPE only (△○✕ vs
 * ✦✧ vs ♪♫...), never by color. An earlier pass here kept per-topic hue "on top of
 * brass," which does not match either mockup and was wrong — corrected 2026-07-11.
 * `accent()`/`accentFor()` are kept as the call-site API (so no component needed to
 * change) but now always resolve to brass, ignoring the topic/hue arguments.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { colors, duration, easing, retro, type, type TopicId } from '@sabd/tokens';

import { fontFamily } from './fonts.ts';
import { hexToRgba } from './color.ts';

/**
 * `retro` from @sabd/tokens, reshaped to the same key set as `colors` so every
 * consumer of `t.colors.X` gets the retro value with zero call-site changes.
 * `signal` (timer-critical / wrong-guess) is left as-is — it's functional, not
 * part of the palette remap, and the doc doesn't redefine it for retro.
 */
const retroColors = {
  ink: retro.ground,
  ink2: retro.surface,
  paper: retro.text,
  paperDim: retro.dim,
  kesar: retro.brass,
  signal: colors.signal,
  slotEmpty: hexToRgba(retro.text, 0.04),
  slotFocused: hexToRgba(retro.text, 0.06),
  railTrack: hexToRgba(retro.text, 0.12),
} as const;

export interface Theme {
  colors: Record<keyof typeof colors, string>;
  type: typeof type;
  duration: typeof duration;
  easing: typeof easing;
  font: typeof fontFamily;
  /** Retro-only values that don't fit the base 8-key palette shape (mockups 9b/9c). */
  retro: { brassUnderside: string; glow: string; cardSeam: string };
  /** The topic in play. No longer drives color — kept for structural callers. */
  topic: TopicId;
  /** Brass, always — kept topic-shaped for call-site compatibility (optional alpha 0..1). */
  accent: (alpha?: number) => string;
  /** Brass, always — the `topic`/`l` args are accepted but ignored (see file header). */
  accentFor: (topic: TopicId, alpha?: number, l?: number) => string;
  setTopic: (topic: TopicId) => void;
}

function accentHex(alpha?: number): string {
  return alpha === undefined ? retroColors.kesar : hexToRgba(retroColors.kesar, alpha);
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({
  children,
  initialTopic = 'gaming',
}: {
  children: ReactNode;
  initialTopic?: TopicId;
}) {
  const [topic, setTopic] = useState<TopicId>(initialTopic);

  const value = useMemo<Theme>(
    () => ({
      colors: retroColors,
      type,
      duration,
      easing,
      font: fontFamily,
      retro: { brassUnderside: retro.brassUnderside, glow: retro.glow, cardSeam: retro.cardSeam },
      topic,
      accent: (alpha?: number) => accentHex(alpha),
      accentFor: (_topic: TopicId, alpha?: number) => accentHex(alpha),
      setTopic,
    }),
    [topic],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}
