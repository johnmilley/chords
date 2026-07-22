// Parse an Ultimate Guitar "My tabs" favorites page (pasted HTML) into a list
// of song stubs with their real source URLs. This is metadata only — song
// titles, artists, links, dates, and type — no chord content is fetched here.

export interface FavoriteEntry {
  artist: string;
  title: string;
  url: string;
  type: string; // Chords | Tab | Official | Guitar Pro
  date: string;
}

const ROW_RE = /<div class="oRSaY">([\s\S]*?)<\/div><\/div><\/div>/g;

export function parseFavorites(html: string): FavoriteEntry[] {
  const out: FavoriteEntry[] = [];
  let lastArtist = '';
  let m: RegExpExecArray | null;
  ROW_RE.lastIndex = 0;

  while ((m = ROW_RE.exec(html)) !== null) {
    const row = m[1];

    // Title + URL (the tab link).
    const link = row.match(/<a href="([^"]+)"[^>]*class="JVQ-d IwP5M[^"]*"[^>]*>([^<]+)<\/a>/);
    if (!link) continue;
    const url = decode(link[1]);
    const title = decode(link[2]).trim();

    // Artist (may be blank when the row continues the previous artist).
    const artistMatch = row.match(/class="nGwD6"><a [^>]*>([^<]*)<\/a>/);
    const artist = artistMatch ? decode(artistMatch[1]).trim() : lastArtist;
    if (artistMatch) lastArtist = artist;

    const typeMatch = row.match(/class="_3K1S2 okCUx">([^<]*)</);
    const dateMatch = row.match(/class="_3K1S2 UIehk">([^<]*)</);

    out.push({
      artist,
      title,
      url,
      type: typeMatch ? typeMatch[1].trim() : '',
      date: dateMatch ? dateMatch[1].trim() : '',
    });
  }
  return out;
}

/** Detect whether pasted text looks like a UG favorites page. */
export function looksLikeFavorites(text: string): boolean {
  return /class="oRSaY"/.test(text) && /IwP5M/.test(text);
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}
