// Convert content from chord sites (Ultimate Guitar and generic
// "chords-over-lyrics" text) into our internal ChordPro format.

import { isChord } from './music';

export interface ImportResult {
  title: string;
  artist: string;
  key: string;
  capo: number;
  body: string; // ChordPro
}

// ---- Entry point ---------------------------------------------------------

export function parseImport(input: string): ImportResult {
  const trimmed = input.trim();

  // 1. Full UG page HTML with an embedded JSON store.
  const fromJson = tryParseUgJson(trimmed);
  if (fromJson) return fromJson;

  // 2. Raw UG content using [ch]..[/ch] and [tab]..[/tab] tags.
  if (/\[\/?(ch|tab)\]/i.test(trimmed)) {
    return parseUgTagged(trimmed);
  }

  // 3. Generic chords-over-lyrics plain text (typical copy/paste).
  return parsePlainText(trimmed);
}

// ---- Ultimate Guitar JSON (best case) ------------------------------------

function tryParseUgJson(html: string): ImportResult | null {
  if (!/window\.UGAPP|js-store|data-content|store\.page/.test(html)) return null;
  try {
    // UG embeds a big JSON blob in a div: <div class="js-store" data-content="{...}">
    const m = html.match(/data-content="([^"]*)"/);
    let json: any = null;
    if (m) {
      const decoded = decodeHtmlEntities(m[1]);
      json = JSON.parse(decoded);
    }
    if (!json) return null;
    const page = json?.store?.page?.data ?? json?.page?.data ?? json?.data;
    const tab = page?.tab ?? {};
    const content: string =
      page?.tab_view?.wiki_tab?.content ?? page?.wiki_tab?.content ?? '';
    if (!content) return null;
    const parsed = parseUgTagged(content);
    return {
      title: tab.song_name || parsed.title,
      artist: tab.artist_name || parsed.artist,
      key: page?.tab_view?.meta?.tonality?.[0] || parsed.key,
      capo: Number(page?.tab_view?.meta?.capo ?? parsed.capo) || parsed.capo,
      body: parsed.body,
    };
  } catch {
    return null;
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// ---- UG tagged content ---------------------------------------------------

function parseUgTagged(content: string): ImportResult {
  // Strip [tab] wrappers; convert [ch]X[/ch] into a sentinel we can measure.
  const text = content
    .replace(/\r\n?/g, '\n')
    .replace(/\[\/?tab\]/gi, '');

  const lines = text.split('\n');
  const rows: Row[] = lines.map((line) => {
    if (/\[ch\]/i.test(line)) {
      return chordRowFromTags(line);
    }
    return classifyPlainLine(line);
  });
  return assemble(rows);
}

// Build a chord row from a line containing [ch]..[/ch] tags, recording the
// visual column of each chord (position in the de-tagged text).
function chordRowFromTags(line: string): Row {
  const chords: ChordPos[] = [];
  let visual = '';
  let i = 0;
  while (i < line.length) {
    if (line.slice(i, i + 4).toLowerCase() === '[ch]') {
      const end = line.toLowerCase().indexOf('[/ch]', i);
      const chord = line.slice(i + 4, end === -1 ? undefined : end);
      chords.push({ col: visual.length, chord: chord.trim() });
      visual += chord;
      i = end === -1 ? line.length : end + 5;
    } else {
      visual += line[i];
      i++;
    }
  }
  // If the de-tagged line still has real words, it's a lyric line with inline
  // chords already merged — rare, but handle by treating as combined.
  return { kind: 'chords', chords, raw: visual.replace(/\s+$/, '') };
}

// ---- Generic plain text --------------------------------------------------

function parsePlainText(text: string): ImportResult {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const rows = lines.map(classifyPlainLine);
  return assemble(rows);
}

type Row =
  | { kind: 'chords'; chords: ChordPos[]; raw: string }
  | { kind: 'lyric'; raw: string }
  | { kind: 'section'; label: string }
  | { kind: 'meta'; field: string; value: string }
  | { kind: 'blank' };

interface ChordPos {
  col: number;
  chord: string;
}

const SECTION_RE =
  /^\[?\s*((?:intro|verse|chorus|pre-?chorus|bridge|outro|solo|interlude|instrumental|refrain|coda|hook|breakdown|tag|ending|riff|link|vamp)[^\]\n]*?)\s*\]?\s*:?\s*$/i;
