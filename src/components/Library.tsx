import { useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { Song } from '../types';
import type { CollectionInfo } from '../lib/collections';
import { IconPlus, IconSearch, IconSettings, IconMusic, IconDownload, IconGraduation } from './icons';

export const MAIN = 'My Library';

export interface LibraryView {
  collection: string;
  q: string;
  tag: string | null;
}
export const DEFAULT_VIEW: LibraryView = { collection: MAIN, q: '', tag: null };

interface Props {
  songs: Song[];
  manifest: CollectionInfo[];
  onLoadCollection: (info: CollectionInfo) => Promise<void>;
  onOpen: (id: string) => void;
  onImport: () => void;
  onSettings: () => void;
  onPractice: () => void;
  /** Persisted browsing state so returning from a song restores the view. */
  view: LibraryView;
  onView: (v: LibraryView) => void;
  /** Persisted scroll position (mutated in place). */
  scrollPos: MutableRefObject<number>;
}

export function Library({ songs, manifest, onLoadCollection, onOpen, onImport, onSettings, onPractice, view, onView, scrollPos }: Props) {
  const { q, tag, collection } = view;
  const setQ = (v: string) => onView({ ...view, q: v });
  const setTag = (v: string | null) => onView({ ...view, tag: v });
  const setCollection = (c: string) => onView({ collection: c, q: '', tag: null });
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');

  // Restore scroll position when returning, and remember it as the user scrolls.
  const scrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollPos.current;
  }, []);

  const loadedNames = useMemo(() => {
    const set = new Set<string>();
    let hasMain = false;
    for (const s of songs) {
      if (s.collection) set.add(s.collection);
      else hasMain = true;
    }
    return { set, hasMain };
  }, [songs]);

  const collections = useMemo(() => {
    const rest = [...loadedNames.set].sort();
    return loadedNames.hasMain ? [MAIN, ...rest] : rest;
  }, [loadedNames]);

  // Collections that exist as downloads but aren't loaded yet.
  const downloadable = useMemo(
    () => manifest.filter((m) => !loadedNames.set.has(m.name)),
    [manifest, loadedNames],
  );

  const openDownloadable = async (m: CollectionInfo) => {
    setLoadError('');
    setLoadingId(m.id);
    try {
      await onLoadCollection(m);
      setCollection(m.name);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoadingId(null);
    }
  };

  const inCollection = useMemo(
    () => songs.filter((s) => (s.collection || MAIN) === collection),
    [songs, collection],
  );

  const allTags = useMemo(() => {
    const t = new Set<string>();
    for (const s of inCollection) s.tags?.forEach((x) => t.add(x));
    return [...t].sort();
  }, [inCollection]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inCollection
      .filter((s) => (tag ? s.tags?.includes(tag) : true))
      .filter((s) =>
        !needle ||
        s.title.toLowerCase().includes(needle) ||
        s.artist.toLowerCase().includes(needle),
      )
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [inCollection, q, tag]);

  // Group by artist for browsing.
  const groups = useMemo(() => {
    const map = new Map<string, Song[]>();
    for (const s of filtered) {
      const k = s.artist || 'Unknown';
      (map.get(k) ?? map.set(k, []).get(k)!).push(s);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="app">
      <div className="topbar">
        <h1>Chords <span className="sub">{inCollection.length}</span></h1>
        <button className="iconbtn" onClick={onPractice} aria-label="Learn"><IconGraduation /></button>
        <button className="iconbtn" onClick={onSettings} aria-label="Settings"><IconSettings /></button>
      </div>

      <div className="scroll" ref={scrollRef} onScroll={(e) => { scrollPos.current = e.currentTarget.scrollTop; }}>
        {(collections.length > 1 || downloadable.length > 0) && (
          <div className="collrow">
            {collections.map((c) => (
              <button
                key={c}
                className={`coll${c === collection ? ' on' : ''}`}
                onClick={() => setCollection(c)}
              >
                {c}
              </button>
            ))}
            {downloadable.map((m) => (
              <button
                key={m.id}
                className="coll download"
                onClick={() => openDownloadable(m)}
                disabled={loadingId !== null}
              >
                {loadingId === m.id ? 'Loading…' : <>{m.name} <IconDownload size={13} /> <span className="cnt">{m.count}</span></>}
              </button>
            ))}
          </div>
        )}
        {loadError && <div className="notice err" style={{ margin: '0 12px 8px' }}>{loadError}</div>}
        <div className="searchbar">
          <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }}>
              <IconSearch size={18} />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search songs or artists"
              style={{ paddingLeft: 38 }}
              autoCapitalize="none"
            />
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="tagrow">
            <button className={`chip${tag === null ? ' on' : ''}`} onClick={() => setTag(null)}>All</button>
            {allTags.map((t) => (
              <button key={t} className={`chip${tag === t ? ' on' : ''}`} onClick={() => setTag(t)}>{t}</button>
            ))}
          </div>
        )}

        {songs.length === 0 ? (
          <div className="empty">
            <div style={{ color: 'var(--accent)', marginBottom: 12 }}><IconMusic size={40} /></div>
            <h2>No songs yet</h2>
            <p>Import a chord page by link, or paste chords from anywhere.<br />Everything stays on your device.</p>
            <button className="btn primary" onClick={onImport} style={{ marginTop: 12 }}>
              <IconPlus size={18} /> Add your first song
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty"><p>Nothing matches “{q}”.</p></div>
        ) : (
          <div className="song-list">
            {groups.map(([artist, list]) => (
              <div key={artist}>
                <div className="group-head">{artist}</div>
                {list.map((s) => (
                  <button key={s.id} className="song-row" onClick={() => onOpen(s.id)}>
                    <div>
                      <div className="title">{s.title}</div>
                      <div className="meta">
                        {s.key && `Key ${s.key}`}
                        {s.key && s.capo ? ' · ' : ''}
                        {s.capo ? `Capo ${s.capo}` : ''}
                      </div>
                    </div>
                    <div className="badges">
                      {s.tags?.slice(0, 2).map((t) => <span key={t} className="badge">{t}</span>)}
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="fab" onClick={onImport} aria-label="Add song"><IconPlus size={26} /></button>
    </div>
  );
}
