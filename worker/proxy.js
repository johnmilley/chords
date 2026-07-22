// Cloudflare Worker: fetches a chord page server-side and returns its raw
// HTML/text so the app can parse it. This exists because browsers can't fetch
// chord sites directly (CORS), and it also sends a real User-Agent so pages
// that gate on it still render.
//
// Deploy:  npm i -g wrangler  &&  wrangler deploy
// Then paste the resulting https://<name>.<you>.workers.dev URL into the app's
// Settings → Import proxy URL.
//
// This is a personal-use fetcher. Respect each site's terms of service and
// only import songs for your own use.

const ALLOW_HOSTS = [
  'ultimate-guitar.com',
  'tabs.ultimate-guitar.com',
  'chordie.com',
  'e-chords.com',
  'azchords.com',
  'guitartabs.cc',
  'cifraclub.com',
  'songsterr.com',
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }
    const { pathname, searchParams } = new URL(request.url);
    if (pathname !== '/api/fetch') {
      return json({ error: 'Not found' }, 404);
    }
    const target = searchParams.get('url');
    if (!target) return json({ error: 'Missing url param' }, 400);

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return json({ error: 'Invalid url' }, 400);
    }
    if (parsed.protocol !== 'https:') {
      return json({ error: 'Only https URLs are allowed' }, 400);
    }
    const host = parsed.hostname.replace(/^www\./, '');
    const allowed = ALLOW_HOSTS.some((h) => host === h || host.endsWith('.' + h));
    if (!allowed) {
      return json({ error: `Host not allowed: ${host}` }, 403);
    }

    try {
      const upstream = await fetch(parsed.toString(), {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/122.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' },
      });
    } catch (e) {
      return json({ error: 'Fetch failed: ' + e.message }, 502);
    }
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
