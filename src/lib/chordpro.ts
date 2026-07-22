import type { SongLine, LyricSegment } from '../types';

// Parse a ChordPro body into renderable lines.
// Supports: [Chord] inline markers, {directive: value}, and section labels.

const DIRECTIVE_RE = /^\{\s*([a-zA-Z_]+)\s*:?\s*(.*?)\s*\}$/;

export interface ParsedBody {
  lines: SongLine[];
  meta: Record<string, string>;
}

export function parseChordPro(body: string): ParsedBody {
  const meta: Record<string, string> = {};
  const lines: SongLine[] = [];
  const raw = body.replace(/\r\n?/g, '\n').split('\n');

  for (const line of raw) {
    const trimmed = line.trim();
    if (trimmed === '') {
      lines.push({ type: 'blank' });
      continue;
    }
    const dir = trimmed.match(DIRECTIVE_RE);
    if (dir) {
      const name = dir[1].toLowerCase();
      const value = dir[2];
      if (name === 'title' || name === 't') meta.title = value;
      else if (name === 'artist' || name === 'subtitle' || name === 'st') meta.artist = value;
      else if (name === 'key') meta.key = value;
      else if (name === 'capo') meta.capo = value;
      else if (name === 'comment' || name === 'c' || name === 'ci') {
        lines.push({ type: 'comment', text: value });
      } else if (name.startsWith('start_of_') || name === 'sog' || name === 'sov' || name === 'soc') {
        const label = value || sectionFromDirective(name);
        if (label) lines.push({ type: 'section', label });
      }
      // end_of_* and unknown directives are ignored for rendering.
      continue;
    }
    // Section label like "[Verse]" or "[Chorus 1]" on its own line (not a chord).
    const section = asSectionLabel(trimmed);
    if (section) {
      lines.push({ type: 'section', label: section });
      continue;
    }
    lines.push({ type: 'lyric', segments: parseInline(line) });
  }

  return { lines, meta };
}

function sectionFromDirective(name: string): string {
  if (name.includes('chorus') || name === 'soc') return 'Chorus';
  if (name.includes('verse') || name === 'sov') return 'Verse';
  if (name.includes('bridge')) return 'Bridge';
  return '';
}

// A standalone label like [Verse], [Chorus], [Intro], [Solo] — but not a chord.
function asSectionLabel(line: string): string | null {
  const m = line.match(/^\[([^\]]+)\]$/);
  if (!m) return null;
  const inner = m[1].trim();
  // If it's a single chord in brackets, treat as a chord line, not a section.
  const words = inner.split(/\s+/);
  const sectionWords = /^(intro|verse|chorus|bridge|outro|solo|interlude|instrumental|pre-?chorus|refrain|coda|hook|breakdown|tag|ending|riff|link|vamp)/i;
  if (sectionWords.test(inner) || words.length > 2) return inner;
  return null;
}

// Parse a line with inline [Chord] markers into segments.
export function parseInline(line: string): LyricSegment[] {
  const segments: LyricSegment[] = [];
  const re = /\[([^\]]*)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let pendingChord: string | null = null;

  while ((m = re.exec(line)) !== null) {
    const before = line.slice(last, m.index);
    if (before.length > 0 || pendingChord !== null) {
      segments.push({ chord: pendingChord, text: before });
    }
    pendingChord = m[1];
    last = re.lastIndex;
  }
  const tail = line.slice(last);
  if (pendingChord !== null || tail.length > 0) {
    segments.push({ chord: pendingChord, text: tail });
  }
  if (segments.length === 0) segments.push({ chord: null, text: line });
  return segments;
}

/** Collect every distinct chord symbol used in a body, in order of first appearance. */
export function extractChords(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const c = m[1].trim();
    if (c && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}
