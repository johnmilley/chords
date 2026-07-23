// Search Ultimate Guitar through the configured proxy and parse the results.

export interface UgResult {
  artist: string;
  song: string;
  type: string; // Chords | Tab | Ukulele Chords | Bass Tabs
  url: string;
  votes: number;
  rating: number;
  key: string;
}

export function parseUgSearch(html: string): UgResult[] {
  const m = html.match(/data-content="([^"]*)"/);
  if (!m) return [];
  let data: any;
  try {
    data = JSON.parse(decode(m[1]));
  } catch {
    return [];
  }
  const results = data?.store?.page?.data?.results ?? data?.page?.data?.results ?? [];
  const out: UgResult[] = [];
  for (const r of results) {
    if (!r || typeof r !== 'object') continue;
    if (r.marketing_type) continue; // skip Official / Pro (paywalled, not parseable)
    const url: string = r.tab_url || '';
    if (!/^https:\/\/tabs\.ultimate-guitar\.com\/tab\//.test(url)) continue;
    const type: string = r.type || '';
    if (!/chord|tab|ukulele|bass/i.test(type)) continue;
    out.push({
      artist: r.artist_name || '',
      song: r.song_name || '',
      type,
      url,
      votes: r.votes || 0,
      rating: r.rating || 0,
      key: r.tonality_name || '',
    });
  }
  return out;
}

export async function searchUltimateGuitar(query: string, proxyUrl: string): Promise<UgResult[]> {
  if (!proxyUrl) throw new Error('Set an import proxy in Settings to search Ultimate Guitar.');
  const target =
    `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}`;
  const endpoint = `${proxyUrl.replace(/\/$/, '')}/api/fetch?url=${encodeURIComponent(target)}`;
  const res = await fetch(endpoint, { headers: { Accept: 'text/plain' } });
  if (!res.ok) throw new Error(`Search failed (proxy returned ${res.status}).`);
  return parseUgSearch(await res.text());
}

function decode(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
