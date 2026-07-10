import React, { useEffect, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { useSkin } from '../skins';
import { sec, motion as M, ease } from '../tokens';
import type { RoundResult, WordEntry } from '../types';

// Rating odometer (THE dopamine beat, design §5): rolls digit-by-digit on mount.
// reduced-motion → crossfade (just lands on the final number).
const Odometer: React.FC<{ from: number; to: number; color: string; size: number }> = ({
  from,
  to,
  color,
  size,
}) => {
  const s = useSkin();
  const reduce = useReducedMotion();
  const [val, setVal] = useState(reduce ? to : from);
  useEffect(() => {
    if (reduce) {
      setVal(to);
      return;
    }
    const controls = animate(from, to, {
      duration: sec(M.ceremony),
      ease: [0, 0, 0.58, 1], // CSS ease-out as a bezier (framer numeric-animate typing)
      onUpdate: (v) => setVal(Math.round(v)),
    });
    return () => controls.stop();
  }, [from, to, reduce]);
  return (
    <span
      style={{
        fontFamily: s.fonts.mono,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: -2,
        color,
      }}
    >
      {val}
    </span>
  );
};

// Result — win ceremony vs timeout muted reveal (design §4 Result, mockups 6e/6f).
// Also surfaces the raw §2 RoundResult object on screen (brief §7 requirement).
export const ResultOverlay: React.FC<{
  entry: WordEntry;
  hue: number;
  result: RoundResult;
  ratingBefore: number;
  ratingDelta: number; // STUB — see GameScreen. Not real Elo math.
  onNext: () => void;
  onHome: () => void;
}> = ({ entry, hue, result, ratingBefore, ratingDelta, onNext, onHome }) => {
  const s = useSkin();
  const reduce = useReducedMotion();
  const solved = result.solved;
  const word = entry.word.toUpperCase().split('');
  const ratingAfter = ratingBefore + ratingDelta;

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: sec(M.beat), ease: ease.settle }}
      style={{
        position: 'absolute',
        inset: 0,
        background: s.tokens.ink,
        display: 'flex',
        flexDirection: 'column',
        padding: '30px 26px',
        boxSizing: 'border-box',
        zIndex: 10,
      }}
    >
      {/* Verdict + time */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span
          style={{
            fontFamily: s.fonts.display,
            fontStretch: '125%',
            fontWeight: 900,
            fontSize: 30,
            letterSpacing: 2,
            color: solved ? s.tokens.paper : s.tokens.paperDim,
          }}
        >
          {solved ? 'SOLVED' : 'TIME.'}
        </span>
        <span
          style={{
            fontFamily: s.fonts.mono,
            fontSize: 12,
            color: solved ? s.tokens.paperDim : s.tokens.signal,
          }}
        >
          {solved ? `${(result.timeLimitSec - result.timeUsedSec).toFixed(1)}s LEFT` : '0:00'}
        </span>
      </div>

      {/* Answer rail — accent-tinted (win) or signal-burnt (timeout) */}
      <div style={{ marginTop: 36 }}>
        <div
          style={{
            height: 3,
            borderRadius: 2,
            background: solved ? s.accent(hue) : 'rgba(228,87,61,.35)',
          }}
        />
        <div style={{ display: 'flex', gap: 5 }}>
          {word.map((ch, i) => (
            <motion.div
              key={i}
              initial={reduce || solved ? { opacity: solved ? 1 : 0 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: solved ? 0 : 0.15 + i * 0.05, duration: sec(M.beat) }}
              style={{
                width: word.length > 6 ? 30 : 34,
                height: 40,
                borderRadius: '0 0 6px 6px',
                background: solved ? s.accent(hue, 0.14) : 'rgba(233,234,242,.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: s.fonts.mono,
                fontWeight: solved ? 700 : 400,
                fontSize: 18,
                color: solved ? s.tokens.paper : s.tokens.paperDim,
              }}
            >
              {ch}
            </motion.div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontFamily: s.fonts.body, fontSize: 13, color: s.tokens.paperDim }}>
          “{entry.description}” ·{' '}
          {result.hintsUsed.length ? `hints: ${result.hintsUsed.join(', ')}` : 'no hints used'}
        </div>
      </div>

      {/* Rating beat — odometer (win) or quiet −Δ (timeout, no ceremony) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: solved ? s.tokens.kesar : s.tokens.paperDim, fontSize: 15 }}>◆</span>
          <Odometer
            from={ratingBefore}
            to={ratingAfter}
            color={solved ? s.tokens.paper : s.tokens.paperDim}
            size={solved ? 56 : 40}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: s.fonts.mono, fontSize: 14, color: s.tokens.paperDim }}>
            {ratingBefore} →
          </span>
          <span
            style={{
              fontFamily: s.fonts.mono,
              fontWeight: 700,
              fontSize: solved ? 20 : 14,
              color: solved ? s.tokens.kesar : s.tokens.paperDim,
            }}
          >
            {ratingDelta >= 0 ? `+${ratingDelta}` : ratingDelta}
          </span>
        </div>

        {/* The raw §2 RoundResult object, on screen (brief §7). */}
        <pre
          style={{
            marginTop: 14,
            padding: '10px 14px',
            borderRadius: 8,
            background: s.tokens.ink2,
            fontFamily: s.fonts.mono,
            fontSize: 11,
            lineHeight: 1.6,
            color: s.tokens.paperDim,
            textAlign: 'left',
            maxWidth: '100%',
            overflowX: 'auto',
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      </div>

      {/* CTAs — one kesar primary on win; both ghost on timeout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          onClick={onNext}
          style={{
            height: 56,
            border: solved ? 'none' : '1px solid rgba(233,234,242,.25)',
            borderRadius: 12,
            cursor: 'pointer',
            background: solved ? s.tokens.kesar : 'transparent',
            fontFamily: s.fonts.display,
            fontStretch: '120%',
            fontWeight: 900,
            fontSize: 16,
            letterSpacing: 2,
            color: solved ? s.tokens.ink : s.tokens.paper,
          }}
        >
          {solved ? 'NEXT WORD' : 'RETRY TOPIC'}
        </button>
        <button
          onClick={onHome}
          style={{
            height: 48,
            background: 'transparent',
            border: '1px solid rgba(233,234,242,.16)',
            borderRadius: 12,
            cursor: 'pointer',
            fontFamily: s.fonts.mono,
            fontSize: 12,
            letterSpacing: 2,
            color: s.tokens.paperDim,
          }}
        >
          HOME
        </button>
        <div style={{ textAlign: 'center', marginTop: 2 }}>
          <span style={{ fontFamily: s.fonts.devanagari, fontSize: 15, color: 'rgba(240,163,58,.4)' }}>
            शब्द
          </span>
        </div>
      </div>
    </motion.div>
  );
};