const CAPO_RE = /^\[?\s*capo\s*:?\s*(?:fret\s*)?([0-9ivx]+)/i;
const KEY_RE = /^\[?\s*key\s*:?\s*([A-G](?:#|b)?m?)\b/i;
const CHORD_EXTRAS = /^(\||\|\||x\d+|\(x?\d+\)|n\.?c\.?|%|:|\/|-|~|\*|\d+x|\/[A-G](#|b)?|\.)$/i;

function classifyPlainLine(line: string): Row {
  const trimmed = line.trim();
  if (trimmed === '') return { kind: 'blank' };

  const capo = trimmed.match(CAPO_RE);
  if (capo) return { kind: 'meta', field: 'capo', value: String(romanOrInt(capo[1])) };
  const key = trimmed.match(KEY_RE);
  if (key) return { kind: 'meta', field: 'key', value: key[1] };
  const section = trimmed.match(SECTION_RE);
  if (section) return { kind: 'section', label: titleCase(section[1]) };

  if (isChordLine(trimmed)) {
    const chords: ChordPos[] = [];
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (isChord(m[0])) chords.push({ col: m.index, chord: m[0] });
    }
    return { kind: 'chords', chords, raw: line.replace(/\s+$/, '') };
  }
  return { kind: 'lyric', raw: line };
}

// A line is a chord line if all its non-trivial tokens are chords (allowing a
// few structural extras like bar lines and repeat markers).
function isChordLine(trimmed: string): boolean {
  const tokens = trimmed.split(/\s+/);
  let chordCount = 0;
  for (const t of tokens) {
    if (CHORD_EXTRAS.test(t)) continue;
    if (isChord(t)) {
      chordCount++;
      continue;
    }
    return false; // a real word disqualifies the line
  }
  return chordCount > 0;
}

// ---- Assembly ------------------------------------------------------------

function assemble(rows: Row[]): ImportResult {
  const out: string[] = [];
  const meta: Record<string, string> = {};
  let lastBlank = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.kind === 'meta') {
      meta[row.field] = row.value;
      continue;
    }
    if (row.kind === 'blank') {
      if (!lastBlank && out.length) out.push('');
      lastBlank = true;
      continue;
    }
    lastBlank = false;
    if (row.kind === 'section') {
      out.push(`{comment: ${row.label}}`);
      continue;
    }
    if (row.kind === 'lyric') {
      out.push(escapeBrackets(row.raw));
      continue;
    }
    // row.kind === 'chords': merge with the following lyric line if present.
    const next = rows[i + 1];
    if (next && next.kind === 'lyric') {
      out.push(mergeChordsIntoLyric(row.chords, next.raw));
      i++; // consume the lyric line
    } else {
      // Standalone chord line (instrumental) — keep spacing via the raw text.
      out.push(mergeChordsIntoLyric(row.chords, ' '.repeat(row.raw.length)));
    }
  }

  return {
    title: '',
    artist: '',
    key: meta.key || '',
    capo: Number(meta.capo) || 0,
    body: out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n',
  };
}

// Insert [chord] markers into a lyric string at their recorded columns.
function mergeChordsIntoLyric(chords: ChordPos[], lyric: string): string {
  if (chords.length === 0) return escapeBrackets(lyric);
  const byCol = new Map<number, string>();
  for (const c of chords) {
    // If two chords land on the same column, space them by one.
    let col = c.col;
    while (byCol.has(col)) col++;
    byCol.set(col, c.chord);
  }
  const maxCol = Math.max(lyric.length, ...[...byCol.keys()].map((c) => c + 1));
  let out = '';
  for (let i = 0; i < maxCol; i++) {
    if (byCol.has(i)) out += `[${byCol.get(i)}]`;
    if (i < lyric.length) out += escapeChar(lyric[i]);
  }
  return out;
}

function escapeBrackets(s: string): string {
  return s.replace(/\[/g, '(').replace(/\]/g, ')');
}
function escapeChar(c: string): string {
  return c === '[' ? '(' : c === ']' ? ')' : c;
}

// ---- Small helpers -------------------------------------------------------

function romanOrInt(s: string): number {
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const map: Record<string, number> = { i: 1, v: 5, x: 10 };
  let total = 0;
  const lower = s.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    const cur = map[lower[i]] || 0;
    const nxt = map[lower[i + 1]] || 0;
    total += cur < nxt ? -cur : cur;
  }
  return total || 0;
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
