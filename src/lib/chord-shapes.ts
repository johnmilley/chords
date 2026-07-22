// Guitar fingering shapes (curated open chords + movable barre generator)
// and generated piano voicings.

import { parseChord, chordIntervals } from './music';

export interface GuitarShape {
  /** 6 entries low-E → high-E. -1 = muted, 0 = open, n = fret. */
  frets: number[];
  /** Optional finger numbers per string (1-4), 0 = open/none. */
  fingers?: number[];
  /** Fret where a full/partial barre sits, if any. */
  barreFret?: number;
}

// Canonical suffix families we have shapes for.
type Family =
  | 'maj' | 'm' | '7' | 'm7' | 'maj7' | 'sus4' | 'sus2'
  | '6' | 'm6' | 'dim' | 'aug' | 'm7b5' | 'add9' | '9';

function familyOf(suffix: string): Family {
  const s = suffix.toLowerCase();
  if (s === '' ) return 'maj';
  if (/^(maj7|Δ|M7)/.test(suffix)) return 'maj7';
  if (/(m7b5|ø|min7b5|m7-5)/.test(s)) return 'm7b5';
  if (/(dim|°)/.test(s)) return 'dim';
  if (/(aug|\+)/.test(s)) return 'aug';
  if (/sus2/.test(s)) return 'sus2';
  if (/sus/.test(s)) return 'sus4';
  if (/add9/.test(s)) return 'add9';
  if (/m(aj)?6/.test(s) && s.startsWith('m')) return 'm6';
  if (/(^|[^a-z])6/.test(s) && !s.includes('m6')) return s.startsWith('m') ? 'm6' : '6';
  if (/^m(in)?7|^-7/.test(s)) return 'm7';
  if (/^m(in)?9/.test(s)) return 'm7';
  if (/9/.test(s)) return '9';
  if (/7/.test(s)) return '7';
  if (/^m(in)?\b|^m[^a]|^-/.test(s) || s === 'm') return 'm';
  if (s.startsWith('m')) return 'm';
  return 'maj';
}

// Fallback chain when a family has no barre template.
const FALLBACK: Partial<Record<Family, Family>> = {
  '9': '7', 'add9': 'maj', 'm6': 'm', '6': 'maj', 'aug': 'maj', 'dim': 'm', 'm7b5': 'm7',
};

