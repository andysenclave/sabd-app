import React from 'react';
import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { useSkin } from '../skins';

// The Rekha (signature). ONE horizontal headstroke that is simultaneously the
// letter rail (slots hang below, rendered by SlotRow) and the 60s timer, which
// BURNS right→left along the same line. No corner ring. Shifts to --signal in the
// final 10s with a 1px ember pulse (pressure feedback — information, not decor,
// so reduced-motion keeps the burn but drops the pulse). The 5c atmospheric glow
// is config-gated separately via `atmosphericGlow`.
//
// `progress` is a MotionValue so the burn width updates every frame without
// re-rendering React (see useRound perf note).
export const RekhaRail: React.FC<{
  hue: number;
  progress: MotionValue<number>; // 0..1 remaining
  timeLabel: string;
  critical?: boolean; // <10s — burn + readout go --signal
  solved?: boolean; // full-width accent glow flash
  atmosphericGlow?: boolean; // DESIGN-SYSTEM.md §5c — stakes-only by default
}> = ({ hue, progress, timeLabel, critical, solved, atmosphericGlow }) => {
  const s = useSkin();
  const reduce = useReducedMotion();
  const burn = critical ? s.tokens.signal : s.accent(hue);
  // Map the 0..1 progress MotionValue to a "NN%" width string, frame-smooth.
  const percent = useTransform(progress, (v) => v * 100);
  const width = useMotionTemplate`${percent}%`;

  const railGlow = solved
    ? `0 0 18px ${s.accent(hue, 0.8)}, 0 0 44px ${s.accent(hue, 0.4)}`
    : atmosphericGlow
      ? `0 0 14px ${critical ? hexA(s.tokens.signal, 0.5) : s.accent(hue, 0.5)}`
      : 'none';

  // Ember pulse on the burn fill during the critical window (CSS — see global.css).
  const emberActive = !!critical && !solved && !reduce;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 24px 6px' }}>
        <span style={{ fontFamily: s.fonts.mono, fontSize: 13, color: burn }}>{timeLabel}</span>
      </div>
      <div
        style={{
          position: 'relative',
          height: 3,
          margin: '0 24px',
          boxShadow: railGlow,
          ...(solved ? { background: s.accent(hue) } : {}),
        }}
      >
        {!solved && (
          <>
            <div style={{ position: 'absolute', inset: 0, background: s.surfaces.rekhaTrack }} />
            <motion.div
              className={emberActive ? 'sabd-ember' : undefined}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width,
                background: burn,
              }}
            />
          </>
        )}
      </div>
    </div>
  );
};

// #RRGGBB + alpha → rgba(). Small helper so signal glows can fade.
function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
