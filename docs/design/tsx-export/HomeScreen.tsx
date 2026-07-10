import React from 'react';

// SABD — Home / topic select (LOCKED: mockup 8b — scatter-pattern cards).
// Self-contained: no imports beyond React. Fonts required (Google Fonts):
// Khand 700, Archivo (variable wdth/wght), Martian Mono 400/700, Instrument Sans.

// ---- tokens ----
const T = {
  ink: '#171A24', ink2: '#222634', paper: '#E9EAF2', paperDim: '#8B8FA3', kesar: '#F2A33C',
} as const;
const F = {
  mono: "'Martian Mono', monospace",
  display: "'Archivo', sans-serif",
  devanagari: "'Tiro Devanagari Sanskrit', serif",
} as const;
const accent = (hue: number, alpha?: number, l = 0.75) =>
  alpha === undefined ? `oklch(${l} 0.13 ${hue})` : `oklch(${l} 0.13 ${hue} / ${alpha})`;

// ---- data ----
export type TopicId = 'gaming' | 'space' | 'music' | 'internet' | 'food' | 'world';

export interface Topic {
  id: TopicId;
  name: string;
  hue: number;
  rating: number | null; // null = unplayed (dim, no glow)
}

export const DEFAULT_TOPICS: Topic[] = [
  { id: 'gaming', name: 'GAMING', hue: 300, rating: 1310 },
  { id: 'space', name: 'SPACE & SCI-FI', hue: 250, rating: 1198 },
  { id: 'music', name: 'MUSIC', hue: 345, rating: 1244 },
  { id: 'internet', name: 'INTERNET & TECH', hue: 195, rating: 1102 },
  { id: 'food', name: 'FOOD & DRINK', hue: 70, rating: null },
  { id: 'world', name: 'WORLD & PLACES', hue: 150, rating: 1075 },
];

// ---- scatter motifs (locked 8b) ----
// Each card carries 4–5 small category glyphs scattered wallpaper-style at
// varied size/rotation/opacity (0.08–0.15). Gaming uses the generic
// face-button shapes △○✕□ (basic geometry — NOT PlayStation/Xbox marks,
// which are trademarks and must not be shipped).
interface Glyph { ch: string; right: number; top?: number; bottom?: number; size: number; opacity: number; rotate: number; mono?: boolean }

const SCATTER: Record<TopicId, Glyph[]> = {
  gaming: [
    { ch: '△', right: 10, top: 14, size: 17, opacity: 0.14, rotate: 12, mono: true },
    { ch: '○', right: 44, top: 44, size: 14, opacity: 0.10, rotate: -8, mono: true },
    { ch: '✕', right: 14, bottom: 38, size: 20, opacity: 0.15, rotate: -14, mono: true },
    { ch: '□', right: 52, bottom: 10, size: 13, opacity: 0.09, rotate: 10, mono: true },
    { ch: '✕', right: 86, top: 20, size: 12, opacity: 0.08, rotate: -16, mono: true },
  ],
  space: [
    { ch: '✦', right: 12, top: 16, size: 16, opacity: 0.15, rotate: 0 },
    { ch: '✧', right: 48, top: 38, size: 11, opacity: 0.10, rotate: 0 },
    { ch: '✦', right: 20, bottom: 40, size: 13, opacity: 0.12, rotate: 0 },
    { ch: '✧', right: 64, bottom: 14, size: 18, opacity: 0.14, rotate: 0 },
    { ch: '✦', right: 90, top: 18, size: 10, opacity: 0.08, rotate: 0 },
  ],
  music: [
    { ch: '♪', right: 10, top: 12, size: 22, opacity: 0.14, rotate: 10 },
    { ch: '♫', right: 44, top: 42, size: 15, opacity: 0.10, rotate: -12 },
    { ch: '♫', right: 16, bottom: 36, size: 26, opacity: 0.15, rotate: -6 },
    { ch: '♪', right: 58, bottom: 12, size: 14, opacity: 0.09, rotate: 14 },
  ],
  internet: [
    { ch: '@', right: 12, top: 14, size: 18, opacity: 0.14, rotate: -8, mono: true },
    { ch: '#', right: 50, top: 40, size: 13, opacity: 0.10, rotate: 10, mono: true },
    { ch: '/', right: 18, bottom: 38, size: 15, opacity: 0.12, rotate: 8, mono: true },
    { ch: '</>', right: 56, bottom: 12, size: 16, opacity: 0.10, rotate: -12, mono: true },
  ],
  food: [
    { ch: '♨', right: 12, top: 14, size: 18, opacity: 0.14, rotate: 8 },
    { ch: '●', right: 48, top: 42, size: 13, opacity: 0.10, rotate: -10 },
    { ch: '♨', right: 18, bottom: 36, size: 20, opacity: 0.14, rotate: -6 },
    { ch: '●', right: 56, bottom: 12, size: 12, opacity: 0.09, rotate: 12 },
  ],
  world: [
    { ch: '◉', right: 12, top: 14, size: 17, opacity: 0.14, rotate: -6 },
    { ch: '▲', right: 48, top: 40, size: 12, opacity: 0.10, rotate: 10 },
    { ch: '◉', right: 18, bottom: 38, size: 19, opacity: 0.14, rotate: 8 },
    { ch: '▲', right: 58, bottom: 12, size: 13, opacity: 0.09, rotate: -12 },
  ],
};

