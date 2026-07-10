import React, { useCallback, useMemo, useState } from 'react';
import { SkinContext, resolveSkin } from './skins';
import { config, skinFromUrl } from './config';
import { MOCK_WORDS } from './mock/words';
import type { RoundResult } from './types';
import { GameScreen, stubRatingDelta } from './components/GameScreen';

// Single-screen game route. Owns the word deck + the (stubbed) running rating,
// provides the active skin, and cycles words on NEXT. The whole GameScreen is
// keyed per round so useRound re-initialises cleanly.
export const App: React.FC = () => {
  const skin = useMemo(() => resolveSkin(skinFromUrl(config.skin)), []);
  const [wordIndex, setWordIndex] = useState(0);
  const [roundNo, setRoundNo] = useState(0);
  const [rating, setRating] = useState(1240);

  const entry = MOCK_WORDS[wordIndex % MOCK_WORDS.length];

  const handleRoundEnd = useCallback((result: RoundResult) => {
    // Rating-engine SEAM. Real engine plugs in here; for now, advance the stub.
    setRating((r) => r + stubRatingDelta(result));
  }, []);

  const handleNext = useCallback(() => {
    setWordIndex((i) => (i + 1) % MOCK_WORDS.length);
    setRoundNo((n) => n + 1);
  }, []);

  return (
    <SkinContext.Provider value={skin}>
      <div className="sabd-frame" style={{ background: skin.tokens.ink }}>
        <GameScreen
          key={`${entry.id}-${roundNo}`}
          entry={entry}
          config={config}
          ratingBefore={rating}
          onRoundEnd={handleRoundEnd}
          onNext={handleNext}
        />
        {skin.scanlines && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 50,
              background:
                'repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,.18) 3px)',
              mixBlendMode: 'multiply',
            }}
          />
        )}
      </div>
    </SkinContext.Provider>
  );
};

export default App;
