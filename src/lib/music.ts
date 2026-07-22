// Core music theory: chord parsing, transposition, capo, key spelling.

export const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Keys conventionally spelled with flats. Used to pick nicer enharmonics.
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

const NOTE_TO_INDEX: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'Fb': 4, 'E#': 5,
  'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11, 'B#': 0,
};

export interface ParsedChord {
  root: number; // 0-11
  suffix: string; // e.g. "m7", "maj7", "sus4", ""
  bass: number | null; // slash bass note index, or null
  original: string;
}

// A token is a chord if it matches: root (+accidental) + quality + optional slash-bass.
const CHORD_RE =
  /^([A-G])(#{1,2}|b{1,2})?((?:maj|min|aug|dim|sus|add|m|M|\+|-|°|ø|Δ|\d|\(|\)|#|b|\/|no|omit)*?)(?:\/([A-G])(#{1,2}|b{1,2})?)?$/;

export function parseChord(token: string): ParsedChord | null {
  const m = token.match(CHORD_RE);
  if (!m) return null;
  const [, letter, acc = '', suffixRaw = '', bassLetter, bassAcc = ''] = m;
  const rootName = letter + acc;
  const root = NOTE_TO_INDEX[rootName];
  if (root === undefined) return null;
  // Reject bare accidentals with no meaning, but allow empty suffix.
  const suffix = suffixRaw;
  let bass: number | null = null;
  if (bassLetter) {
    const bn = bassLetter + bassAcc;
    const bi = NOTE_TO_INDEX[bn];
    if (bi === undefined) return null;
    bass = bi;
  }
  return { root, suffix, bass, original: token };
}

/** Is this whole token a valid chord symbol? */
export function isChord(token: string): boolean {
  if (!token) return false;
  // Exclude tokens that are obviously words (contain lowercase runs not part of a suffix).
  return parseChord(token) !== null;
}

function noteName(index: number, useFlats: boolean): string {
  const table = useFlats ? FLAT_NOTES : SHARP_NOTES;
  return table[((index % 12) + 12) % 12];
}

/** Transpose a single chord symbol by `semitones`, spelling for the target key. */
export function transposeChord(token: string, semitones: number, targetKey?: string): string {
  const parsed = parseChord(token);
  if (!parsed) return token;
  const useFlats = pickFlats(targetKey, semitones, parsed);
  const newRoot = noteName(parsed.root + semitones, useFlats);
  let result = newRoot + parsed.suffix;
  if (parsed.bass !== null) {
    result += '/' + noteName(parsed.bass + semitones, useFlats);
  }
  return result;
}

function pickFlats(targetKey: string | undefined, semitones: number, parsed: ParsedChord): boolean {
  if (targetKey) {
    const t = transposeKeyName(targetKey, 0);
    return FLAT_KEYS.has(t) || FLAT_KEYS.has(t.replace(/m$/, ''));
  }
  // No key context: keep sharps for sharp-side moves, flats for flat-side.
  // Heuristic: if the original was flat-spelled, prefer flats.
  const wasFlat = /b/.test(parsed.original.charAt(1) || '');
  if (wasFlat && semitones === 0) return true;
  return false;
}

/** Transpose a key label like "Am" or "Bb" by semitones. */
export function transposeKeyName(key: string, semitones: number): string {
  const m = key.match(/^([A-G](?:#|b)?)(m(?:in)?)?$/);
  if (!m) return key;
  const idx = NOTE_TO_INDEX[m[1]];
  if (idx === undefined) return key;
  const minor = !!m[2];
  const useFlats = FLAT_KEYS.has(key) || FLAT_KEYS.has(key.replace(/m$/, ''));
  return noteName(idx + semitones, useFlats) + (minor ? 'm' : '');
}

export const NOTE_LABELS = SHARP_NOTES;

/** Chord quality → semitone intervals from root (for piano voicing / analysis). */
export function chordIntervals(suffix: string): number[] {
  const s = suffix.toLowerCase();
  const has = (x: string) => s.includes(x);
  // Base triad
  let third = 4; // major
  let fifth = 7;
  if (has('m') && !has('maj') && !s.startsWith('maj')) third = 3;
  if (has('min')) third = 3;
  if (has('dim') || has('°') || has('ø')) { third = 3; fifth = 6; }
  if (has('aug') || has('+')) fifth = 8;
  const notes = new Set<number>([0, third, fifth]);
  if (has('sus2')) { notes.delete(third); notes.add(2); }
  if (has('sus4') || (has('sus') && !has('sus2'))) { notes.delete(third); notes.add(5); }
  // Sevenths
  if (has('maj7') || has('maj9') || has('Δ')) notes.add(11);
  else if (has('7') || has('9') || has('11') || has('13')) notes.add(10);
  if (has('dim7')) notes.add(9);
  if (has('6')) notes.add(9);
  // Extensions
  if (has('9')) notes.add(14);
  if (has('add9')) notes.add(14);
  if (has('11')) notes.add(17);
  if (has('13')) notes.add(21);
  return [...notes].sort((a, b) => a - b);
}