const Scatter: React.FC<{ id: TopicId; hue: number }> = ({ id, hue }) => (
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', color: accent(hue), lineHeight: 1 }}>
    {SCATTER[id].map((g, i) => (
      <span
        key={i}
        style={{
          position: 'absolute', right: g.right,
          ...(g.top !== undefined ? { top: g.top } : { bottom: g.bottom }),
          fontSize: g.size, opacity: g.opacity, transform: `rotate(${g.rotate}deg)`,
          fontFamily: g.mono ? F.mono : undefined, fontWeight: g.mono ? 700 : undefined,
        }}
      >
        {g.ch}
      </span>
    ))}
  </div>
);

// ---- topic card ----
const TopicCard: React.FC<{ topic: Topic; selected?: boolean; onSelect?: (id: TopicId) => void }> = ({ topic, selected, onSelect }) => (
  <div
    onClick={() => onSelect?.(topic.id)}
    style={{
      position: 'relative', background: T.ink2, borderRadius: 12, overflow: 'hidden',
      minHeight: 150, cursor: 'pointer',
      outline: selected ? `2px solid ${accent(topic.hue)}` : 'none', outlineOffset: -2,
    }}
  >
    <div style={{ height: 3, background: accent(topic.hue) }} />
    <Scatter id={topic.id} hue={topic.hue} />
    <div style={{ position: 'relative', padding: '14px 15px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ fontFamily: F.display, fontStretch: '118%', fontWeight: 800, fontSize: 16, letterSpacing: 0.5, color: T.paper }}>
        {topic.name}
      </div>
      <div style={{ flex: 1 }} />
      {topic.rating !== null ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingBottom: 6 }}>
          <span style={{ color: accent(topic.hue), fontSize: 10 }}>◆</span>
          <span style={{
            fontFamily: F.mono, fontWeight: 700, fontSize: 25,
            color: accent(topic.hue, undefined, 0.8),
            textShadow: `0 0 16px ${accent(topic.hue, 0.75)}`, // the glow
          }}>
            {topic.rating}
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingBottom: 6 }}>
          <span style={{ color: T.paperDim, fontSize: 10 }}>◇</span>
          <span style={{ fontFamily: F.mono, fontSize: 14, letterSpacing: 1, color: T.paperDim, lineHeight: '25px' }}>UNPLAYED</span>
        </div>
      )}
    </div>
  </div>
);

// ---- screen ----
export interface HomeScreenProps {
  rating?: number;
  percentile?: number;
  topics?: Topic[];
  selectedTopic?: TopicId;
  onSelectTopic?: (id: TopicId) => void;
  onPlay?: () => void;
  onChallenge?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  rating = 1240, percentile = 18, topics = DEFAULT_TOPICS,
  selectedTopic = 'gaming', onSelectTopic, onPlay, onChallenge,
}) => {
  const selected = topics.find((t) => t.id === selectedTopic);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100dvh',
      background: T.ink, padding: '26px 24px 30px', boxSizing: 'border-box',
    }}>
      {/* Header: wordmark left (Rekha through cap-height, शब्द mark), rating right */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        {/* Final lockup (LOGO.md): rail ABOVE the word — never through it; no शब्द
            beside SABD (scripts rotate in time on the splash, never side-by-side).
            Below 48px wordmark height: rail + plain Khand only. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ width: 112, height: 4, borderRadius: 1, background: T.kesar }} />
          <span style={{ fontFamily: "'Khand', sans-serif", fontWeight: 700, fontSize: 30, lineHeight: 1, color: T.paper, letterSpacing: 2, padding: '0 4px' }}>SABD</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ color: T.kesar, fontSize: 11 }}>◆</span>
            <span style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 26, color: T.paper, letterSpacing: -1, textShadow: '0 0 18px rgba(242,163,60,.4)' }}>
              {rating}
            </span>
          </div>
          <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, color: T.paperDim }}>TOP {percentile}%</span>
        </div>
      </div>

      {/* Topic grid — fills the middle, cards stretch */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 24, flex: 1, alignContent: 'stretch' }}>
        {topics.map((t) => (
          <TopicCard key={t.id} topic={t} selected={t.id === selectedTopic} onSelect={onSelectTopic} />
        ))}
      </div>

      {/* CTA dock — thumb zone */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', marginTop: 20 }}>
        <button
          onClick={onPlay}
          style={{
            width: '100%', height: 56, background: T.kesar, border: 'none', borderRadius: 12, cursor: 'pointer',
            fontFamily: "'Khand', sans-serif", fontWeight: 700, fontSize: 19, letterSpacing: 2, color: T.ink,
          }}
        >
          PLAY · {selected?.name ?? ''}
        </button>
        <button
          onClick={onChallenge}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: F.mono, fontSize: 12, letterSpacing: 1, color: T.paperDim }}
        >
          ⚔ CHALLENGE A RIVAL
        </button>
      </div>
    </div>
  );
};

export default HomeScreen;
