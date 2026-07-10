import React from 'react';
import { useSkin } from '../skins';

// Glance-only top bar: topic left, rating right. NOTHING tappable
// (back = edge swipe — no top-left target; DESIGN-SYSTEM.md §6).
export const GlanceBar: React.FC<{ topic: string; hue: number; rating: number }> = ({
  topic,
  hue,
  rating,
}) => {
  const s = useSkin();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 22px',
      }}
    >
      <span
        style={{
          fontFamily: s.fonts.display,
          fontStretch: '118%',
          fontWeight: 800,
          fontSize: 14,
          letterSpacing: 1.5,
          color: s.accent(hue),
        }}
      >
        {topic}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: s.tokens.kesar, fontSize: 10 }}>◆</span>
        <span style={{ fontFamily: s.fonts.mono, fontSize: 14, color: s.tokens.paper }}>{rating}</span>
      </div>
    </div>
  );
};
