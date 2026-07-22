# Chords

A clean, mobile-first guitar chord reader. Just the chords — no ads, no popups,
no bullshit. Import songs by link or paste, and read them anywhere, offline.

## What it does

- **Reader-first.** Chords sit above the right syllable. Big, legible, dark by default.
- **Small screens first, big screens flex.** On a phone it's a single scrolling
  column; on a tablet/desktop the song flows into 2–3 side-by-side columns so you
  see more at once.
- **All the modern tab-site controls:**
  - Transpose up/down by semitone
  - Capo (shows the shapes to play; recalculates chords)
  - Auto-scroll with adjustable speed
  - Font size / zoom
  - Tap any chord → fingering diagram (guitar, with **left-handed** mirror, or **piano**)
  - "Chords in this song" grid
- **Import from links or paste.** Pulls from Ultimate Guitar and generic
  chords-over-lyrics text and converts it to a clean internal format you can edit.
- **Local-first.** Everything lives in your browser (IndexedDB). Export/import a
  backup file to move between devices. Installable as a PWA, works offline.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Build for production:

```bash
npm run build
npm run preview
```

## Importing by link (the proxy)

Browsers can't fetch chord sites directly (CORS + anti-scraping), so link-import
uses a tiny serverless fetcher. Without it, **paste** still works fully.

Deploy the included Cloudflare Worker:

```bash
npm i -g wrangler
wrangler login
npx wrangler deploy          # prints https://chords-proxy.<you>.workers.dev
```

Then in the app: **Settings → Import proxy URL** → paste that URL. Now
"Fetch & parse" works on a pasted link.

The worker (`worker/proxy.js`) only fetches from an allow-list of known chord
sites and is for personal use — respect each site's terms of service.

## Deploy the app

It's a static site (relative base path), so it drops onto GitHub Pages, Netlify,
Cloudflare Pages, or any static host. `dist/` is the build output.

## Tech

Vite + React + TypeScript, `vite-plugin-pwa` for offline/installable, `idb-keyval`
for storage. Internal format is ChordPro. No backend for the app itself.
