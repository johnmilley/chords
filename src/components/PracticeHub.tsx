import { useMemo, useState } from 'react';
import type { Song, Settings } from '../types';
import type { MasteryMap } from '../lib/mastery';
import { chordPool, classify, recommendSongs } from '../lib/mastery';
import { ChordDiagram } from './ChordDiagram';
import { Modal } from './Modal';
import { IconBack, IconLayers, IconHeadphones } from './icons';

interface Props {
  songs: Song[];
  mastery: MasteryMap;
  settings: Settings;
  onBack: () => void;
  onOpenSong: (id: string) => void;
  onStartFlashcards: () => void;
  onStartEar: () => void;
}

export function PracticeHub({ songs, mastery, settings, onBack, onOpenSong, onStartFlashcards, onStartEar }: Props) {
  const [tapped, setTapped] = useState<string | null>(null);
  const pool = useMemo(() => chordPool(songs), [songs]);
  const recs = useMemo(() => recommendSongs(songs, mastery, 12), [songs, mastery]);

  const counts = useMemo(() => {
    const c = { known: 0, learning: 0, new: 0 };
    for (const p of pool) c[classify(mastery[p.symbol]?.level)]++;
    return c;
  }, [pool, mastery]);

  return (
    <div className="app">
      <div className="topbar">
        <button className="iconbtn" onClick={onBack} aria-label="Back"><IconBack /></button>
        <h1>Learn</h1>
      </div>

      <div className="scroll">
        <div className="practice-hub">
          <div className="vocab-summary">
            <div className="vocab-stat"><span className="n known">{counts.known}</span><span className="l">known</span></div>
            <div className="vocab-stat"><span className="n learning">{counts.learning}</span><span className="l">learning</span></div>
            <div className="vocab-stat"><span className="n new">{counts.new}</span><span className="l">new</span></div>
          </div>

          <div className="btnrow" style={{ padding: '0 14px' }}>
            <button className="btn primary" onClick={onStartFlashcards} style={{ flex: 1 }}><IconLayers size={18} /> Flashcards</button>
            <button className="btn primary" onClick={onStartEar} style={{ flex: 1 }}><IconHeadphones size={18} /> Ear training</button>
          </div>

          {pool.length > 0 && (
            <>
              <div className="group-head">Your chords</div>
              <div className="vocab-grid">
                {pool.map((p) => (
                  <button key={p.symbol} className={`vocab-chip ${classify(mastery[p.symbol]?.level)}`} onClick={() => setTapped(p.symbol)}>
                    {p.symbol}
                  </button>
                ))}
              </div>
            </>
          )}

          {recs.length > 0 && (
            <>
              <div className="group-head">Songs you're close to knowing</div>
              <div className="song-list">
                {recs.map(({ song, unknownChords }) => (
                  <button key={song.id} className="song-row" onClick={() => onOpenSong(song.id)}>
                    <div>
                      <div className="title">{song.title}</div>
                      <div className="meta">{song.artist}</div>
                    </div>
                    <div className="badges">
                      <span className="badge">
                        {unknownChords.length === 0 ? 'You know this one' : `${unknownChords.length} new chord${unknownChords.length === 1 ? '' : 's'}`}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {pool.length === 0 && (
            <div className="empty"><p>Add or load some songs first, then come back to practice their chords.</p></div>
          )}
        </div>
      </div>

      {tapped && (
        <Modal onClose={() => setTapped(null)}>
          <div className="diagram-wrap">
            <div className="diagram-name">{tapped}</div>
            <ChordDiagram symbol={tapped} instrument={settings.instrument} leftHanded={settings.leftHanded} size={200} />
          </div>
        </Modal>
      )}
    </div>
  );
}
