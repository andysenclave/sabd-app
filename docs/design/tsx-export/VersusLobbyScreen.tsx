import React from 'react';
import { tokens, fonts, accent, topicHues, screen } from './tokens';

// 1v1 lobby (mockup 6g): two rating plaques face each other across a shared
// kesar Rekha — opponent above the line, you below. In-round, opponent
// progress = a thin tick on their side of the rail.

export const VersusLobbyScreen: React.FC = () => (
  <div style={{ ...screen, padding: '28px 26px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontFamily: fonts.display, fontStretch: '118%', fontWeight: 800, fontSize: 14, letterSpacing: 1.5, color: tokens.paper }}>CHALLENGE</span>
      <span style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, color: tokens.paperDim }}>BEST OF 3</span>
    </div>

    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {/* Opponent — above the Rekha */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 13, letterSpacing: 1, color: tokens.paper }}>RHEA_V</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ color: tokens.kesar, fontSize: 12 }}>◆</span>
          <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 30, color: tokens.paper }}>1287</span>
        </div>
      </div>

      {/* Shared Rekha with VS punched through */}
      <div style={{ position: 'relative', height: 3, background: tokens.kesar, borderRadius: 2, boxShadow: '0 0 14px rgba(240,163,58,.4)' }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', background: tokens.ink, padding: '0 12px' }}>
          <span style={{ fontFamily: fonts.display, fontStretch: '125%', fontWeight: 900, fontSize: 15, letterSpacing: 2, color: tokens.kesar }}>VS</span>
        </div>
      </div>

      {/* You — below the Rekha */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <span style={{ color: tokens.kesar, fontSize: 12 }}>◆</span>
          <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 30, color: tokens.paper }}>1240</span>
        </div>
        <span style={{ fontFamily: fonts.mono, fontSize: 13, letterSpacing: 1, color: tokens.paperDim }}>YOU</span>
      </div>

      <div style={{ textAlign: 'center', marginTop: 34, fontFamily: fonts.body, fontSize: 13, color: tokens.paperDim }}>
        Same word, same clock. Faster solve takes the game.
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 18 }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, padding: '6px 12px', border: `1px solid ${accent(topicHues.gaming, 0.6)}`, borderRadius: 20, color: accent(topicHues.gaming) }}>GAMING</span>
        <span style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, padding: '6px 12px', border: '1px solid rgba(233,234,242,.15)', borderRadius: 20, color: tokens.paperDim }}>RANDOM</span>
      </div>
    </div>

    <button style={{
      height: 56, background: tokens.kesar, border: 'none', borderRadius: 12, cursor: 'pointer',
      fontFamily: fonts.display, fontStretch: '120%', fontWeight: 900, fontSize: 16, letterSpacing: 2, color: tokens.ink,
    }}>
      START MATCH
    </button>
  </div>
);

export default VersusLobbyScreen;
