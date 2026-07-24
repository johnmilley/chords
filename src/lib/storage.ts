import { get, set, del } from 'idb-keyval';
import type { Song, Setlist, Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import type { MasteryMap } from './mastery';

const SONGS_KEY = 'chords:songs';
const SETLISTS_KEY = 'chords:setlists';
const SETTINGS_KEY = 'chords:settings';
const SEED_VERSION_KEY = 'chords:seedVersion';
const MASTERY_KEY = 'chords:mastery';

export async function loadMastery(): Promise<MasteryMap> {
  return (await get<MasteryMap>(MASTERY_KEY)) ?? {};
}
export async function saveMastery(mastery: MasteryMap): Promise<void> {
  await set(MASTERY_KEY, mastery);
}

export async function loadSeedVersion(): Promise<number> {
  return (await get<number>(SEED_VERSION_KEY)) ?? 0;
}
export async function saveSeedVersion(v: number): Promise<void> {
  await set(SEED_VERSION_KEY, v);
}

export async function loadSongs(): Promise<Song[]> {
  return (await get<Song[]>(SONGS_KEY)) ?? [];
}
export async function saveSongs(songs: Song[]): Promise<void> {
  await set(SONGS_KEY, songs);
}

export async function loadSetlists(): Promise<Setlist[]> {
  return (await get<Setlist[]>(SETLISTS_KEY)) ?? [];
}
export async function saveSetlists(setlists: Setlist[]): Promise<void> {
  await set(SETLISTS_KEY, setlists);
}

export async function loadSettings(): Promise<Settings> {
  const s = await get<Partial<Settings>>(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}
export async function saveSettings(settings: Settings): Promise<void> {
  await set(SETTINGS_KEY, settings);
}

export async function clearAll(): Promise<void> {
  await Promise.all([del(SONGS_KEY), del(SETLISTS_KEY)]);
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- Backup / restore ----------------------------------------------------

export interface Backup {
  version: 1;
  exportedAt: number;
  songs: Song[];
  setlists: Setlist[];
  settings: Settings;
  /** Optional: added later, so older backup files still validate without it. */
  mastery?: MasteryMap;
}

export async function exportBackup(): Promise<Backup> {
  const [songs, setlists, settings, mastery] = await Promise.all([
    loadSongs(),
    loadSetlists(),
    loadSettings(),
    loadMastery(),
  ]);
  return { version: 1, exportedAt: Date.now(), songs, setlists, settings, mastery };
}

export async function importBackup(data: Backup, mode: 'merge' | 'replace'): Promise<void> {
  if (!data || data.version !== 1) throw new Error('Unrecognized backup file.');
  if (mode === 'replace') {
    await saveSongs(data.songs ?? []);
    await saveSetlists(data.setlists ?? []);
    if (data.settings) await saveSettings(data.settings);
    if (data.mastery) await saveMastery(data.mastery);
    return;
  }
  const [songs, setlists, mastery] = await Promise.all([loadSongs(), loadSetlists(), loadMastery()]);
  const byId = new Map(songs.map((s) => [s.id, s]));
  for (const s of data.songs ?? []) byId.set(s.id, s);
  const slById = new Map(setlists.map((s) => [s.id, s]));
  for (const s of data.setlists ?? []) slById.set(s.id, s);
  await saveSongs([...byId.values()]);
  await saveSetlists([...slById.values()]);
  if (data.mastery) {
    // Merge by taking the higher level per chord (don't regress progress).
    const merged = { ...mastery };
    for (const [k, v] of Object.entries(data.mastery)) {
      merged[k] = !merged[k] || v.level > merged[k].level ? v : merged[k];
    }
    await saveMastery(merged);
  }
}
