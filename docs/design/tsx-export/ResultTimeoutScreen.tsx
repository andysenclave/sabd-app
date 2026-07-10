import React from 'react';
import { tokens, fonts, screen } from './tokens';

// Result — timeout (mockup 6f). Deliberately NO ceremony: dim verdict,
// answer fills in quietly, burnt rail in signal tint, small −Δ.

const WORD = ['A', 'T', 'O', 'L', 'L'];

export const ResultTimeoutScreen: React.FC = () => (
  <div style={{ ...screen, padding: '30px 26px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontFamily: fonts.display, fontStretch: '125%', fontWeight: 900, fontSize: 30, letterSpacing: 2, color: tokens.paperDim }}>TIME.</span>
      <span style={{ fontFamily: fonts.mono, fontSize: 12, color: tokens.signal }}>0:00</span>
    </div>

    <div style={{ marginTop: 36 }}>
      <div style={{ height: 3, background: 'rgba(228,87,61,.35)', borderRadius: 2 }} />
      <div style={{ display: 'flex', gap: 5 }}>
        {WORD.map((ch, i) => (
          <div key={i} style={{
            width: 34, height: 40, borderRadius: '0 0 6px 6px', background: 'rgba(233,234,242,.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: fonts.mono, fontSize: 19, color: tokens.paperDim,
          }}>
            {ch}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontFamily: fonts.body, fontSize: 13, color: tokens.paperDim }}>
        A ring of coral, a lagoon in the middle.
      </div>
    </div>

    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: tokens.paperDim, fontSize: 14 }}>◆</span>
        <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 40, letterSpacing: -1, color: tokens.paperDim }}>1234</span>
      </div>
      <span style={{ fontFamily: fonts.mono, fontSize: 13, color: tokens.paperDim }}>1240 → −6</span>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button style={{
        height: 56, background: 'transparent', border: '1px solid rgba(233,234,242,.25)', borderRadius: 12, cursor: 'pointer',
        fontFamily: fonts.display, fontStretch: '120%', fontWeight: 900, fontSize: 15, letterSpacing: 2, color: tokens.paper,
      }}>
        RETRY TOPIC
      </button>
      <button style={{
        height: 48, background: 'transparent', border: '1px solid rgba(233,234,242,.14)', borderRadius: 12, cursor: 'pointer',
        fontFamily: fonts.mono, fontSize: 12, letterSpacing: 2, color: tokens.paperDim,
      }}>
        HOME
      </button>
    </div>
  </div>
);

export default ResultTimeoutScreen;
