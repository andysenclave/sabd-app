/**
 * A soft radial gradient patch — RN has no `radial-gradient()`, so this renders one via
 * react-native-svg. Used for Space's nebula, Music's stage-floor glow, Food's lamp glow.
 * `cx`/`cy`/`rx`/`ry` are percentages of the container (0–100), matching how the mockups
 * position their CSS radial-gradients (e.g. `at 50% 42%`).
 *
 * The outer wrapper is always `Animated.View` (not a plain `View`) so a `useAnimatedStyle`
 * result passed as `animatedStyle` actually drives native-thread animation — a plain View
 * would silently no-op a Reanimated style, since Reanimated only intercepts updates through
 * its own Animated component wrapper.
 */
import { useId } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Ellipse, Filter, FeGaussianBlur } from 'react-native-svg';

export interface GlowStop {
  offset: string;
  color: string;
  opacity: number;
}

export interface RadialGlowProps {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Single-hue glow (default 4-stop falloff below). Ignored if `stops` is passed. */
  color?: string;
  /** Peak opacity at center (the gradient already fades to 0 at the edge). */
  opacity?: number;
  /** Explicit multi-stop, multi-color gradient (mockup-exact) — overrides `color`/`opacity`. */
  stops?: GlowStop[];
  /** RN equivalent of CSS `filter: blur(px)` — an SVG Gaussian blur on the ellipse itself. */
  blurPx?: number;
  style?: StyleProp<ViewStyle>;
  animatedStyle?: AnimatedStyle<ViewStyle> | AnimatedStyle<ViewStyle>[];
}

export function RadialGlow({ cx, cy, rx, ry, color, opacity = 1, stops, blurPx, style, animatedStyle }: RadialGlowProps) {
  const id = `glow-${useId()}`;
  const blurId = `blur-${useId()}`;
  // Owner-verified on-device: the mockups' steep falloff (70%→.35, 100%→0) read as a
  // small dim blob on a real phone, not the mockup's spreading glow. Slower falloff +
  // a brighter middle stop so it visibly spreads — the default when `stops` isn't given.
  const gradientStops: GlowStop[] = stops ?? [
    { offset: '0%', color: color ?? '#fff', opacity },
    { offset: '45%', color: color ?? '#fff', opacity: opacity * 0.75 },
    { offset: '85%', color: color ?? '#fff', opacity: opacity * 0.25 },
    { offset: '100%', color: color ?? '#fff', opacity: 0 },
  ];
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, style, animatedStyle]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={id} cx={`${cx}%`} cy={`${cy}%`} rx={`${rx}%`} ry={`${ry}%`}>
            {gradientStops.map((s) => (
              <Stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
            ))}
          </RadialGradient>
          {blurPx != null && (
            <Filter id={blurId} x="-50%" y="-50%" width="200%" height="200%">
              <FeGaussianBlur stdDeviation={blurPx} />
            </Filter>
          )}
        </Defs>
        <Ellipse
          cx={`${cx}%`}
          cy={`${cy}%`}
          rx={`${rx}%`}
          ry={`${ry}%`}
          fill={`url(#${id})`}
          filter={blurPx != null ? `url(#${blurId})` : undefined}
        />
      </Svg>
    </Animated.View>
  );
}
