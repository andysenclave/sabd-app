import React from 'react';
import { tokens, fonts, accent, topicHues, screen } from './tokens';
import { GlanceBar, HintBar } from './components/Chrome';
import { RekhaRail, SlotRow, Slot } from './components/RekhaRail';
import { Keyboard } from './components/Keyboard';

// Round screen — LOCKED layout (mockup 3a/6b): glance-only top, word module
// vertically centered, everything tappable in the bottom dock.

const HUE = topicHues.gaming;

const SLOTS: Slot[] = [
  { char: 'S', state: 'filled' },
  { state: 'focused' },
  { state: 'empty' },
  { state: 'empty' },
  { state: 'empty' },
];

export const RoundScreen: React.FC = () => (
  <div style={{ ...screen, padding: '24px 0 14px' }}>
    <GlanceBar topic="GAMING" hue={HUE} rating={1240} />

    {/* Word module — one block, vertically centered */}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <RekhaRail hue={HUE} progress={0.87} timeLabel="0:52" />
      <SlotRow slots={SLOTS} hue={HUE} />
      {/* Description: 15px paperDim, 2-line reserve, never reflows */}
      <div style={{ height: 44, padding: '20px 44px 0', textAlign: 'center', fontFamily: fonts.body, fontSize: 15, lineHeight: 1.45, color: tokens.paperDim }}>
        You respawn here after dying — checkpoint's older sibling.
      </div>
    </div>

    {/* Control dock */}
    <HintBar hue={HUE} />
    <Keyboard />
  </div>
);

export default RoundScreen;
