import React from 'react';
import { tokens, fonts, accent, topicHues, screen } from './tokens';

// Result — win (mockup 6e). THE dopamine beat: rating odometer roll-up.
// One ceremony (motion.ceremony), then still. No confetti — ever.

const HUE = topicHues.music;
const WORD = ['V', 'I', 'N', 'Y', 'L'];

export const ResultWinScreen: React.FC = () => (
  <div style={{ ...screen, padding: '30px 26px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontFamily: fonts.display, fontStretch: '125%', fontWeight: 900, fontSize: 30, letterSpacing: 2, color: tokens.paper }}>SOLVED</span>
      <span style={{ fontFamily: fonts.mono, fontSize: 12, color: tokens.paperDim }}>0:37 LEFT</span>
    </div>

    {/* Solved rail, accent-tinted */}
    <div style={{ marginTop: 36 }}>
      <div style={{ height: 3, background: accent(HUE), borderRadius: 2 }} />
      <div style={{ display: 'flex', gap: 5 }}>
        {WORD.map((ch, i) => (
          <div key={i} style={{
            width: 34, height: 40, borderRadius: '0 0 6px 6px', background: accent(HUE, 0.14),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: fonts.mono, fontWeight: 700, fontSize: 19, color: tokens.paper,
          }}>
            {ch}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontFamily: fonts.body, fontSize: 13, color: tokens.paperDim }}>
        "Records that never really died." · no hints used
      </div>
    </div>

    {/* Rating beat — odometer rolls 1240 → 1263 digit-by-digit on mount */}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: tokens.kesar, fontSize: 16 }}>◆</span>
        <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 56, letterSpacing: -2, color: tokens.paper }}>1263</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 14, color: tokens.paperDim }}>1240 →</span>
        <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 20, color: tokens.kesar }}>+23</span>
      </div>
      <span style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 3, color: tokens.paperDim, marginTop: 6 }}>TOP 16% · BEST 1310</span>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button style={{
        height: 56, background: tokens.kesar, border: 'none', borderRadius: 12, cursor: 'pointer',
        fontFamily: fonts.display, fontStretch: '120%', fontWeight: 900, fontSize: 16, letterSpacing: 2, color: tokens.ink,
      }}>
        NEXT WORD
      </button>
      <button style={{
        height: 48, background: 'transparent', border: '1px solid rgba(233,234,242,.18)', borderRadius: 12, cursor: 'pointer',
        fontFamily: fonts.mono, fontSize: 12, letterSpacing: 2, color: tokens.paperDim,
      }}>
        HOME
      </button>
      <div style={{ textAlign: 'center', marginTop: 6 }}>
        <span style={{ fontFamily: fonts.devanagari, fontSize: 15, color: 'rgba(240,163,58,.4)' }}>शब्द</span>
      </div>
    </div>
  </div>
);

export default ResultWinScreen;
