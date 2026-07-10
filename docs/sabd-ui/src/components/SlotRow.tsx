import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useSkin } from '../skins';
import { sec, motion as M, ease } from '../tokens';
import type { SlotView } from '../game/useRound';

// The hanging letter slots (Devanagari-style): square top, rounded bottom, they
// hang FROM the rail. States: empty · focused (accent stub) · typed · given
// (position hint, accent-colored, drops from higher) · solved (wave-flip).
//
// Entrance drops + the focus-stub pulse are CSS (immune to the ~1×/sec re-render);
// the solve wave-flip is framer (runs once, timer already stopped).
export const SlotRow: React.FC<{
  slots: SlotView[];
  hue: number;
  solved?: boolean;
}> = ({ slots, hue, solved }) => {
  const s = useSkin();
  const reduce = useReducedMotion();
  const n = slots.length;
  const w = n <= 5 ? 48 : n === 6 ? 46 : 40; // stress-case clamp — DESIGN-SYSTEM.md §4
  const gap = n <= 6 ? 8 : 5;
  const glyph = n <= 6 ? 30 : 28;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap }}>
      {slots.map((slot) => {
        const bg = solved
          ? s.accent(hue, 0.16)
          : slot.source === 'typed' || slot.source === 'given'
            ? s.tokens.ink2
            : slot.focused
              ? s.surfaces.slotFocused
              : s.surfaces.slotEmpty;

        const glyphColor = solved
          ? s.tokens.paper
          : slot.source === 'given'
            ? s.accent(hue) // "given, not typed"
            : s.tokens.paper;

        return (
          <div
            key={slot.index}
            style={{
              width: w,
              height: 58,
              boxSizing: 'border-box',
              borderRadius: '0 0 8px 8px',
              background: bg,
              display: 'flex',
              alignItems: slot.focused && slot.source === 'empty' ? 'flex-end' : 'center',
              justifyContent: 'center',
              paddingBottom: slot.focused && slot.source === 'empty' ? 10 : 0,
              boxShadow: solved ? `0 6px 22px ${s.accent(hue, 0.35)}` : 'none',
              overflow: 'hidden',
            }}
          >
            {slot.source === 'empty' ? (
              slot.focused ? (
                // Animated accent stub for the focused slot (caret).
                <div
                  className={reduce ? undefined : 'sabd-stub'}
                  style={{ width: 16, height: 3, background: s.accent(hue) }}
                />
              ) : null
            ) : solved && !reduce ? (
              // Solve wave-flip (L→R stagger). Timer is stopped, so framer is safe.
              <motion.span
                initial={{ y: 0 }}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: sec(M.beat), ease: ease.settle, delay: slot.index * 0.06 }}
                style={{ fontFamily: s.fonts.mono, fontWeight: 700, fontSize: glyph, color: glyphColor, lineHeight: 1 }}
              >
                {slot.char}
              </motion.span>
            ) : (
              // Typed / given entrance drop (CSS).
              <span
                key={`${slot.char}-${slot.source}`}
                className={
                  reduce || solved
                    ? undefined
                    : slot.source === 'given'
                      ? 'sabd-glyph-given'
                      : 'sabd-glyph-typed'
                }
                style={{
                  fontFamily: s.fonts.mono,
                  fontWeight: 700,
                  fontSize: glyph,
                  color: glyphColor,
                  lineHeight: 1,
                }}
              >
                {slot.char}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
