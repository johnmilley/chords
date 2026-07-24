import { useEffect, useMemo, useRef, useState } from 'react';
import type { Song } from '../types';
import { extractChordSequence } from '../lib/chordpro';
import { transposeChord, transposeKeyName } from '../lib/music';
import { Metronome } from '../lib/audio';
import { ChordDiagram } from './ChordDiagram';
import { IconBack, IconMinus, IconPlus, IconTarget } from './icons';

interface Props {
  song: Song;
  instrument: 'guitar' | 'piano';
  leftHanded: boolean;
  onBack: () => void;
  onDone: (chordsPracticed: string[]) => void;
}

export function ChordSwitchDrill({ song, instrument, leftHanded, onBack, onDone }: Props) {
  const transpose = song.prefs?.transpose ?? 0;
  const capo = song.prefs?.capo ?? song.capo ?? 0;
  const shift = transpose - capo;
  const soundingKey = song.key ? transposeKeyName(song.key, transpose) : undefined;

  const sequence = useMemo(() => {
    const raw = extractChordSequence(song.body);
    return raw.map((c) => transposeChord(c, shift, soundingKey));
  }, [song.body, shift, soundingKey]);

  const [bpm, setBpm] = useState(60);
  const [beatsPerChord, setBeatsPerChord] = useState(4);
  const [ramp, setRamp] = useState(true);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [index, setIndex] = useState(0);
  const [beatInBar, setBeatInBar] = useState(0);
  const [loops, setLoops] = useState(0);
  const [liveBpm, setLiveBpm] = useState(bpm);
  const metRef = useRef<Metronome | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const curBpmRef = useRef(bpm);

  useEffect(() => () => metRef.current?.stop(), []);

  const start = () => {
    if (sequence.length === 0) return;
    setFinished(false);
    setIndex(0);
    setBeatInBar(0);
    setLoops(0);
    setLiveBpm(bpm);
    curBpmRef.current = bpm;
    seenRef.current = new Set([sequence[0]]);
    const met = new Metronome(bpm, beatsPerChord, (beat, total) => {
      setBeatInBar(beat);
      if (beat === 0 && total > 0) {
        setIndex((prev) => {
          const next = (prev + 1) % sequence.length;
          seenRef.current.add(sequence[next]);
          if (next === 0) {
            setLoops((l) => l + 1);
            if (ramp) {
              const nb = Math.min(220, curBpmRef.current + 4);
              curBpmRef.current = nb;
              met.setBpm(nb);
              setLiveBpm(nb);
            }
          }
          return next;
        });
      }
    });
    metRef.current = met;
    met.start();
    setRunning(true);
  };

  const stop = () => {
    metRef.current?.stop();
    metRef.current = null;
    setRunning(false);
    setFinished(true);
  };

  const finishAndExit = () => {
    onDone([...seenRef.current]);
  };

  if (sequence.length === 0) {
    return (
      <div className="app">
        <div className="topbar">
          <button className="iconbtn" onClick={onBack} aria-label="Back"><IconBack /></button>
          <h1>Chord-Switch Drill</h1>
        </div>
        <div className="empty"><p>This song has no chords to drill yet.</p></div>
      </div>
    );
  }

  const current = sequence[index];
  const next = sequence[(index + 1) % sequence.length];

  return (
    <div className="app">
      <div className="topbar">
        <button className="iconbtn" onClick={running ? stop : onBack} aria-label="Back"><IconBack /></button>
        <h1>Chord-Switch Drill <span className="sub">{song.title}</span></h1>
      </div>

      <div className="scroll">
        <div className="drill">
          {!running && !finished && (
            <div className="drill-setup">
              <div className="field">
                <label>Tempo — {bpm} BPM</label>
                <div className="tool" style={{ alignSelf: 'flex-start' }}>
                  <button onClick={() => setBpm((b) => Math.max(30, b - 5))}><IconMinus size={18} /></button>
                  <span className="val">{bpm}</span>
                  <button onClick={() => setBpm((b) => Math.min(200, b + 5))}><IconPlus size={18} /></button>
                </div>
              </div>
              <div className="field">
                <label>Beats per chord</label>
                <div className="seg-control" style={{ alignSelf: 'flex-start' }}>
                  {[2, 4].map((n) => (
                    <button key={n} className={beatsPerChord === n ? 'on' : ''} onClick={() => setBeatsPerChord(n)}>{n}</button>
                  ))}
                </div>
              </div>
              <div className="setting-row" style={{ border: 'none', padding: '4px 0' }}>
                <div><div className="label">Ramp up tempo</div><div className="desc">+4 BPM every full loop through the song</div></div>
                <button className={`switch${ramp ? ' on' : ''}`} onClick={() => setRamp((r) => !r)} aria-label="Ramp tempo" />
              </div>
              <div className="hint">{sequence.length} chords in this progression: {sequence.join(' – ')}</div>
              <button className="btn primary block" onClick={start}><IconTarget size={18} /> Start drill</button>
            </div>
          )}

          {running && (
            <div className="drill-play">
              <div className="beat-dots">
                {Array.from({ length: beatsPerChord }, (_, i) => (
                  <span key={i} className={`dot${i === beatInBar ? ' on' : ''}${i === 0 ? ' accent' : ''}`} />
                ))}
              </div>
              <div className="drill-chord">{current}</div>
              <ChordDiagram symbol={current} instrument={instrument} leftHanded={leftHanded} size={140} />
              <div className="drill-next">next: <b>{next}</b></div>
              <div className="drill-stats">{liveBpm} BPM · loop {loops + 1}</div>
              <button className="btn danger block" onClick={stop} style={{ marginTop: 18 }}>Stop</button>
            </div>
          )}

          {finished && (
            <div className="drill-summary">
              <h2>Nice work</h2>
              <p>Practiced {seenRef.current.size} chord{seenRef.current.size === 1 ? '' : 's'} over {loops} loop{loops === 1 ? '' : 's'}{ramp ? `, up to ${liveBpm} BPM` : ''}.</p>
              <div className="btnrow">
                <button className="btn" onClick={start}>Go again</button>
                <button className="btn primary" onClick={finishAndExit}>Done</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
