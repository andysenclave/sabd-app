/**
 * Odometer (T20) — the win-ceremony rating beat: 1240 → +23, rolling digit-by-digit
 * over one `--ceremony` (700ms). DESIGN-SYSTEM §5: reduced-motion → crossfade instead
 * of rolling (still ends on the correct number, just no motion).
 */
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { duration as motionDuration } from '@sabd/tokens';

import { useTheme } from '../../theme';

export interface OdometerProps {
  from: number;
  to: number;
  reducedMotion?: boolean;
  fontSize?: number;
}

export function Odometer({ from, to, reducedMotion = false, fontSize = 40 }: OdometerProps) {
  const t = useTheme();
  const [display, setDisplay] = useState(reducedMotion ? to : from);

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(to); // crossfade is handled by the caller's opacity transition
      return;
    }
    const start = performance.now();
    const span = to - from;
    let raf: ReturnType<typeof requestAnimationFrame>;

    const tick = (now: number) => {
      const t01 = Math.min(1, (now - start) / motionDuration.ceremony);
      // ease-out cubic — quick start, settles precisely on `to`.
      const eased = 1 - Math.pow(1 - t01, 3);
      setDisplay(Math.round(from + span * eased));
      if (t01 < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, reducedMotion]);

  return (
    <Text
      style={{
        fontFamily: t.font.monoBold,
        fontSize,
        color: t.colors.paper,
        fontVariant: ['tabular-nums'],
      }}
    >
      {display}
    </Text>
  );
}
