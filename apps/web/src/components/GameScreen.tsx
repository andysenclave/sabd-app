import React, { useCallback, useEffect, useState } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { useSkin } from '../skins';
import { sec, motion as M } from '../tokens';
import { useRound } from '../game/useRound';
import { topicMetaFor } from '../mock/words';
import type { SabdConfig } from '../config';
import type { RoundResult, WordEntry } from '../types';
import { GlanceBar } from './GlanceBar';
import { RekhaRail } from './RekhaRail';
import { SlotRow } from './SlotRow';
import { Description } from './Description';
import { LetterChips } from './LetterChips';
import { HintBar } from './HintBar';
import { Keyboard } from './Keyboard';
import { ResultOverlay } from './ResultOverlay';

// STUB rating delta — NOT real Elo. The real engine plugs in via onRoundEnd; this
// only feeds the odometer so the reward beat is visible. Faster + fewer hints = more.
export function stubRatingDelta(r: RoundResult): number {
  if (!r.solved) return -6;
  const timeFrac = 1 - r.timeUsedSec / r.timeLimitSec; // more time left = better
  return Math.max(6, Math.round(14 + timeFrac * 14 - r.hintsUsed.length * 4));
}

// GameScreen — orchestrates round state, wires hints→timer, detects solve/timeout,
// and emits the §2 RoundResult via onRoundEnd. Mount it with key={entry.id} so a
// new word starts a fresh round. Layout is the LOCKED 3a: glance-only top, word
// module vertically centered, everything tappable in the bottom control dock.
export const GameScreen: React.FC<{
  entry: WordEntry;
  config: SabdConfig;
  ratingBefore: number;
  onRoundEnd?: (result: RoundResult) => void;
  onNext: () => void;
}> = ({ entry, config, ratingBefore, onRoundEnd, onNext }) => {
  const s = useSkin();
  const reduce = useReducedMotion();
  const { hue, label } = topicMetaFor(entry.topic);

  const [result, setResult] = useState<RoundResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleEnd = useCallback(
    (r: RoundResult) => {
      // The rating-engine seam. Engine is stubbed: log + surface on screen.
      // eslint-disable-next-line no-console
      console.log('[SABD] onRoundEnd', r);
      setResult(r);
      onRoundEnd?.(r);
    },
    [onRoundEnd],
  );

  const round = useRound({ entry, config, onRoundEnd: handleEnd });
  const { status, submit, backspace, typeLetter, wrongKey } = round;

  // Solve → hold one ceremony beat (rail flash + glyph wave), THEN the result.
  // Timeout → straight to the muted result (no ceremony).
  useEffect(() => {
    if (status === 'timeout') {
      setShowResult(true);
      return;
    }
    if (status === 'solved') {
      const t = window.setTimeout(() => setShowResult(true), reduce ? 250 : M.ceremony + 250);
      return () => window.clearTimeout(t);
    }
  }, [status, reduce]);

  // Physical keyboard (desktop). Touch keyboard handled below via onKey.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (status !== 'playing') return;
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        backspace();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        typeLetter(e.key);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [status, submit, backspace, typeLetter]);

  // Wrong-guess: the RAIL shakes (slots stay put, design §5). Reduced-motion: skip.
  const shake = useAnimationControls();
  useEffect(() => {
    if (wrongKey === 0 || reduce) return;
    shake.start({
      x: [0, -4, 4, -4, 4, 0],
      transition: { duration: sec(M.fast) * 1.6, ease: 'linear' },
    });
  }, [wrongKey, reduce, shake]);

  const onKey = (k: string) => {
    if (k === '⏎') submit();
    else if (k === '⌫') backspace();
    else typeLetter(k);
  };

  const atmosphericGlow =
    config.glowPolicy === 'always' || (config.glowPolicy === 'stakes-only' && round.critical);

  const isSolvedCeremony = status === 'solved';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        background: s.tokens.ink,
        padding: '24px 0 14px',
        boxSizing: 'border-box',
      }}
    >
      <GlanceBar topic={label} hue={hue} rating={ratingBefore} />

      {/* Word module — one block, vertically centered (LOCKED 3a) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <motion.div animate={shake}>
          <RekhaRail
            hue={hue}
            progress={round.progress}
            timeLabel={isSolvedCeremony ? `${round.timeLabel} — HELD` : round.timeLabel}
            critical={round.critical}
            solved={isSolvedCeremony}
            atmosphericGlow={atmosphericGlow}
          />
        </motion.div>

        <SlotRow slots={round.slots} hue={hue} solved={isSolvedCeremony} />

        <Description text={entry.description} />

        <LetterChips chips={round.chips} hue={hue} onPick={typeLetter} />

        {isSolvedCeremony && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <span
              style={{
                fontFamily: s.fonts.display,
                fontStretch: '125%',
                fontWeight: 900,
                fontSize: 22,
                letterSpacing: 4,
                color: s.accent(hue, undefined, 0.83),
              }}
            >
              SOLVED
            </span>
          </div>
        )}
      </div>

      {/* Control dock — everything tappable (bottom ~55%) */}
      <HintBar hue={hue} spent={round.hintsUsed} costs={config.hintCosts} onHint={round.useHint} />
      {config.onScreenKeyboard && <Keyboard onKey={onKey} disabled={status !== 'playing'} />}

      {showResult && result && (
        <ResultOverlay
          entry={entry}
          hue={hue}
          result={result}
          ratingBefore={ratingBefore}
          ratingDelta={stubRatingDelta(result)}
          onNext={onNext}
          onHome={onNext}
        />
      )}
    </div>
  );
};
