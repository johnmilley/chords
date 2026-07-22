import { parseImport, type ImportResult } from './import-parse';

export interface FetchOutcome {
  ok: boolean;
  result?: ImportResult;
  /** Raw text fetched, so the UI can show/edit it even on a partial parse. */
  raw?: string;
  error?: string;
}

/**
 * Fetch a chord page through the configured proxy and parse it.
 * Without a proxy, browsers can't fetch chord sites directly (CORS +
 * anti-scraping), so the UI falls back to pasting text.
 */
export async function fetchAndParse(url: string, proxyUrl: string): Promise<FetchOutcome> {
  if (!proxyUrl) {
    return {
      ok: false,
      error: 'No import proxy configured. Paste the chords text instead, or set a proxy in Settings.',
    };
  }
  try {
    const endpoint = `${proxyUrl.replace(/\/$/, '')}/api/fetch?url=${encodeURIComponent(url)}`;
    const res = await fetch(endpoint, { headers: { Accept: 'text/plain' } });
    if (!res.ok) {
      return { ok: false, error: `Proxy returned ${res.status}. Try pasting the text instead.` };
    }
    const raw = await res.text();
    const result = parseImport(raw);
    result.body ||= '';
    return { ok: true, result, raw };
  } catch (e) {
    return {
      ok: false,
      error: `Couldn't reach the proxy (${(e as Error).message}). Paste the text instead.`,
    };
  }
}

/** Parse pasted text directly (no network). */
export function parsePasted(text: string): ImportResult {
  return parseImport(text);
}
