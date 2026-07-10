import React from 'react';
import { tokens, fonts, accent, topicHues, screen } from './tokens';
import { GlanceBar, HintBar } from './components/Chrome';
import { RekhaRail, SlotRow, Slot } from './components/RekhaRail';
import { Keyboard } from './components/Keyboard';

// Round screen, mid-round: Letters hint used — chip row joins the centered
// word module; LETTERS button collapses to spent state. (Mockup 3b/6c.)

const HUE = topicHues.space;

const SLOTS: Slot[] = [
  { char: 'N', state: 'filled' },
  { char: 'E', state: 'filled' },
  { char: 'B', state: 'filled' },
  { state: 'focused' },
  { state: 'empty' },
  { state: 'empty' },
];

// Letters-hint chips: word letters remain solid; decoys get struck through as used.
const CHIPS: { ch: string; struck?: boolean }[] = [
  { ch: 'A' }, { ch: 'B', struck: true }, { ch: 'E', struck: true },
  { ch: 'L' }, { ch: 'N', struck: true }, { ch: 'U' },
];

export const RoundHintScreen: React.FC = () => (
  <div style={{ ...screen, padding: '24px 0 14px' }}>
    <GlanceBar topic="SPACE & SCI-FI" hue={HUE} rating={1240} />

    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <RekhaRail hue={HUE} progress={0.38} timeLabel="0:23" />
      <SlotRow slots={SLOTS} hue={HUE} />
      <div style={{ height: 44, padding: '20px 44px 0', textAlign: 'center', fontFamily: fonts.body, fontSize: 15, lineHeight: 1.45, color: tokens.paperDim }}>
        A stellar nursery — the cloud where stars are born.
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 22 }}>
        {CHIPS.map(({ ch, struck }) => (
          <div
            key={ch}
            style={{
              minWidth: 36, height: 40, padding: '0 6px', boxSizing: 'border-box', borderRadius: 8,
              background: struck ? 'rgba(233,234,242,.03)' : 'rgba(233,234,242,.08)',
              border: struck ? '1px solid rgba(233,234,242,.1)' : `1px solid ${accent(HUE, 0.5)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: fonts.mono, fontSize: 15,
              color: struck ? tokens.paperDim : tokens.paper,
              textDecoration: struck ? 'line-through' : 'none',
            }}
          >
            {ch}
          </div>
        ))}
      </div>
    </div>

    <HintBar hue={HUE} spent={['letters']} />
    <Keyboard />
  </div>
);

export default RoundHintScreen;
