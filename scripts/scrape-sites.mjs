import { writeFileSync } from 'node:fs';
import { parseImport } from '../src/lib/import-parse.ts';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let a = 0; a < 3; a++) {
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
      if (res.status === 429) { await sleep(2500); continue; }
      if (!res.ok) return null;
      return await res.text();
    } catch { await sleep(700); }
  }
  return null;
}

const unescapeHtml = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

const stripTags = (s) => unescapeHtml(s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''));
const preBlocks = (html) => {
  const out = [];
  const re = /<pre[^>]*>([\s\S]*?)<\/pre>/gi;
  let m;
  while ((m = re.exec(html)) !== null) out.push(stripTags(m[1]));
  return out;
};
const firstClass = (html, cls) => {
  const m = html.match(new RegExp(`class="${cls}"[^>]*>([\\s\\S]*?)<`, 'i'));
  return m ? stripTags(m[1]).trim() : '';
};

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

// ---- damnskippy: plain-text tabs ----------------------------------------
async function scrapeDamnskippy() {
  const base = 'http://www.damnskippy.com/';
  const index = await get(base + 'tabs.html');
  const links = [...index.matchAll(/href="(tabs\/[^"]+\.txt)"/gi)].map((m) => m[1]);
  const uniq = [...new Set(links)];
  const songs = [];
  for (let i = 0; i < uniq.length; i++) {
    const rel = uniq[i];
    const txt = await get(base + rel.split('/').map(encodeURIComponent).join('/'));
    process.stderr.write(txt ? '.' : 'x');
    if (!txt) continue;
    const lines = txt.replace(/\r\n?/g, '\n').split('\n');
    // Path: tabs/Coll/Artist/Song.txt
    const parts = rel.split('/');
    const artistFolder = parts.length >= 4 ? parts[2] : '';
    const title = (lines.find((l) => l.trim()) || parts.at(-1).replace(/\.txt$/, '')).trim();
    const byLine = lines.find((l) => /^by\s+/i.test(l.trim()));
    const artist = byLine ? byLine.trim().replace(/^by\s+/i, '') : deCamel(artistFolder);
    // Drop leading title / by / "chords extracted/transcribed by" lines.
    const bodyLines = [];
    let started = false;
    for (const l of lines) {
      if (!started) {
        const t = l.trim();
        if (t === title || /^by\s+/i.test(t) || /extracted|transcribed|tabbed|chords by/i.test(t) || t === '') continue;
        started = true;
      }
      bodyLines.push(l);
    }
    const r = parseImport(bodyLines.join('\n'));
    if (!r.body.trim()) continue;
    songs.push(mk('ds', i, title, artist, r, base + rel, 'Damn Skippy', deCamel(artistFolder)));
    await sleep(200);
  }
  return songs;
}
function deCamel(s) { return s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim(); }

// ---- dylanchords --------------------------------------------------------
async function scrapeDylan() {
  const index = await get('https://dylanchords.com/');
  const albums = [...new Set([...index.matchAll(/href="(\/\d\d_[a-z0-9]+)"/gi)].map((m) => m[1]))];
  const songs = [];
  let i = 0;
  for (const album of albums) {
    const page = await get('https://dylanchords.com' + album);
    if (!page) continue;
    const albumName = (page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [, ''])[1];
    const albumTitle = stripTags(albumName).trim() || album.replace(/^\/\d\d_/, '');
    const links = [...new Set([...page.matchAll(new RegExp(`href="(${album}/[^"]+)"`, 'gi'))].map((m) => m[1]))]
      .filter((h) => !/\.(png|jpg|css|js)$/i.test(h));
    for (const rel of links) {
      const sp = await get('https://dylanchords.com' + rel);
      process.stderr.write(sp ? '.' : 'x');
      if (!sp) { await sleep(150); continue; }
      const title = stripTags((sp.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [, ''])[1]).trim() ||
        deCamel(rel.split('/').at(-1).replace(/\.htm$/, ''));
      const pres = preBlocks(sp);
      if (!pres.length) { await sleep(150); continue; }
      const r = parseImport(pres.join('\n\n'));
      if (!r.body.trim()) { await sleep(150); continue; }
      songs.push(mk('dyl', i++, title, 'Bob Dylan', r, 'https://dylanchords.com' + rel, 'Dylan Chords', albumTitle));
      await sleep(180);
    }
    process.stderr.write(` [${albumTitle}]\n`);
  }
  return songs;
}

// ---- CohenChords --------------------------------------------------------
async function scrapeCohen() {
  const baseU = 'https://www.maartenmassa.be/CohenChords/';
  const nav = await get(baseU + 'navigation.htm');
  const albums = [...new Set([...nav.matchAll(/href="(\d\d[a-z]+\/[a-z]+\.htm)"/gi)].map((m) => m[1]))];
  const songs = [];
  let i = 0;
  for (const album of albums) {
    const dir = album.split('/')[0] + '/';
    const page = await get(baseU + album);
    if (!page) continue;
    const albumTitle = firstClass(page, 'albumtitle') || dir.replace(/\/$/, '');
    const links = [...new Set([...page.matchAll(/href="([a-z0-9_]+\.htm)"/gi)].map((m) => m[1]))]
      .filter((h) => !/nav|main|index/i.test(h) && h !== album.split('/')[1]);
    for (const rel of links) {
      const sp = await get(baseU + dir + rel);
      process.stderr.write(sp ? '.' : 'x');
      if (!sp) { await sleep(150); continue; }
      const title = firstClass(sp, 'songtitle') || deCamel(rel.replace(/\.htm$/, ''));
      const album2 = firstClass(sp, 'albumtitle') || albumTitle;
      const pres = preBlocks(sp);
      if (!pres.length) { await sleep(150); continue; }
      const r = parseImport(pres.join('\n\n'));
      if (!r.body.trim()) { await sleep(150); continue; }
      songs.push(mk('coh', i++, title, 'Leonard Cohen', r, baseU + dir + rel, 'Cohen Chords', album2));
      await sleep(180);
    }
    process.stderr.write(` [${albumTitle}]\n`);
  }
  return songs;
}

function mk(prefix, i, title, artist, r, url, collection, album) {
  return {
    id: `${prefix}-${i}`,
    title: title.replace(/\s+/g, ' ').trim(),
    artist,
    key: r.key || '',
    capo: r.capo || 0,
    body: r.body,
    sourceUrl: url,
    tags: album ? [slug(collection), album] : [slug(collection)],
    collection,
  };
}

const which = process.argv[2];
const map = { damnskippy: scrapeDamnskippy, dylan: scrapeDylan, cohen: scrapeCohen };
const fn = map[which];
if (!fn) { console.error('usage: scrape-sites.mjs <damnskippy|dylan|cohen>'); process.exit(1); }
const songs = await fn();
const path = new URL(`../src/data/collection-${which}.json`, import.meta.url).pathname;
writeFileSync(path, JSON.stringify(songs));
console.error(`\n\n${which}: ${songs.length} songs -> ${path}`);
