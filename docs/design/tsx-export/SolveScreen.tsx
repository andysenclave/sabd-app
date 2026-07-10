import React from 'react';
import { tokens, fonts, accent, topicHues, screen } from './tokens';
import { GlanceBar } from './components/Chrome';
import { RekhaRail } from './components/RekhaRail';

// The solve moment (mockup 3c/6d): burn halts, rail flashes accent,
// glyphs wave-flip L→R (60ms stagger), then auto-advance to result.
// Static snapshot; wire the wave with motion.ceremony from tokens.ts.

const HUE = topicHues.music;
const WORD = ['V', 'I', 'N', 'Y', 'L'];
// Wave offsets for the frozen mid-ceremony frame (px lift per glyph)
const LIFT = [0, 5, 9, 5, 0];

export const SolveScreen: React.FC = () => (
  <div style={{ ...screen, padding: '24px 0 14px' }}>
    <GlanceBar topic="MUSIC" hue={HUE} rating={1240} />

    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <RekhaRail hue={HUE} progress={1} timeLabel="0:37 — HELD" solved />
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
        {WORD.map((ch, i) => {
          const peak = LIFT[i] === Math.max(...LIFT);
          return (
            <div
              key={i}
              style={{
                width: 48, height: 58, borderRadius: '0 0 8px 8px',
                background: accent(HUE, peak ? 0.22 : 0.16),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: fonts.mono, fontWeight: 700, fontSize: 30,
                color: peak ? tokens.paper : accent(HUE, undefined, 0.83),
                transform: `translateY(-${LIFT[i]}px)`,
                boxShadow: peak ? `0 6px 22px ${accent(HUE, 0.45)}` : 'none',
              }}
            >
              {ch}
            </div>
          );
        })}
      </div>
      <div style={{ height: 44, padding: '20px 44px 0', textAlign: 'center', fontFamily: fonts.body, fontSize: 15, lineHeight: 1.45, color: tokens.paperDim }}>
        Records that never really died — ask any collector.
      </div>
      <div style={{ textAlign: 'center', marginTop: 26 }}>
        <span style={{ fontFamily: fonts.display, fontStretch: '125%', fontWeight: 900, fontSize: 22, letterSpacing: 4, color: accent(HUE, undefined, 0.83) }}>
          SOLVED
        </span>
      </div>
    </div>
  </div>
);

export default SolveScreen;
