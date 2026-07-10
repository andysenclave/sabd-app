import React from 'react';
import { useSkin } from '../skins';
import type { HintId } from '../types';

// Hint bar: POSITION / LETTERS — equal weight, 48px, single-use. Cost labels
// per brief §3 (−8s / −5s). Spent = dim + struck ◆, disabled.
export const HintBar: React.FC<{
  hue: number;
  spent: HintId[];
  costs: Record<HintId, number>;
  onHint: (id: HintId) => void;
}> = ({ hue, spent, costs, onHint }) => {
  const s = useSkin();
  const items: { id: HintId; label: string }[] = [
    { id: 'position', label: 'POSITION' },
    { id: 'letters', label: 'LETTERS' },
  ];
  return (
    <div style={{ display: 'flex', gap: 10, padding: '0 22px 14px' }}>
      {items.map(({ id, label }) => {
        const isSpent = spent.includes(id);
        return (
          <button
            key={id}
            disabled={isSpent}
            onClick={() => onHint(id)}
            style={{
              flex: 1,
              height: 48,
              border: 'none',
              borderRadius: 10,
              cursor: isSpent ? 'default' : 'pointer',
              background: isSpent ? 'rgba(34,38,52,.45)' : s.tokens.ink2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <span style={{ color: isSpent ? s.tokens.paperDim : s.accent(hue), fontSize: 11 }}>
              {isSpent ? '◆' : '◇'}
            </span>
            <span
              style={{
                fontFamily: s.fonts.mono,
                fontSize: 12,
                letterSpacing: 2,
                color: isSpent ? s.tokens.paperDim : s.tokens.paper,
                textDecoration: isSpent ? 'line-through' : 'none',
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontFamily: s.fonts.mono,
                fontSize: 10,
                color: isSpent ? s.tokens.paperDim : s.tokens.paperDim,
              }}
            >
              −{costs[id]}s
            </span>
          </button>
        );
      })}
    </div>
  );
};
