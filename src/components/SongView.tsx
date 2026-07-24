import { useEffect, useRef, useState } from 'react';
import type { Song, Settings } from '../types';
import { ChordSheet } from './ChordSheet';
import { ChordDiagram } from './ChordDiagram';
import { Modal } from './Modal';
import { transposeKeyName } from '../lib/music';
import { extractChords } from '../lib/chordpro';
import { transposeChord } from '../lib/music';
import { fetchAndParse } from '../lib/import';
import {
  IconBack, IconEdit, IconMinus, IconPlus, IconPause, IconPlay, IconMusic, IconList, IconPrint,
  IconTarget, IconRepeat, IconGraduation,
} from './icons';

interface Props {
  song: Song;
  settings: Settings;
  onBack: () => void;
  onEdit: () => void;
  onChange: (song: Song) => void;
  onUpdateSettings: (patch: Partial<Settings>) => void;
  onPracticeSwitch: () => void;
  onPracticeLoop: () => void;
}

export function SongView({ song, settings, onBack, onEdit, onChange, onUpdateSettings, onPracticeSwitch, onPracticeLoop }: Props) {
  const transpose = song.prefs?.transpose ?? 0;
  const capo = song.prefs?.capo ?? song.capo ?? 0;
  const shift = transpose - capo;

  const [tapped, setTapped] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [columns, setColumns] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [printing, setPrinting] = useState(false);
  const [choosingPractice, setChoosingPractice] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasBody = song.body.trim().length > 0;

  const fetchFromSource = async () => {
    if (!song.sourceUrl) return;
    setFetchError('');
    setFetching(true);
    const out = await fetchAndParse(song.sourceUrl, settings.proxyUrl);
    setFetching(false);
    if (out.ok && out.result) {
      onChange({
        ...song,
        body: out.result.body,
        key: song.key || out.result.key,
        capo: song.capo || out.result.capo,
        updatedAt: Date.now(),
      });
    } else {
      setFetchError(out.error ?? 'Fetch failed.');
    }
  };

  const setPrefs = (patch: Partial<NonNullable<Song['prefs']>>) =>
    onChange({ ...song, prefs: { ...song.prefs, ...patch }, updatedAt: Date.now() });

  // Auto-scroll loop.
  useEffect(() => {
    if (!scrolling) return;
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      el.scrollTop += (settings.scrollSpeed / 10) * dt * 10;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        setScrolling(false);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [scrolling, settings.scrollSpeed]);

  const doPrint = (cols: 1 | 2 | 3, size: number) => {
    const body = document.body;
    const cls = cols === 2 ? 'print-cols-2' : cols === 3 ? 'print-cols-3' : 'print-cols-1';
    body.classList.add(cls);
    body.style.setProperty('--print-size', `${size}pt`);
    setPrinting(false);
    const cleanup = () => {
      body.classList.remove('print-cols-1', 'print-cols-2', 'print-cols-3');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    // Let the dialog close before the print dialog opens.
    setTimeout(() => window.print(), 60);
  };

  const soundingKey = song.key ? transposeKeyName(song.key, transpose) : '';
  const usedChords = extractChords(song.body).map((c) => transposeChord(c, shift, soundingKey || undefined));

  return (
    <div className="app">
      <div className="topbar">
        <button className="iconbtn" onClick={onBack} aria-label="Back"><IconBack /></button>
        <h1>
          {song.title}
          {song.artist ? <span className="sub"> · {song.artist}</span> : null}
        </h1>
        {hasBody && <button className="iconbtn" onClick={() => setShowAll(true)} aria-label="All chords"><IconMusic /></button>}
        {hasBody && <button className="iconbtn" onClick={() => setChoosingPractice(true)} aria-label="Practice"><IconGraduation /></button>}
        {hasBody && <button className="iconbtn" onClick={() => setPrinting(true)} aria-label="Print"><IconPrint /></button>}
        <button className="iconbtn" onClick={onEdit} aria-label="Edit"><IconEdit /></button>
      </div>

      <div className="scroll" ref={scrollRef} style={{ ['--font-size' as string]: `${settings.fontSize}px` }}>
        <div className="reader">
          <div className="reader-head">
            <div className="print-only">
              <h2>{song.title}</h2>
              {song.artist && <div className="by">{song.artist}</div>}
              <div className="meta">
                {soundingKey && `Key ${soundingKey}`}
                {soundingKey && capo ? '  ·  ' : ''}
                {capo ? `Capo ${capo}` : ''}
              </div>
            </div>
            <div className="keyline">
              {soundingKey && <span>Key <b>{soundingKey}</b></span>}
              {capo > 0 && <span>Capo <b>{capo}</b></span>}
              {transpose !== 0 && <span>Transposed <b>{transpose > 0 ? `+${transpose}` : transpose}</b></span>}
              {song.sourceUrl && <a href={song.sourceUrl} target="_blank" rel="noreferrer">source</a>}
            </div>
          </div>
          {hasBody ? (
            <ChordSheet
              body={song.body}
              shift={shift}
              targetKey={soundingKey || undefined}
              columns={columns}
              onChordTap={setTapped}
            />
          ) : (
            <div className="empty">
              <h2>No chords yet</h2>
              {song.sourceUrl ? (
                <p>
                  This song was imported from a link.{' '}
                  {settings.proxyUrl
                    ? 'Pull the chords from the source, or add them by hand.'
                    : 'Set up an import proxy in Settings to fetch automatically, or add the chords by hand.'}
                </p>
              ) : (
                <p>Add the chords by hand to start reading.</p>
              )}
              <div className="btnrow" style={{ maxWidth: 360, margin: '16px auto 0' }}>
                {song.sourceUrl && settings.proxyUrl && (
                  <button className="btn primary" onClick={fetchFromSource} disabled={fetching}>
                    {fetching ? 'Fetching…' : 'Fetch chords'}
                  </button>
                )}
                <button className="btn" onClick={onEdit}>Add by hand</button>
              </div>
              {song.sourceUrl && (
                <p style={{ marginTop: 14 }}>
                  <a href={song.sourceUrl} target="_blank" rel="noreferrer">Open source page ↗</a>
                </p>
              )}
              {fetchError && <div className="notice err" style={{ marginTop: 14, textAlign: 'left' }}>{fetchError}</div>}
            </div>
          )}
        </div>
      </div>

      <div className="toolbar">
        <div className="tool">
          <span className="lbl">Key</span>
          <button onClick={() => setPrefs({ transpose: transpose - 1 })} aria-label="Transpose down"><IconMinus size={18} /></button>
          <span className="val">{transpose > 0 ? `+${transpose}` : transpose}</span>
          <button onClick={() => setPrefs({ transpose: transpose + 1 })} aria-label="Transpose up"><IconPlus size={18} /></button>
        </div>

        <div className="tool">
          <span className="lbl">Capo</span>
          <button onClick={() => setPrefs({ capo: Math.max(0, capo - 1) })} aria-label="Capo down"><IconMinus size={18} /></button>
          <span className="val">{capo}</span>
          <button onClick={() => setPrefs({ capo: Math.min(11, capo + 1) })} aria-label="Capo up"><IconPlus size={18} /></button>
        </div>

        <div className="tool">
          <span className="lbl">Size</span>
          <button onClick={() => onUpdateSettings({ fontSize: Math.max(12, settings.fontSize - 1) })} aria-label="Smaller"><IconMinus size={18} /></button>
          <span className="val">{settings.fontSize}</span>
          <button onClick={() => onUpdateSettings({ fontSize: Math.min(30, settings.fontSize + 1) })} aria-label="Larger"><IconPlus size={18} /></button>
        </div>

        <div className="tool">
          <span className="lbl">Scroll</span>
          <button onClick={() => onUpdateSettings({ scrollSpeed: Math.max(5, settings.scrollSpeed - 10) })} aria-label="Slower"><IconMinus size={18} /></button>
          <button className={scrolling ? 'on' : ''} onClick={() => setScrolling((s) => !s)} aria-label="Play/pause scroll">
            {scrolling ? <IconPause size={18} /> : <IconPlay size={18} />}
          </button>
          <button onClick={() => onUpdateSettings({ scrollSpeed: Math.min(200, settings.scrollSpeed + 10) })} aria-label="Faster"><IconPlus size={18} /></button>
        </div>

        <div className="tool">
          <button className={columns ? 'on' : ''} onClick={() => setColumns((c) => !c)} aria-label="Toggle columns" title="Columns (wide screens)"><IconList size={18} /></button>
        </div>
      </div>

      {tapped && (
        <Modal title={undefined} onClose={() => setTapped(null)}>
          <ChordDetail symbol={tapped} settings={settings} onUpdateSettings={onUpdateSettings} />
        </Modal>
      )}

      {printing && (
        <Modal title="Print / save as PDF" onClose={() => setPrinting(false)}>
          <PrintDialog onPrint={doPrint} />
        </Modal>
      )}

      {choosingPractice && (
        <Modal title="Practice this song" onClose={() => setChoosingPractice(false)}>
          <div className="btnrow" style={{ flexDirection: 'column', gap: 10 }}>
            <button className="btn primary block" onClick={onPracticeSwitch}>
              <IconTarget size={18} /> Chord-switch drill
            </button>
            <button className="btn block" onClick={onPracticeLoop}>
              <IconRepeat size={18} /> Section looper
            </button>
          </div>
        </Modal>
      )}

      {showAll && (
        <Modal title="Chords in this song" onClose={() => setShowAll(false)}>
          <div className="chord-grid">
            {usedChords.map((c) => (
              <button key={c} className="chord-card" onClick={() => { setShowAll(false); setTapped(c); }}>
                <span className="nm">{c}</span>
                <ChordDiagram symbol={c} instrument={settings.instrument} leftHanded={settings.leftHanded} size={92} />
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function PrintDialog({ onPrint }: { onPrint: (cols: 1 | 2 | 3, size: number) => void }) {
  const [cols, setCols] = useState<1 | 2 | 3>(1);
  const [size, setSize] = useState(11);
  return (
    <div className="form" style={{ padding: 0 }}>
      <div className="field">
        <label>Layout</label>
        <div className="seg-control" style={{ alignSelf: 'flex-start' }}>
          {([1, 2, 3] as const).map((c) => (
            <button key={c} className={cols === c ? 'on' : ''} onClick={() => setCols(c)}>
              {c} column{c > 1 ? 's' : ''}
            </button>
          ))}
        </div>
        <div className="hint">
          One column reads biggest; two or three fit a long song on one page. Lines and sections never
          split across a page or column.
        </div>
      </div>
      <div className="field">
        <label>Text size — {size}pt</label>
        <input type="range" min={8} max={16} step={0.5} value={size} onChange={(e) => setSize(Number(e.target.value))} />
      </div>
      <div className="notice ok">
        Prints the chords exactly as shown now (transpose &amp; capo included). In the print dialog,
        choose “Save as PDF” for a file.
      </div>
      <button className="btn primary block" onClick={() => onPrint(cols, size)}>
        <IconPrint size={18} /> Print / Save as PDF
      </button>
    </div>
  );
}

function ChordDetail({ symbol, settings, onUpdateSettings }: { symbol: string; settings: Settings; onUpdateSettings: (p: Partial<Settings>) => void }) {
  return (
    <div className="diagram-wrap">
      <div className="diagram-name">{symbol}</div>
      <ChordDiagram symbol={symbol} instrument={settings.instrument} leftHanded={settings.leftHanded} size={settings.instrument === 'guitar' ? 200 : 150} />
      <div className="diagram-alt">
        <div className="seg-control">
          <button className={settings.instrument === 'guitar' ? 'on' : ''} onClick={() => onUpdateSettings({ instrument: 'guitar' })}>Guitar</button>
          <button className={settings.instrument === 'piano' ? 'on' : ''} onClick={() => onUpdateSettings({ instrument: 'piano' })}>Piano</button>
        </div>
        {settings.instrument === 'guitar' && (
          <button className="btn" onClick={() => onUpdateSettings({ leftHanded: !settings.leftHanded })}>
            {settings.leftHanded ? 'Left-handed' : 'Right-handed'}
          </button>
        )}
      </div>
    </div>
  );
}
