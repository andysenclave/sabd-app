import React from 'react';
import { tokens, fonts, accent } from '../tokens';

// The Rekha: letter rail + burning 60s timer in one line. Burns right→left;
// shifts to tokens.signal in the final 10s. Slots hang BELOW the line.
export const RekhaRail: React.FC<{
  hue: number;
  progress: number;        // 0..1 remaining
  timeLabel: string;       // e.g. "0:52"
  critical?: boolean;      // <10s — burn + readout go signal red
  solved?: boolean;        // full-width glow flash
}> = ({ hue, progress, timeLabel, critical, solved }) => {
  const burn = critical ? tokens.signal : accent(hue);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 24px 6px' }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 13, color: burn }}>{timeLabel}</span>
      </div>
      <div
        style={{
          position: 'relative', height: 3, margin: '0 24px',
          ...(solved
            ? { background: accent(hue), boxShadow: `0 0 18px ${accent(hue, 0.8)}, 0 0 44px ${accent(hue, 0.4)}` }
            : {}),
        }}
      >
        {!solved && (
          <>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(233,234,242,.12)' }} />
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${progress * 100}%`, background: burn }} />
          </>
        )}
      </div>
    </div>
  );
};

// Letter slots hanging from the rail. Square top (they hang), rounded bottom.
// state: 'filled' | 'focused' | 'empty'
export interface Slot { char?: string; state: 'filled' | 'focused' | 'empty' }

export const SlotRow: React.FC<{ slots: Slot[]; hue: number }> = ({ slots, hue }) => {
  const n = slots.length;
  const w = n <= 5 ? 48 : n === 6 ? 46 : 40; // see stress-case clamp in DESIGN-SYSTEM.md §4
  const gap = n <= 6 ? 8 : 5;
  const glyph = n <= 6 ? 30 : 28;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap }}>
      {slots.map((s, i) => (
        <div
          key={i}
          style={{
            width: w, height: 58, boxSizing: 'border-box',
            borderRadius: '0 0 8px 8px',
            background:
              s.state === 'filled' ? tokens.ink2
              : s.state === 'focused' ? 'rgba(233,234,242,.06)'
              : 'rgba(233,234,242,.04)',
            display: 'flex',
            alignItems: s.state === 'focused' ? 'flex-end' : 'center',
            justifyContent: 'center',
            paddingBottom: s.state === 'focused' ? 10 : 0,
            fontFamily: fonts.mono, fontWeight: 700, fontSize: glyph, color: tokens.paper,
          }}
        >
          {s.state === 'focused' ? <div style={{ width: 16, height: 3, background: accent(hue) }} /> : s.char ?? ''}
        </div>
      ))}
    </div>
  );
};
