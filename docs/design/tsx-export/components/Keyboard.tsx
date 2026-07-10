import React from 'react';
import { tokens, fonts } from '../tokens';

// Custom in-game keyboard. 44px keys (min tap target), Martian Mono.
const ROWS: { keys: string[]; pad: number }[] = [
  { keys: ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'], pad: 0 },
  { keys: ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'], pad: 18 },
  { keys: ['⏎', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'], pad: 0 },
];

export const Keyboard: React.FC<{ onKey?: (k: string) => void }> = ({ onKey }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 8px' }}>
    {ROWS.map((row, i) => (
      <div key={i} style={{ display: 'flex', gap: 5, padding: `0 ${row.pad}px` }}>
        {row.keys.map((k) => {
          const special = k === '⏎' || k === '⌫';
          return (
            <button
              key={k}
              onClick={() => onKey?.(k)}
              style={{
                flex: special ? 1.4 : 1, height: 44, background: tokens.ink2,
                border: 'none', borderRadius: 6, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontFamily: fonts.mono, fontSize: 13,
                color: special ? tokens.paperDim : tokens.paper, cursor: 'pointer',
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
