/**
 * CRT-style scanlines — gaming's exclusive category signature (DESIGN-SYSTEM.md rev. 3).
 * Ported from the mockups' `repeating-linear-gradient(0deg, rgba(0,0,0,alpha) 0 1px,
 * transparent 1px 3px)`: a 1px dark line every 3px. RN has no repeating-gradient
 * primitive, so this tiles a 3px-tall SVG pattern — the pixel-exact equivalent, not an
 * approximation.
 */
import { View } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

export interface ScanlinesProps {
  /** Line opacity — 9b's card overlay uses .16, the full-screen gaming round uses .16 too. */
  opacity?: number;
}

export function Scanlines({ opacity = 0.16 }: ScanlinesProps) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="scanlines" patternUnits="userSpaceOnUse" width={3} height={3}>
            <Rect x={0} y={0} width={3} height={1} fill={`rgba(0,0,0,${opacity})`} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#scanlines)" />
      </Svg>
    </View>
  );
}
