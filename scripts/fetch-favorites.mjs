import { writeFileSync } from 'node:fs';
import { favoriteSeedSongs } from '../src/seed-favorites.ts';
import { parseImport } from '../src/lib/import-parse.ts';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0 Safari/537.36';

const songs = favoriteSeedSongs(Date.now());
const out = [];
let okCount = 0;

async function fetchOne(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', Accept: 'text/html' },
      });
      if (res.status === 429) { await sleep(2000); continue; }
      if (!res.ok) return null;
      return await res.text();
    } catch {
      await sleep(800);
    }
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (let i = 0; i < songs.length; i++) {
  const s = songs[i];
  const html = await fetchOne(s.sourceUrl);
  if (html) {
    const r = parseImport(html);
    const body = (r.body || '').trim();
    if (body) {
      okCount++;
      out.push({ ...s, body: r.body, key: s.key || r.key || '', capo: s.capo || r.capo || 0, updatedAt: Date.now() });
      process.stderr.write('.');
    } else {
      out.push(s); // parsed but empty (JS shell) — keep stub
      process.stderr.write('o');
    }
  } else {
    out.push(s); // fetch failed — keep stub
    process.stderr.write('x');
  }
  if ((i + 1) % 50 === 0) process.stderr.write(` ${i + 1}\n`);
  await sleep(350);
}

const backup = { version: 1, exportedAt: Date.now(), songs: out, setlists: [] };
const path = new URL('../chords-backup.json', import.meta.url).pathname;
writeFileSync(path, JSON.stringify(backup, null, 2));
console.error(`\n\nDone: ${okCount}/${songs.length} songs got chords. Wrote ${path}`);
