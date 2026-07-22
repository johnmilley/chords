export interface Song {
  id: string;
  title: string;
  artist: string;
  /** ChordPro-formatted body: lyrics with inline [Chord] markers and {directives}. */
  body: string;
  /** Original key as detected/declared, e.g. "G", "Am". Empty if unknown. */
  key: string;
  /** Capo suggested by the source, in frets. 0 = none. */
  capo: number;
  /** Where this came from, if imported from a URL. */
  sourceUrl?: string;
  /** Free-form tags for organizing the library. */
  tags: string[];
  createdAt: number;
  updatedAt: number;
  /** Per-song saved reader preferences. */
  prefs?: SongPrefs;
}

export interface SongPrefs {
  /** Semitones to transpose the displayed chords. */
  transpose?: number;
  /** Capo fret the reader is using (independent of source capo). */
  capo?: number;
}

export interface Setlist {
  id: string;
  name: string;
  songIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  fontSize: number;
  /** Preferred instrument for chord diagrams. */
  instrument: 'guitar' | 'piano';
  leftHanded: boolean;
  /** Auto-scroll speed, arbitrary units (pixels/sec baseline). */
  scrollSpeed: number;
  /** Show chord diagrams inline vs. only on tap. */
  showInlineDiagrams: boolean;
  /** URL of the import proxy, if the user has deployed one. Empty = paste only. */
  proxyUrl: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontSize: 16,
  instrument: 'guitar',
  leftHanded: false,
  scrollSpeed: 40,
  showInlineDiagrams: false,
  proxyUrl: '',
};

/** A parsed line of a song for rendering. */
export type SongLine =
  | { type: 'section'; label: string }
  | { type: 'comment'; text: string }
  | { type: 'lyric'; segments: LyricSegment[] }
  | { type: 'blank' };

export interface LyricSegment {
  chord: string | null;
  text: string;
}
