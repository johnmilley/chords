import { useMemo, useState } from 'react';
import type { Song } from '../types';
import { IconPlus, IconSearch, IconSettings, IconMusic } from './icons';

interface Props {
  songs: Song[];
  onOpen: (id: string) => void;
  onImport: () => void;
  onSettings: () => void;
}

export function Library({ songs, onOpen, onImport, onSettings }: Props) {
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const t = new Set<string>();
    for (const s of songs) s.tags?.forEach((x) => t.add(x));
    return [...t].sort();
  }, [songs]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return songs
      .filter((s) => (tag ? s.tags?.includes(tag) : true))
      .filter((s) =>
        !needle ||
        s.title.toLowerCase().includes(needle) ||
        s.artist.toLowerCase().includes(needle),
      )
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [songs, q, tag]);

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
        <h1>Chords <span className="sub">{songs.length}</span></h1>
        <button className="iconbtn" onClick={onSettings} aria-label="Settings"><IconSettings /></button>
      </div>

      <div className="scroll">
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
