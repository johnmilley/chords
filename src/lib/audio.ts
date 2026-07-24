// Lightweight Web Audio synth: chord playback for ear training, and a
// metronome click. No samples/recordings — everything is generated tones,
// so there's nothing to fetch and it works fully offline.

import { pianoVoicing } from './chord-shapes';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// Base frequency for semitone 0 (as produced by pianoVoicing) — chosen so a
// chord's tones sit in a comfortable, easily-distinguished mid-low range.
const BASE_HZ = 130.813; // C3

function freqOf(semitonesFromBase: number): number {
  return BASE_HZ * Math.pow(2, semitonesFromBase / 12);
}

/** Play a chord's tones together (a soft block chord), for ear training. */
export function playChordAudio(symbol: string, durationMs = 1400): void {
  const v = pianoVoicing(symbol);
  if (!v) return;
  const audio = getCtx();
  const now = audio.currentTime;
  const notes = [...v.pitches];
  if (v.bass !== null) notes.push(v.bass - 12); // bass note, an octave down

  const master = audio.createGain();
  master.gain.setValueAtTime(0.22, now);
  master.connect(audio.destination);

  notes.forEach((semi, i) => {
    const osc = audio.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freqOf(semi), now);
    const gain = audio.createGain();
    const start = now + i * 0.015; // gentle strum-like stagger
    const dur = durationMs / 1000;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.9, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  });
}

/** A single metronome click at the given time offset (seconds from now). */
export function scheduleClick(atOffsetSec: number, accent = false): void {
  const audio = getCtx();
  const t = audio.currentTime + Math.max(0, atOffsetSec);
  const osc = audio.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(accent ? 1500 : 1000, t);
  const gain = audio.createGain();
  gain.gain.setValueAtTime(accent ? 0.35 : 0.22, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t);
  osc.stop(t + 0.05);
}

/**
 * A simple look-ahead metronome. Call `start(bpm, beatsPerBar, onBeat)`; it
 * schedules clicks slightly ahead of time (standard technique for reliable
 * Web Audio timing) and calls onBeat(beatIndexInBar) on each tick.
 */
export class Metronome {
  private bpm: number;
  private beatsPerBar: number;
  private onBeat: (beatInBar: number, totalBeats: number) => void;
  private timer: number | null = null;
  private nextBeatTime = 0;
  private beatCount = 0;
  private readonly lookaheadMs = 25;
  private readonly scheduleAheadSec = 0.12;

  constructor(bpm: number, beatsPerBar: number, onBeat: (beatInBar: number, totalBeats: number) => void) {
    this.bpm = bpm;
    this.beatsPerBar = beatsPerBar;
    this.onBeat = onBeat;
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
  }

  start(): void {
    const audio = getCtx();
    this.nextBeatTime = audio.currentTime + 0.08;
    this.beatCount = 0;
    this.tick();
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick = (): void => {
    const audio = getCtx();
    while (this.nextBeatTime < audio.currentTime + this.scheduleAheadSec) {
      const beatInBar = this.beatCount % this.beatsPerBar;
      scheduleClick(this.nextBeatTime - audio.currentTime, beatInBar === 0);
      const delay = Math.max(0, (this.nextBeatTime - audio.currentTime) * 1000);
      const beatIdx = this.beatCount;
      setTimeout(() => this.onBeat(beatInBar, beatIdx), delay);
      this.nextBeatTime += 60 / this.bpm;
      this.beatCount++;
    }
    this.timer = window.setTimeout(this.tick, this.lookaheadMs);
  };
}
