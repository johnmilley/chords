import type { ChordPoolEntry, MasteryMap } from './mastery';
import { pickWeighted } from './mastery';

export interface QuizQuestion {
  answer: string;
  options: string[]; // includes the answer, shuffled
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build a multiple-choice question, weighted toward less-known chords. Avoids repeating `exclude`. */
export function makeQuestion(pool: ChordPoolEntry[], mastery: MasteryMap, exclude?: string): QuizQuestion | null {
  if (pool.length < 2) return null;
  const answer = pickWeighted(pool, mastery, exclude);
  if (!answer) return null;
  const others = shuffle(pool.filter((p) => p.symbol !== answer.symbol)).slice(0, 3).map((o) => o.symbol);
  return { answer: answer.symbol, options: shuffle([answer.symbol, ...others]) };
}
