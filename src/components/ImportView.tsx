import { useRef, useState } from 'react';
import type { Settings, Song } from '../types';
import { fetchAndParse, parsePasted } from '../lib/import';
import { parseFavorites, looksLikeFavorites } from '../lib/favorites';
import { uid } from '../lib/storage';
import { IconBack, IconLink, IconStar } from './icons';

interface Props {
  settings: Settings;
  onBack: () => void;
  onSave: (song: Song) => void;
  onImportMany: (songs: Song[]) => number;
}

type Stage = 'input' | 'review';

export function ImportView({ settings, onBack, onSave, onImportMany }: Props) {
  const [stage, setStage] = useState<Stage>('input');
  const [url, setUrl] = useState('');
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const favCount = looksLikeFavorites(pasted) ? parseFavorites(pasted).length : 0;

  const onFile = async (file: File) => {
    const text = await file.text();
    setPasted(text);
    setError('');
    setOk('');
  };

  const importFavorites = () => {
    const entries = parseFavorites(pasted);
    if (entries.length === 0) { setError('No songs found in that page.'); return; }
    const now = Date.now();
    const songs: Song[] = entries.map((e, i) => ({
      id: uid() + i,
      title: e.title,
      artist: e.artist,
      key: '',
      capo: 0,
      body: '',
      sourceUrl: e.url,
      tags: ['favorites', e.type.toLowerCase().replace(/\s+/g, '-')].filter(Boolean),
      createdAt: now,
      updatedAt: now,
    }));
    const added = onImportMany(songs);
    setError('');
    setOk(`Imported ${added} song${added === 1 ? '' : 's'}${added < songs.length ? ` (${songs.length - added} already in your library)` : ''}. Open one to fetch its chords.`);
    setPasted('');
  };

  // Review fields.
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [key, setKey] = useState('');
  const [capo, setCapo] = useState(0);
  const [tags, setTags] = useState('');
  const [body, setBody] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const goReview = (r: { title: string; artist: string; key: string; capo: number; body: string }, src?: string) => {
    setTitle(r.title);
    setArtist(r.artist);
    setKey(r.key);
    setCapo(r.capo);
    setBody(r.body);
    setSourceUrl(src ?? '');
    setStage('review');
  };

  const onFetch = async () => {
    setError('');
    setBusy(true);
    const out = await fetchAndParse(url.trim(), settings.proxyUrl);
    setBusy(false);
    if (out.ok && out.result) {
      goReview(out.result, url.trim());
    } else {
      setError(out.error ?? 'Import failed.');
    }
  };

  const onParsePaste = () => {
    setError('');
    if (!pasted.trim()) { setError('Paste some chords first.'); return; }
    goReview(parsePasted(pasted), url.trim() || undefined);
  };

  const save = () => {
    if (!title.trim()) { setError('Give the song a title.'); return; }
    const now = Date.now();
    onSave({
      id: uid(),
      title: title.trim(),
      artist: artist.trim(),
      key: key.trim(),
      capo: Number(capo) || 0,
      body,
      sourceUrl: sourceUrl || undefined,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      createdAt: now,
      updatedAt: now,
    });
  };

  return (
    <div className="app">
      <div className="topbar">
        <button className="iconbtn" onClick={stage === 'review' ? () => setStage('input') : onBack} aria-label="Back"><IconBack /></button>
        <h1>{stage === 'input' ? 'Add a song' : 'Review & save'}</h1>
      </div>

      <div className="scroll">
        {stage === 'input' ? (
          <div className="form">
            <div className="field">
              <label>Import from a link</label>
              <div className="row2">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://tabs.ultimate-guitar.com/..."
                  autoCapitalize="none"
                  inputMode="url"
                />
              </div>
              <button className="btn primary" onClick={onFetch} disabled={busy || !url.trim()}>
                <IconLink size={18} /> {busy ? 'Fetching…' : 'Fetch & parse'}
              </button>
              {!settings.proxyUrl && (
                <div className="notice warn">
                  No import proxy is set up, so links can’t be fetched automatically (browsers block
                  cross-site requests). Paste the chords below, or add a proxy URL in Settings.
                </div>
              )}
            </div>

            <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>— or —</div>

            <div className="field">
              <label>Paste chords — or a saved favorites page</label>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={12}
                placeholder={'Paste chords-over-lyrics text here.\n\n[Verse]\nG           C\nTwinkle twinkle little star'}
                spellCheck={false}
              />
              <button className="btn" onClick={() => fileRef.current?.click()} style={{ alignSelf: 'flex-start' }}>
                Upload an .html file
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".html,.htm,text/html,text/plain"
                hidden
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
              <div className="hint">
                To import a whole favorites list: on Ultimate Guitar, open your favorites, save the
                page (Ctrl/Cmd-S → “Webpage, HTML only”), then upload that file here.
              </div>
              <div className="hint">
                Works with copied text from Ultimate Guitar and most chord sites. Chord lines above
                lyrics are detected and aligned automatically.
              </div>
              {favCount > 0 ? (
                <button className="btn primary" onClick={importFavorites}>
                  <IconStar size={18} /> Import {favCount} songs from your favorites
                </button>
              ) : (
                <button className="btn" onClick={onParsePaste} disabled={!pasted.trim()}>Parse pasted text</button>
              )}
            </div>

            {favCount > 0 && (
              <div className="notice ok">
                Detected an Ultimate Guitar favorites page with {favCount} songs. Import creates a
                library entry with the link for each — open any song to pull its chords.
              </div>
            )}
            {ok && <div className="notice ok">{ok}</div>}
            {error && <div className="notice err">{error}</div>}
          </div>
        ) : (
          <div className="form">
            <div className="row2">
              <div className="field">
                <label>Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Song title" />
              </div>
              <div className="field">
                <label>Artist</label>
                <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Key</label>
                <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. G" />
              </div>
              <div className="field">
                <label>Capo</label>
                <input type="number" min={0} max={11} value={capo} onChange={(e) => setCapo(Number(e.target.value))} />
              </div>
            </div>
            <div className="field">
              <label>Tags (comma separated)</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="folk, favorites, to-learn" />
            </div>
            <div className="field">
              <label>Chords (ChordPro — edit anything that came out wrong)</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={16} spellCheck={false} />
              <div className="hint">Chords go in [brackets] before the syllable they land on.</div>
            </div>
            {error && <div className="notice err">{error}</div>}
            <button className="btn primary block" onClick={save}>Save to library</button>
          </div>
        )}
      </div>
    </div>
  );
}
