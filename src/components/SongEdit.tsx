import { useState } from 'react';
import type { Song } from '../types';
import { IconBack, IconTrash } from './icons';

interface Props {
  song: Song;
  onBack: () => void;
  onSave: (song: Song) => void;
  onDelete: (id: string) => void;
}

export function SongEdit({ song, onBack, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist);
  const [key, setKey] = useState(song.key);
  const [capo, setCapo] = useState(song.capo);
  const [tags, setTags] = useState(song.tags.join(', '));
  const [body, setBody] = useState(song.body);
  const [confirmDel, setConfirmDel] = useState(false);

  const save = () => {
    onSave({
      ...song,
      title: title.trim() || song.title,
      artist: artist.trim(),
      key: key.trim(),
      capo: Number(capo) || 0,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      body,
      updatedAt: Date.now(),
    });
  };

  return (
    <div className="app">
      <div className="topbar">
        <button className="iconbtn" onClick={onBack} aria-label="Back"><IconBack /></button>
        <h1>Edit song</h1>
        <button className="iconbtn" onClick={() => setConfirmDel(true)} aria-label="Delete"><IconTrash /></button>
      </div>
      <div className="scroll">
        <div className="form">
          <div className="row2">
            <div className="field"><label>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="field"><label>Artist</label><input value={artist} onChange={(e) => setArtist(e.target.value)} /></div>
          </div>
          <div className="row2">
            <div className="field"><label>Key</label><input value={key} onChange={(e) => setKey(e.target.value)} /></div>
            <div className="field"><label>Capo</label><input type="number" min={0} max={11} value={capo} onChange={(e) => setCapo(Number(e.target.value))} /></div>
          </div>
          <div className="field"><label>Tags</label><input value={tags} onChange={(e) => setTags(e.target.value)} /></div>
          <div className="field">
            <label>Chords (ChordPro)</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={20} spellCheck={false} />
          </div>
          <button className="btn primary block" onClick={save}>Save changes</button>
        </div>
      </div>

      {confirmDel && (
        <div className="scrim" onClick={() => setConfirmDel(false)}>
          <div className="sheet-modal" onClick={(e) => e.stopPropagation()}>
            <div className="grabber" />
            <div className="modal-title">Delete “{song.title}”?</div>
            <p style={{ color: 'var(--text-dim)' }}>This can’t be undone.</p>
            <div className="btnrow" style={{ marginTop: 8 }}>
              <button className="btn" onClick={() => setConfirmDel(false)}>Cancel</button>
              <button className="btn danger" onClick={() => onDelete(song.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
