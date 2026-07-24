// Tracks how well the user knows each chord, across their whole library —
// fed by quiz results (flashcards, ear training) and practice reps (chord-
// switch drill, section looper). Used to recommend which songs are easiest
// to learn next from what they already know.

import type { Song } from '../types';
import { extractChords } from './chordpro';

export interface ChordStat {
  symbol: string;
  /** 0 (new) .. 5 (known cold). Quizzes move it up/down; practice reps nudge it up. */
  level: number;
  attempts: number;
  correct: number;
  reps: number;
  lastPracticed: number;
}

export type MasteryMap = Record<string, ChordStat>;

export const MAX_LEVEL = 5;
export const KNOWN_THRESHOLD = 3;

export function classify(level: number | undefined): 'new' | 'learning' | 'known' {
  if (!level) return 'new';
  if (level >= KNOWN_THRESHOLD) return 'known';
  return 'learning';
}

/** Normalize a chord symbol for tracking — ignore slash-bass, keep the shape. */
export function masteryKey(symbol: string): string {
  return symbol.split('/')[0];
}

function getOrInit(map: MasteryMap, symbol: string): ChordStat {
  const key = masteryKey(symbol);
  return map[key] ?? { symbol: key, level: 0, attempts: 0, correct: 0, reps: 0, lastPracticed: 0 };
}

export function recordQuizResult(map: MasteryMap, symbol: string, isCorrect: boolean): MasteryMap {
  const stat = getOrInit(map, symbol);
  const level = clamp(stat.level + (isCorrect ? 1 : -1.2));
  const next: ChordStat = {
    ...stat,
    level,
    attempts: stat.attempts + 1,
    correct: stat.correct + (isCorrect ? 1 : 0),
    lastPracticed: Date.now(),
  };
  return { ...map, [next.symbol]: next };
}

export function recordPractice(map: MasteryMap, symbols: string[]): MasteryMap {
  const now = Date.now();
  const next = { ...map };
  for (const raw of symbols) {
    const stat = getOrInit(next, raw);
    next[stat.symbol] = { ...stat, level: clamp(stat.level + 0.3), reps: stat.reps + 1, lastPracticed: now };
  }
  return next;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(MAX_LEVEL, n));
}

// ---- Library-wide chord pool -------------------------------------------

export interface ChordPoolEntry {
  symbol: string;
  count: number; // how many songs use it
}

/** Every distinct chord across a set of songs, with how many songs use it. */
export function chordPool(songs: Song[]): ChordPoolEntry[] {
  const counts = new Map<string, number>();
  for (const s of songs) {
    for (const raw of extractChords(s.body)) {
      const c = masteryKey(raw);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([symbol, count]) => ({ symbol, count }))
    .sort((a, b) => b.count - a.count);
}

/** Weighted pick favoring chords the user knows least, but sometimes reviewing known ones. */
export function pickWeighted(pool: ChordPoolEntry[], mastery: MasteryMap, exclude?: string): ChordPoolEntry | null {
  const candidates = pool.filter((p) => p.symbol !== exclude);
  if (candidates.length === 0) return pool[0] ?? null;
  const weights = candidates.map((c) => {
    const level = mastery[c.symbol]?.level ?? 0;
    return 1 + (MAX_LEVEL - level) * 2; // less-known chords come up more often
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/** Songs sorted by fewest chords the user doesn't yet know. */
export interface SongGap {
  song: Song;
  unknownChords: string[];
  totalChords: number;
}

export function recommendSongs(songs: Song[], mastery: MasteryMap, limit = 12): SongGap[] {
  const gaps: SongGap[] = songs
    .filter((s) => s.body.trim())
    .map((song) => {
      const chords = [...new Set(extractChords(song.body).map(masteryKey))];
      const unknown = chords.filter((c) => classify(mastery[c]?.level) !== 'known');
      return { song, unknownChords: unknown, totalChords: chords.length };
    })
    .filter((g) => g.totalChords > 0);
  gaps.sort((a, b) => a.unknownChords.length - b.unknownChords.length || a.totalChords - b.totalChords);
  return gaps.slice(0, limit);
}
