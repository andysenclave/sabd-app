/**
 * oklch → sRGB hex bridge.
 *
 * `@sabd/tokens` expresses the six per-topic accents in `oklch()` (correct for CSS/web),
 * but React Native's color parser does not understand `oklch()`. This converts an accent's
 * (L, C, H) to a hex string RN can render. Implementation: Björn Ottosson's Oklab → linear
 * sRGB matrix + sRGB gamma. Colors outside sRGB gamut are clamped per-channel.
 */

const cube = (x: number): number => x * x * x;

function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.min(1, Math.max(0, v));
}

function toHex2(n: number): string {
  return Math.round(n * 255)
    .toString(16)
    .padStart(2, '0');
}

/** Convert an oklch color (L 0..1, C, H in degrees) to `#rrggbb`. */
export function oklchToHex(L: number, C: number, hueDeg: number): string {
  const h = (hueDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = cube(l_);
  const m = cube(m_);
  const s = cube(s_);

  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return `#${toHex2(linearToSrgb(r))}${toHex2(linearToSrgb(g))}${toHex2(linearToSrgb(bl))}`;
}

/** Convert with an alpha channel → `#rrggbbaa`. */
export function oklchToHexA(L: number, C: number, hueDeg: number, alpha: number): string {
  return `${oklchToHex(L, C, hueDeg)}${toHex2(Math.min(1, Math.max(0, alpha)))}`;
}

/**
 * `#rrggbb` → `rgba(r,g,b,alpha)`. For translucent fills/shadows that need to track
 * a theme color (e.g. paper, kesar) instead of being hand-copied as a literal that
 * silently goes stale when the palette is remapped (modern ↔ retro).
 */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
