/**
 * Tiled line-grid background — Internet's terminal grid (20px) and World's map grid
 * (34px). The mockups pan this via `background-position` (`k-grid`/`k-grid34`); this
 * renders the static texture only — the identity signature (fine grid on a dark ground)
 * survives, the slow pan is a decorative micro-detail traded for implementation size.
 */
import { useId } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Path, Rect } from 'react-native-svg';

export interface GridPatternProps {
  size: number;
  color: string;
}

export function GridPattern({ size, color }: GridPatternProps) {
  const id = `grid-${useId()}`;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} patternUnits="userSpaceOnUse" width={size} height={size}>
            <Path d={`M ${size} 0 L 0 0 0 ${size}`} stroke={color} strokeWidth={1} fill="none" />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
