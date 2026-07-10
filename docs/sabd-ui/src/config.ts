// SABD — runtime config (§5.3). All the knobs a designer/PM might flip live here.
import type { SkinId } from './skins';
import type { HintId } from './types';

export type GlowPolicy = 'always' | 'stakes-only' | 'never';

export interface SabdConfig {
  /** Round length in seconds (§2 timeLimitSec). */
  timeLimitSec: number;
  /** Time penalty (seconds) each hint subtracts immediately (brief §3 table). */
  hintCosts: Record<HintId, number>;
  /** Below this many seconds, the burn goes --signal + ember pulse (design §5). */
  criticalSec: number;
  /** Show the custom on-screen A–Z keyboard (also accepts a physical keyboard). */
  onScreenKeyboard: boolean;
  /** Active visual skin. Overridable at runtime via ?skin=retro. */
  skin: SkinId;
  /**
   * Atmospheric accent glow (DESIGN-SYSTEM.md §5c open item).
   * Design recommends STAKES-ONLY; default reflects that. Flip to 'always' or
   * 'never' here. 'stakes-only' = glow appears only inside the final `criticalSec`.
   */
  glowPolicy: GlowPolicy;
}

export const config: SabdConfig = {
  timeLimitSec: 60,
  hintCosts: { position: 8, letters: 5 },
  criticalSec: 10,
  onScreenKeyboard: true,
  skin: 'modern',
  glowPolicy: 'stakes-only',
};

/** Read a ?skin= override so retro can be demoed without editing config. */
export function skinFromUrl(fallback: SkinId): SkinId {
  if (typeof window === 'undefined') return fallback;
  const q = new URLSearchParams(window.location.search).get('skin');
  return q === 'retro' || q === 'modern' ? q : fallback;
}
