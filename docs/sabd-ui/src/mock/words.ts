// SABD — mock word bank (§5.2). 10 entries across all six topics and all three
// tiers, matching the §2 WordEntry contract EXACTLY. GAMER is seeded verbatim
// from sabd-content/data/clean/sabd-wordbank.json (GAM-0001); RESPAWN is the
// contract's own example. The rest are hand-authored in the design's riddle voice.
//
// To swap the deck: edit this array (keep the §2 shape) — nothing else changes.
import { topicHues, type TopicId } from '../tokens';
import type { WordEntry } from '../types';

export const MOCK_WORDS: WordEntry[] = [
  {
    id: 'GAM-0142',
    word: 'RESPAWN',
    topic: 'Gaming',
    length: 7,
    difficulty: 1380,
    tier: 'mid',
    description: "The second chance that keeps a firefight going — checkpoint's louder sibling.",
    hints: { position: { index: 3, letter: 'P' }, letters: { correct: 'W', decoy: 'K' } },
  },
  {
    id: 'GAM-0001',
    word: 'GAMER',
    topic: 'Gaming',
    length: 5,
    difficulty: 820,
    tier: 'low',
    description: 'Controller in hand, sleep optional.',
    hints: { position: { index: 2, letter: 'M' }, letters: { correct: 'R', decoy: 'T' } },
  },
  {
    id: 'GAM-0231',
    word: 'SPEEDRUN',
    topic: 'Gaming',
    length: 8,
    difficulty: 1610,
    tier: 'high',
    description: "Finish the whole game before the popcorn's done.",
    hints: { position: { index: 0, letter: 'S' }, letters: { correct: 'D', decoy: 'G' } },
  },
  {
    id: 'SPC-0044',
    word: 'NEBULA',
    topic: 'Space & Sci-Fi',
    length: 6,
    difficulty: 1290,
    tier: 'mid',
    description: 'A stellar nursery — the cloud where stars are born.',
    hints: { position: { index: 2, letter: 'B' }, letters: { correct: 'L', decoy: 'D' } },
  },
  {
    id: 'SPC-0012',
    word: 'WARP',
    topic: 'Space & Sci-Fi',
    length: 4,
    difficulty: 880,
    tier: 'low',
    description: "Skip the space between two points; don't ask the physics.",
    hints: { position: { index: 0, letter: 'W' }, letters: { correct: 'P', decoy: 'B' } },
  },
  {
    id: 'MUS-0088',
    word: 'VINYL',
    topic: 'Music',
    length: 5,
    difficulty: 1240,
    tier: 'mid',
    description: 'Records that never really died — ask any collector.',
    hints: { position: { index: 3, letter: 'Y' }, letters: { correct: 'V', decoy: 'F' } },
  },
  {
    id: 'MUS-0021',
    word: 'TEMPO',
    topic: 'Music',
    length: 5,
    difficulty: 900,
    tier: 'low',
    description: 'The heartbeat a metronome keeps arguing about.',
    hints: { position: { index: 0, letter: 'T' }, letters: { correct: 'P', decoy: 'B' } },
  },
  {
    id: 'INT-0107',
    word: 'FIREWALL',
    topic: 'Internet & Tech',
    length: 8,
    difficulty: 1560,
    tier: 'high',
    description: 'The bouncer standing between your network and the bad guys.',
    hints: { position: { index: 4, letter: 'W' }, letters: { correct: 'F', decoy: 'Z' } },
  },
  {
    id: 'FUD-0033',
    word: 'UMAMI',
    topic: 'Food & Drink',
    length: 5,
    difficulty: 1320,
    tier: 'mid',
    description: "The fifth taste — savory, and hard to name until you've had it.",
    hints: { position: { index: 0, letter: 'U' }, letters: { correct: 'M', decoy: 'N' } },
  },
  {
    id: 'WRL-0059',
    word: 'ATOLL',
    topic: 'World & Places',
    length: 5,
    difficulty: 1270,
    tier: 'mid',
    description: 'A ring of coral with a lagoon holding the middle.',
    hints: { position: { index: 2, letter: 'O' }, letters: { correct: 'T', decoy: 'S' } },
  },
];

// ---- topic string → design identity (TopicId + accent hue + display label) ----
// WordEntry.topic is a human string; the design keys accent hue off TopicId.
interface TopicMeta {
  id: TopicId;
  hue: number;
  label: string;
}

const TOPIC_META: Record<string, TopicMeta> = {
  Gaming: { id: 'gaming', hue: topicHues.gaming, label: 'GAMING' },
  'Space & Sci-Fi': { id: 'space', hue: topicHues.space, label: 'SPACE & SCI-FI' },
  Music: { id: 'music', hue: topicHues.music, label: 'MUSIC' },
  'Internet & Tech': { id: 'internet', hue: topicHues.internet, label: 'INTERNET & TECH' },
  'Food & Drink': { id: 'food', hue: topicHues.food, label: 'FOOD & DRINK' },
  'World & Places': { id: 'world', hue: topicHues.world, label: 'WORLD & PLACES' },
};

const FALLBACK_META: TopicMeta = { id: 'gaming', hue: topicHues.gaming, label: 'SABD' };

export function topicMetaFor(topic: string): TopicMeta {
  return TOPIC_META[topic] ?? { ...FALLBACK_META, label: topic.toUpperCase() };
}