// Curated open-position voicings, keyed `${pitchClass}:${family}`.
// Pitch classes: C=0, C#=1, ... B=11.
const OPEN: Record<string, GuitarShape> = {
  // C family
  '0:maj': { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  '0:7': { frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
  '0:maj7': { frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
  '0:add9': { frets: [-1, 3, 2, 0, 3, 0], fingers: [0, 2, 1, 0, 3, 0] },
  '0:m': { frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], barreFret: 3 },
  // D family
  '2:maj': { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  '2:m': { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  '2:7': { frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  '2:m7': { frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1] },
  '2:maj7': { frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 1, 1] },
  '2:sus4': { frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 3] },
  '2:sus2': { frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 2, 0] },
  // E family
  '4:maj': { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  '4:m': { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  '4:7': { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  '4:m7': { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
  '4:maj7': { frets: [0, 2, 1, 1, 0, 0], fingers: [0, 3, 1, 2, 0, 0] },
  '4:sus4': { frets: [0, 2, 2, 2, 0, 0], fingers: [0, 1, 2, 3, 0, 0] },
  // F
  '5:maj': { frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barreFret: 1 },
  '5:maj7': { frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
  // G family
  '7:maj': { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  '7:7': { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  '7:maj7': { frets: [3, 2, 0, 0, 0, 2], fingers: [3, 1, 0, 0, 0, 2] },
  '7:sus4': { frets: [3, 3, 0, 0, 1, 3], fingers: [2, 3, 0, 0, 1, 4] },
  // A family
  '9:maj': { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  '9:m': { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  '9:7': { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
  '9:m7': { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  '9:maj7': { frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0] },
  '9:sus4': { frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0] },
  '9:sus2': { frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0] },
  // B
  '11:7': { frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
};

// Movable barre templates as offsets from the barre fret `f`.
// E-shape: root on 6th string. A-shape: root on 5th string (6th muted).
const E_SHAPE: Partial<Record<Family, (f: number) => GuitarShape>> = {
  maj: (f) => ({ frets: [f, f + 2, f + 2, f + 1, f, f], barreFret: f, fingers: [1, 3, 4, 2, 1, 1] }),
  m: (f) => ({ frets: [f, f + 2, f + 2, f, f, f], barreFret: f, fingers: [1, 3, 4, 1, 1, 1] }),
  '7': (f) => ({ frets: [f, f + 2, f, f + 1, f, f], barreFret: f, fingers: [1, 3, 1, 2, 1, 1] }),
  m7: (f) => ({ frets: [f, f + 2, f, f, f, f], barreFret: f, fingers: [1, 3, 1, 1, 1, 1] }),
  maj7: (f) => ({ frets: [f, f + 2, f + 1, f + 1, f, f], barreFret: f, fingers: [1, 3, 2, 2, 1, 1] }),
  sus4: (f) => ({ frets: [f, f + 2, f + 2, f + 2, f, f], barreFret: f, fingers: [1, 2, 3, 4, 1, 1] }),
};

const A_SHAPE: Partial<Record<Family, (f: number) => GuitarShape>> = {
  maj: (f) => ({ frets: [-1, f, f + 2, f + 2, f + 2, f], barreFret: f, fingers: [0, 1, 3, 3, 3, 1] }),
  m: (f) => ({ frets: [-1, f, f + 2, f + 2, f + 1, f], barreFret: f, fingers: [0, 1, 3, 4, 2, 1] }),
  '7': (f) => ({ frets: [-1, f, f + 2, f, f + 2, f], barreFret: f, fingers: [0, 1, 3, 1, 4, 1] }),
  m7: (f) => ({ frets: [-1, f, f + 2, f, f + 1, f], barreFret: f, fingers: [0, 1, 3, 1, 2, 1] }),
  maj7: (f) => ({ frets: [-1, f, f + 2, f + 1, f + 2, f], barreFret: f, fingers: [0, 1, 3, 2, 4, 1] }),
  sus4: (f) => ({ frets: [-1, f, f + 2, f + 2, f + 3, f], barreFret: f, fingers: [0, 1, 2, 3, 4, 1] }),
  sus2: (f) => ({ frets: [-1, f, f + 2, f + 2, f, f], barreFret: f, fingers: [0, 1, 3, 4, 1, 1] }),
  '6': (f) => ({ frets: [-1, f, f + 2, f + 1, f + 2, f], barreFret: f, fingers: [0, 1, 3, 2, 4, 1] }),
};

/** Resolve a guitar shape for a chord symbol, or null if we can't. */
export function guitarShape(symbol: string): GuitarShape | null {
  const parsed = parseChord(symbol);
  if (!parsed) return null;
  const root = ((parsed.root % 12) + 12) % 12;
  let family = familyOf(parsed.suffix);

  // Try curated open voicing first.
  const open = OPEN[`${root}:${family}`];
  if (open) return open;

  // Movable barre, walking the fallback chain until a template exists.
  let fam: Family | undefined = family;
  const tried = new Set<Family>();
  while (fam && !tried.has(fam)) {
    tried.add(fam);
    const eFret = mod12(root - 4); // 6th string open = E
    const aFret = mod12(root - 9); // 5th string open = A
    const eTpl = E_SHAPE[fam];
    const aTpl = A_SHAPE[fam];
    const candidates: GuitarShape[] = [];
    if (eTpl) candidates.push(eTpl(eFret === 0 ? 12 : eFret));
    if (aTpl) candidates.push(aTpl(aFret === 0 ? 12 : aFret));
    if (candidates.length) {
      // Prefer the lower fret position.
      candidates.sort((a, b) => maxFret(a) - maxFret(b));
      return candidates[0];
    }
    fam = FALLBACK[fam];
  }
  return null;
}

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}
function maxFret(s: GuitarShape): number {
  return Math.max(...s.frets.filter((f) => f > 0), 0);
}

// ---- Piano ---------------------------------------------------------------

export interface PianoVoicing {
  /** Absolute semitones from C (root's octave = 0). Each note once, low→high. */
  pitches: number[];
  /** The root pitch class (0-11), highlighted distinctly. */
  root: number;
  /** Slash-bass pitch class (0-11), or null. */
  bass: number | null;
}

export function pianoVoicing(symbol: string): PianoVoicing | null {
  const parsed = parseChord(symbol);
  if (!parsed) return null;
  const root = ((parsed.root % 12) + 12) % 12;
  // Absolute intervals (not folded to a pitch class) so extensions stack up the
  // keyboard as a real voicing — each note appears exactly once.
  const pitches = chordIntervals(parsed.suffix).map((i) => root + i);
  const bass = parsed.bass !== null ? ((parsed.bass % 12) + 12) % 12 : null;
  return { pitches, root, bass };
}
