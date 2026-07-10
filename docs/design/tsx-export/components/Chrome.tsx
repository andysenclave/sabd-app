import React from 'react';
import { tokens, fonts, accent } from '../tokens';

// Glance-only top bar: topic left, rating right. NOTHING tappable
// (back = edge swipe — no top-left target; see DESIGN-SYSTEM.md §6).
export const GlanceBar: React.FC<{ topic: string; hue: number; rating: number }> = ({ topic, hue, rating }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 22px' }}>
    <span style={{ fontFamily: fonts.display, fontStretch: '118%', fontWeight: 800, fontSize: 14, letterSpacing: 1.5, color: accent(hue) }}>
      {topic}
    </span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: tokens.kesar, fontSize: 10 }}>◆</span>
      <span style={{ fontFamily: fonts.mono, fontSize: 14, color: tokens.paper }}>{rating}</span>
    </div>
  </div>
);

// Hint bar: POSITION / LETTERS, equal weight, 48px. Spent = dim + struck.
export const HintBar: React.FC<{ hue: number; spent?: ('position' | 'letters')[]; onHint?: (h: string) => void }> = ({ hue, spent = [], onHint }) => (
  <div style={{ display: 'flex', gap: 10, padding: '0 22px 14px' }}>
    {(['POSITION', 'LETTERS'] as const).map((label) => {
      const isSpent = spent.includes(label.toLowerCase() as 'position' | 'letters');
      return (
        <button
          key={label}
          disabled={isSpent}
          onClick={() => onHint?.(label)}
          style={{
            flex: 1, height: 48, border: 'none', borderRadius: 10, cursor: isSpent ? 'default' : 'pointer',
            background: isSpent ? 'rgba(34,38,52,.45)' : tokens.ink2,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <span style={{ color: isSpent ? tokens.paperDim : accent(hue), fontSize: 11 }}>{isSpent ? '◆' : '◇'}</span>
          <span style={{
            fontFamily: fonts.mono, fontSize: 12, letterSpacing: 2,
            color: isSpent ? tokens.paperDim : tokens.paper,
            textDecoration: isSpent ? 'line-through' : 'none',
          }}>
            {label}
          </span>
        </button>
      );
    })}
  </div>
);
