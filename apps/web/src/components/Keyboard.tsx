import React from 'react';
import { useSkin } from '../skins';

// Custom in-game keyboard (§5, DESIGN-SYSTEM.md §4): 3 rows, 44px keys, Martian.
// ⏎ = submit, ⌫ = backspace, letters = type. A physical keyboard also works
// (wired in GameScreen); this is the touch fallback (config.onScreenKeyboard).
const ROWS: { keys: string[]; pad: number }[] = [
  { keys: ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'], pad: 0 },
  { keys: ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'], pad: 18 },
  { keys: ['⏎', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'], pad: 0 },
];

export const Keyboard: React.FC<{ onKey: (k: string) => void; disabled?: boolean }> = ({
  onKey,
  disabled,
}) => {
  const s = useSkin();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '0 8px',
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      {ROWS.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 5, padding: `0 ${row.pad}px` }}>
          {row.keys.map((k) => {
            const special = k === '⏎' || k === '⌫';
            return (
              <button
                key={k}
                onClick={() => onKey(k)}
                style={{
                  flex: special ? 1.4 : 1,
                  height: 44,
                  background: s.tokens.ink2,
                  border: 'none',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: s.fonts.mono,
                  fontSize: 13,
                  color: special ? s.tokens.paperDim : s.tokens.paper,
                  cursor: 'pointer',
                }}
              >
                {k}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};
