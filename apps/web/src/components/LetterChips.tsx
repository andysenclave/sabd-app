import React from 'react';
import { useSkin } from '../skins';
import { motion as M } from '../tokens';

// LETTERS hint output: the 2 shuffled candidate letters. It NEVER reveals which
// is correct or where it goes — it narrows the search, it doesn't solve it.
// Chips stagger in (30ms apart) and settle below the rail (design §5). Tapping a
// chip types it into the focused slot (a convenience — no correctness signal,
// since either letter can be entered anywhere).
//
// Entrance is CSS (.sabd-chip) so the hook's ~1×/sec re-render can't restart it;
// reduced-motion is handled by the global media rule.
export const LetterChips: React.FC<{
  chips: string[] | null;
  hue: number;
  onPick: (ch: string) => void;
}> = ({ chips, hue, onPick }) => {
  const s = useSkin();
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 22, minHeight: 44 }}>
      {chips?.map((ch, i) => (
        <button
          key={`${ch}-${i}`}
          className="sabd-chip"
          onClick={() => onPick(ch)}
          style={{
            animationDelay: `${i * M.beat * 0.12}ms`,
            minWidth: 44,
            height: 44,
            padding: '0 10px',
            boxSizing: 'border-box',
            borderRadius: 10,
            background: 'rgba(233,234,242,.08)',
            border: `1px solid ${s.accent(hue, 0.5)}`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: s.fonts.mono,
            fontWeight: 700,
            fontSize: 17,
            color: s.tokens.paper,
          }}
        >
          {ch}
        </button>
      ))}
    </div>
  );
};
