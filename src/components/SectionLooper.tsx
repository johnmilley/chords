import { useEffect, useMemo, useRef, useState } from 'react';
import type { Song } from '../types';
import { splitSections, extractChordSequence } from '../lib/chordpro';
import { transposeChord, transposeKeyName } from '../lib/music';
import { Metronome } from '../lib/audio';
import { ChordSheet } from './ChordSheet';
import { IconBack, IconMinus, IconPlus, IconRepeat } from './icons';

interface Props {
  song: Song;
  onBack: () => void;
  onDone: (chordsPracticed: string[]) => void;
}

// Loose mapping from tempo to reading scroll speed — not a literal
// beats-to-pixels conversion, just "faster tempo reads faster."
const scrollSpeedFromBpm = (bpm: number) => bpm * 2.2;

export function SectionLooper({ song, onBack, onDone }: Props) {
  const transpose = song.prefs?.transpose ?? 0;
  const capo = song.prefs?.capo ?? song.capo ?? 0;
  const shift = transpose - capo;
  const soundingKey = song.key ? transposeKeyName(song.key, transpose) : undefined;

  const sections = useMemo(() => splitSections(song.body), [song.body]);
  const [secIdx, setSecIdx] = useState(0);
  const section = sections[secIdx];

  const [bpm, setBpm] = useState(70);
  const [ramp, setRamp] = useState(true);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [loops, setLoops] = useState(0);
  const [liveBpm, setLiveBpm] = useState(bpm);
  const [beat, setBeat] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const metRef = useRef<Metronome | null>(null);
  const rafRef = useRef(0);
  const curBpmRef = useRef(bpm);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => () => stopAll(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function stopAll() {
    metRef.current?.stop();
    metRef.current = null;
    cancelAnimationFrame(rafRef.current);
  }

  const start = () => {
    if (!section) return;
    setFinished(false);
    setLoops(0);
    setLiveBpm(bpm);
    curBpmRef.current = bpm;
    seenRef.current = new Set(extractChordSequence(section.body).map((c) => transposeChord(c, shift, soundingKey)));

    const met = new Metronome(bpm, 4, (b) => setBeat(b));
    metRef.current = met;
    met.start();

    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (el) {
        el.scrollTop += scrollSpeedFromBpm(curBpmRef.current) * dt;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
          el.scrollTop = 0;
          setLoops((l) => l + 1);
          if (ramp) {
            curBpmRef.current = Math.min(220, curBpmRef.current + 4);
            met.setBpm(curBpmRef.current);
            setLiveBpm(curBpmRef.current);
          }
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    setRunning(true);
  };

  const stop = () => {
    stopAll();
    setRunning(false);
    setFinished(true);
  };

  const finishAndExit = () => onDone([...seenRef.current]);

  if (!section) {
    return (
      <div className="app">
        <div className="topbar">
          <button className="iconbtn" onClick={onBack} aria-label="Back"><IconBack /></button>
          <h1>Section Looper</h1>
        </div>
        <div className="empty"><p>This song has no chords to loop yet.</p></div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="topbar">
        <button className="iconbtn" onClick={running ? stop : onBack} aria-label="Back"><IconBack /></button>
        <h1>Section Looper <span className="sub">{song.title}</span></h1>
      </div>

      {!running && !finished && (
        <div className="scroll">
          <div className="drill drill-setup">
            <div className="field">
              <label>Section</label>
              <div className="tagrow" style={{ padding: 0 }}>
                {sections.map((s, i) => (
                  <button key={i} className={`chip${i === secIdx ? ' on' : ''}`} onClick={() => setSecIdx(i)}>{s.label}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Tempo — {bpm} BPM</label>
              <div className="tool" style={{ alignSelf: 'flex-start' }}>
                <button onClick={() => setBpm((b) => Math.max(30, b - 5))}><IconMinus size={18} /></button>
                <span className="val">{bpm}</span>
                <button onClick={() => setBpm((b) => Math.min(200, b + 5))}><IconPlus size={18} /></button>
              </div>
            </div>
            <div className="setting-row" style={{ border: 'none', padding: '4px 0' }}>
              <div><div className="label">Ramp up tempo</div><div className="desc">+4 BPM each time it loops back to the top</div></div>
              <button className={`switch${ramp ? ' on' : ''}`} onClick={() => setRamp((r) => !r)} aria-label="Ramp tempo" />
            </div>
            <button className="btn primary block" onClick={start}><IconRepeat size={18} /> Start looping</button>
          </div>
        </div>
      )}

      {running && (
        <>
          <div className="scroll" ref={scrollRef}>
            <div className="reader">
              <ChordSheet body={section.body} shift={shift} targetKey={soundingKey} columns={false} onChordTap={() => {}} />
              <div style={{ height: '60vh' }} />
            </div>
          </div>
          <div className="toolbar">
            <div className="tool">
              <span className="lbl">Beat</span>
              <span className={`beatpip${beat === 0 ? ' accent' : ''}`} />
            </div>
            <div className="tool"><span className="val">{liveBpm} BPM</span></div>
            <div className="tool"><span className="val">Loop {loops + 1}</span></div>
            <button className="btn danger" onClick={stop} style={{ marginLeft: 'auto' }}>Stop</button>
          </div>
        </>
      )}

      {finished && (
        <div className="scroll">
          <div className="drill drill-summary">
            <h2>Nice work</h2>
            <p>Looped “{section.label}” {loops} time{loops === 1 ? '' : 's'}{ramp ? `, up to ${liveBpm} BPM` : ''}.</p>
            <div className="btnrow">
              <button className="btn" onClick={start}>Go again</button>
              <button className="btn primary" onClick={finishAndExit}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
