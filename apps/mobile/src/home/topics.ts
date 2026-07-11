/**
 * The six canonical topics — card names (mockup 8b), bank topic strings
 * (content pipeline's TOPICS map), and the scatter-glyph wallpaper spec from
 * the locked reference (docs/design/tsx-export/HomeScreen.tsx).
 *
 * Gaming's glyphs are generic face-button GEOMETRY (△○✕□) — never PS/Xbox
 * trademarks.
 */

import type { TopicId } from '@sabd/contracts';

export interface TopicMeta {
  id: TopicId;
  /** Card display name. */
  name: string;
  /** The topic string as it appears in WordEntry.topic / the event log. */
  bankTopic: string;
}

export const TOPICS: readonly TopicMeta[] = [
  { id: 'gaming', name: 'GAMING', bankTopic: 'Gaming' },
  { id: 'space', name: 'SPACE & SCI-FI', bankTopic: 'Space & Sci-Fi' },
  { id: 'music', name: 'MUSIC', bankTopic: 'Music' },
  { id: 'internet', name: 'INTERNET & TECH', bankTopic: 'Internet & Tech Culture' },
  { id: 'food', name: 'FOOD & DRINK', bankTopic: 'Food & Drink' },
  { id: 'world', name: 'WORLD & PLACES', bankTopic: 'World & Places' },
];

export function topicById(id: TopicId): TopicMeta {
  return TOPICS.find((t) => t.id === id)!;
}

export interface ScatterGlyph {
  ch: string;
  right: number;
  top?: number;
  bottom?: number;
  size: number;
  opacity: number;
  rotate: number;
  mono?: boolean;
}

export const SCATTER: Record<TopicId, ScatterGlyph[]> = {
  gaming: [
    { ch: '△', right: 10, top: 14, size: 17, opacity: 0.14, rotate: 12, mono: true },
    { ch: '○', right: 44, top: 44, size: 14, opacity: 0.1, rotate: -8, mono: true },
    { ch: '✕', right: 14, bottom: 38, size: 20, opacity: 0.15, rotate: -14, mono: true },
    { ch: '□', right: 52, bottom: 10, size: 13, opacity: 0.09, rotate: 10, mono: true },
    { ch: '✕', right: 86, top: 20, size: 12, opacity: 0.08, rotate: -16, mono: true },
  ],
  space: [
    { ch: '✦', right: 12, top: 16, size: 16, opacity: 0.15, rotate: 0 },
    { ch: '✧', right: 48, top: 38, size: 11, opacity: 0.1, rotate: 0 },
    { ch: '✦', right: 20, bottom: 40, size: 13, opacity: 0.12, rotate: 0 },
    { ch: '✧', right: 64, bottom: 14, size: 18, opacity: 0.14, rotate: 0 },
    { ch: '✦', right: 90, top: 18, size: 10, opacity: 0.08, rotate: 0 },
  ],
  music: [
    { ch: '♪', right: 10, top: 12, size: 22, opacity: 0.14, rotate: 10 },
    { ch: '♫', right: 44, top: 42, size: 15, opacity: 0.1, rotate: -12 },
    { ch: '♫', right: 16, bottom: 36, size: 26, opacity: 0.15, rotate: -6 },
    { ch: '♪', right: 58, bottom: 12, size: 14, opacity: 0.09, rotate: 14 },
  ],
  internet: [
    { ch: '@', right: 12, top: 14, size: 18, opacity: 0.14, rotate: -8, mono: true },
    { ch: '#', right: 50, top: 40, size: 13, opacity: 0.1, rotate: 10, mono: true },
    { ch: '/', right: 18, bottom: 38, size: 15, opacity: 0.12, rotate: 8, mono: true },
    { ch: '</>', right: 56, bottom: 12, size: 16, opacity: 0.1, rotate: -12, mono: true },
  ],
  food: [
    { ch: '♨', right: 12, top: 14, size: 18, opacity: 0.14, rotate: 8 },
    { ch: '●', right: 48, top: 42, size: 13, opacity: 0.1, rotate: -10 },
    { ch: '♨', right: 18, bottom: 36, size: 20, opacity: 0.14, rotate: -6 },
    { ch: '●', right: 56, bottom: 12, size: 12, opacity: 0.09, rotate: 12 },
  ],
  world: [
    { ch: '◉', right: 12, top: 14, size: 17, opacity: 0.14, rotate: -6 },
    { ch: '▲', right: 48, top: 40, size: 12, opacity: 0.1, rotate: 10 },
    { ch: '◉', right: 18, bottom: 38, size: 19, opacity: 0.14, rotate: 8 },
    { ch: '▲', right: 58, bottom: 12, size: 13, opacity: 0.09, rotate: -12 },
  ],
};
