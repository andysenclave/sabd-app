/**
 * ThemeProvider — the single seam between `@sabd/tokens` and the RN app.
 *
 * It exposes the locked palette, the type scale, motion, and — critically — an
 * RN-safe per-topic `accent` (tokens store accents as `oklch()`, which RN can't parse,
 * so we convert to hex here). The current topic is swapped at round start; everything
 * else is constant (DESIGN-SYSTEM §2).
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  colors,
  duration,
  easing,
  topicHues,
  type,
  ACCENT_L,
  ACCENT_C,
  type TopicId,
} from '@sabd/tokens';

import { fontFamily } from './fonts.ts';
import { oklchToHex, oklchToHexA } from './color.ts';

export interface Theme {
  colors: typeof colors;
  type: typeof type;
  duration: typeof duration;
  easing: typeof easing;
  font: typeof fontFamily;
  /** The topic in play; drives the accent. */
  topic: TopicId;
  /** RN-safe accent hex for the current topic (optional alpha 0..1). */
  accent: (alpha?: number) => string;
  /** RN-safe accent hex for an explicit topic (used by the Home grid). */
  accentFor: (topic: TopicId, alpha?: number) => string;
  setTopic: (topic: TopicId) => void;
}

function accentHex(topic: TopicId, alpha?: number): string {
  const hue = topicHues[topic];
  return alpha === undefined ? oklchToHex(ACCENT_L, ACCENT_C, hue) : oklchToHexA(ACCENT_L, ACCENT_C, hue, alpha);
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
      colors,
      type,
      duration,
      easing,
      font: fontFamily,
      topic,
      accent: (alpha?: number) => accentHex(topic, alpha),
      accentFor: (t: TopicId, alpha?: number) => accentHex(t, alpha),
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
