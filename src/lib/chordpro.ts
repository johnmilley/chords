import type { SongLine, LyricSegment } from '../types';

// Parse a ChordPro body into renderable lines.
// Supports: [Chord] inline markers, {directive: value}, and section labels.

const DIRECTIVE_RE = /^\{\s*([a-zA-Z_]+)\s*:?\s*(.*?)\s*\}$/;

// Shared with the importer's section detection, so a "{comment: Verse 2}"
// produced at import time renders as a real section header, not italic text.
const SECTION_WORD_RE =
  /^(intro|verse|chorus|pre-?chorus|bridge|outro|solo|interlude|instrumental|refrain|coda|hook|breakdown|tag|ending|riff|link|vamp)/i;

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
        // A comment whose text is a section name (as produced by the
        // importer) is really a section header, not an aside.
        if (SECTION_WORD_RE.test(value.trim())) lines.push({ type: 'section', label: value.trim() });
        else lines.push({ type: 'comment', text: value });
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
  if (SECTION_WORD_RE.test(inner) || words.length > 2) return inner;
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

/**
 * The chord progression in playing order, collapsing consecutive repeats
 * (holding a chord for several bars isn't a "switch"). Used by the
 * chord-switch drill.
 */
export function extractChordSequence(body: string): string[] {
  const out: string[] = [];
  const re = /\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const c = m[1].trim();
    if (c && out[out.length - 1] !== c) out.push(c);
  }
  return out;
}

export interface SongSection {
  label: string;
  body: string; // ChordPro slice for just this section, re-parseable
}

// When a label like "Verse" repeats untouched (no number of its own), number
// the repeats so they're distinguishable in a section picker: "Verse (1)", "Verse (2)".
function disambiguateLabels(sections: SongSection[]): SongSection[] {
  const totalByLabel = new Map<string, number>();
  for (const s of sections) totalByLabel.set(s.label, (totalByLabel.get(s.label) ?? 0) + 1);
  const seenByLabel = new Map<string, number>();
  return sections.map((s) => {
    const total = totalByLabel.get(s.label)!;
    if (total <= 1) return s;
    const n = (seenByLabel.get(s.label) ?? 0) + 1;
    seenByLabel.set(s.label, n);
    return { ...s, label: `${s.label} (${n})` };
  });
}

/** Split a song body into its sections (by section headers), for looping one part. */
export function splitSections(body: string): SongSection[] {
  const raw = body.replace(/\r\n?/g, '\n').split('\n');
  const sections: SongSection[] = [];
  let current: string[] = [];
  let label = 'Intro';
  let started = false;

  const flush = () => {
    const text = current.join('\n').trim();
    if (text) sections.push({ label, body: text });
    current = [];
  };

  for (const line of raw) {
    const trimmed = line.trim();
    const dirMatch = trimmed.match(DIRECTIVE_RE);
    const isCommentSection = dirMatch && /^(comment|c|ci)$/i.test(dirMatch[1]) && SECTION_WORD_RE.test(dirMatch[2].trim());
    const isStartDirective = dirMatch && (dirMatch[1].startsWith('start_of_') || /^(sog|sov|soc)$/i.test(dirMatch[1]));
    const bracketLabel = asSectionLabel(trimmed);

    if (isCommentSection || isStartDirective || bracketLabel) {
      if (started || current.some((l) => l.trim())) flush();
      label = isCommentSection ? dirMatch![2].trim()
        : isStartDirective ? (dirMatch![2].trim() || sectionFromDirective(dirMatch![1].toLowerCase()) || 'Section')
        : bracketLabel!;
      started = true;
      continue;
    }
    current.push(line);
  }
  flush();

  // No sections detected at all — the whole song is one "section".
  if (sections.length === 0) {
    const whole = body.trim();
    return whole ? [{ label: 'Whole Song', body: whole }] : [];
  }
  return disambiguateLabels(sections);
}
