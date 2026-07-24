import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Settings, Song } from './types';
import { DEFAULT_SETTINGS } from './types';
import {
  loadSongs, saveSongs, loadSettings, saveSettings, loadSeedVersion, saveSeedVersion,
  loadMastery, saveMastery,
} from './lib/storage';
import { Library, DEFAULT_VIEW, type LibraryView } from './components/Library';
import { SongView } from './components/SongView';
import { ImportView } from './components/ImportView';
import { SongEdit } from './components/SongEdit';
import { SettingsView } from './components/SettingsView';
import { PracticeHub } from './components/PracticeHub';
import { ChordSwitchDrill } from './components/ChordSwitchDrill';
import { SectionLooper } from './components/SectionLooper';
import { ChordFlashcards } from './components/ChordFlashcards';
import { EarTraining } from './components/EarTraining';
import { SEED_SONGS } from './seed';
import { fetchManifest, fetchCollection, type CollectionInfo } from './lib/collections';
import { chordPool, recordPractice, type MasteryMap } from './lib/mastery';

// Bump when adding/updating seed songs so existing installs pick up changes once.
// v2: chords baked into the favorites (were link-only stubs in v1).
const SEED_VERSION = 2;

type Route =
  | { name: 'library' }
  | { name: 'song'; id: string }
  | { name: 'edit'; id: string }
  | { name: 'import' }
  | { name: 'settings' }
  | { name: 'practice' }
  | { name: 'practice-switch'; id: string }
  | { name: 'practice-loop'; id: string }
  | { name: 'flashcards' }
  | { name: 'ear' };

function routeToHash(r: Route): string {
  if (r.name === 'library') return '';
  if ('id' in r) return `#/${r.name}/${r.id}`;
  return `#/${r.name}`;
}

function hashToRoute(hash: string): Route {
  const m = hash.replace(/^#\/?/, '').split('/');
  const [name, id] = m;
  if ((name === 'song' || name === 'edit' || name === 'practice-switch' || name === 'practice-loop') && id) {
    return { name, id };
  }
  if (name === 'import' || name === 'settings' || name === 'practice' || name === 'flashcards' || name === 'ear') {
    return { name };
  }
  return { name: 'library' };
}

export function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [route, setRoute] = useState<Route>(() => hashToRoute(location.hash));
  const [ready, setReady] = useState(false);
  const [manifest, setManifest] = useState<CollectionInfo[]>([]);
  // Library browsing state, kept here so it survives leaving/returning to it.
  const [libView, setLibView] = useState<LibraryView>(DEFAULT_VIEW);
  const libScroll = useRef(0);
  const [mastery, setMastery] = useState<MasteryMap>({});
  const pool = useMemo(() => chordPool(songs), [songs]);

  const updateMastery = useCallback((next: MasteryMap) => {
    setMastery(next);
    saveMastery(next);
  }, []);

  const practiceRecorded = useCallback((symbols: string[]) => {
    setMastery((prev) => {
      const next = recordPractice(prev, symbols);
      saveMastery(next);
      return next;
    });
  }, []);

  // Load the list of downloadable collections (best-effort; offline-safe).
  useEffect(() => {
    fetchManifest().then(setManifest);
  }, []);

  const loadCollection = useCallback(async (info: CollectionInfo) => {
    const incoming = await fetchCollection(info);
    setSongs((prev) => {
      const have = new Set(prev.map((s) => s.id));
      const fresh = incoming.filter((s) => !have.has(s.id));
      if (!fresh.length) return prev;
      const next = [...prev, ...fresh];
      saveSongs(next);
      return next;
    });
  }, []);

  // Keep the URL hash in sync with the route so the mobile back button works.
  useEffect(() => {
    const target = routeToHash(route);
    if (location.hash !== target && !(target === '' && location.hash === '')) {
      history.pushState(null, '', target || location.pathname + location.search);
    }
  }, [route]);

  useEffect(() => {
    const onPop = () => setRoute(hashToRoute(location.hash));
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, []);

  // Initial load. Seeds on first run, and on later runs merges in any seed
  // songs added since the last seed version — without re-adding ones the user
  // deleted or overwriting their edits.
  useEffect(() => {
    (async () => {
      const [s, cfg, seedV, masteryMap] = await Promise.all([
        loadSongs(), loadSettings(), loadSeedVersion(), loadMastery(),
      ]);
      setMastery(masteryMap);
      let songs = s;
      if (seedV < SEED_VERSION) {
        const byId = new Map(songs.map((x) => [x.id, x]));
        let changed = false;
        for (const seed of SEED_SONGS) {
          const cur = byId.get(seed.id);
          if (!cur) {
            byId.set(seed.id, seed); // new seed song
            changed = true;
          } else if (!cur.body.trim() && seed.body.trim()) {
            // Backfill chords into an untouched stub, keeping user's key/capo/tags.
            byId.set(seed.id, {
              ...cur,
              body: seed.body,
              key: cur.key || seed.key,
              capo: cur.capo || seed.capo,
              updatedAt: Date.now(),
            });
            changed = true;
          }
        }
        if (changed) {
          songs = [...byId.values()];
          await saveSongs(songs);
        }
        await saveSeedVersion(SEED_VERSION);
      }
      setSongs(songs);
      setSettings(cfg);
      setReady(true);
    })();
  }, []);

  // Apply theme.
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = settings.theme === 'dark' ||
        (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.setAttribute('data-theme', dark ? 'dark' : 'light');
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? '#111317' : '#fbfbfa');
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings.theme]);

  // Persist settings whenever they change (after ready).
  useEffect(() => { if (ready) saveSettings(settings); }, [settings, ready]);

  const persistSongs = useCallback(async (next: Song[]) => {
    setSongs(next);
    await saveSongs(next);
  }, []);

  const upsertSong = useCallback((song: Song) => {
    setSongs((prev) => {
      const idx = prev.findIndex((s) => s.id === song.id);
      const next = idx >= 0 ? prev.map((s) => (s.id === song.id ? song : s)) : [...prev, song];
      saveSongs(next);
      return next;
    });
  }, []);

  const importSongs = useCallback((incoming: Song[]): number => {
    let added = 0;
    setSongs((prev) => {
      const byUrl = new Set(prev.map((s) => s.sourceUrl).filter(Boolean));
      const fresh = incoming.filter((s) => !s.sourceUrl || !byUrl.has(s.sourceUrl));
      added = fresh.length;
      if (fresh.length === 0) return prev;
      const next = [...prev, ...fresh];
      saveSongs(next);
      return next;
    });
    return added;
  }, []);

  const deleteSong = useCallback((id: string) => {
    setSongs((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveSongs(next);
      return next;
    });
    setRoute({ name: 'library' });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  if (!ready) return <div className="app" />;

  const current = 'id' in route ? songs.find((s) => s.id === route.id) : undefined;

  if (route.name === 'song' && current) {
    return (
      <SongView
        song={current}
        settings={settings}
        onBack={() => setRoute({ name: 'library' })}
        onEdit={() => setRoute({ name: 'edit', id: current.id })}
        onChange={upsertSong}
        onUpdateSettings={updateSettings}
        onPracticeSwitch={() => setRoute({ name: 'practice-switch', id: current.id })}
        onPracticeLoop={() => setRoute({ name: 'practice-loop', id: current.id })}
      />
    );
  }

  if (route.name === 'practice-switch' && current) {
    return (
      <ChordSwitchDrill
        song={current}
        instrument={settings.instrument}
        leftHanded={settings.leftHanded}
        onBack={() => setRoute({ name: 'song', id: current.id })}
        onDone={(symbols) => { practiceRecorded(symbols); setRoute({ name: 'song', id: current.id }); }}
      />
    );
  }

  if (route.name === 'practice-loop' && current) {
    return (
      <SectionLooper
        song={current}
        onBack={() => setRoute({ name: 'song', id: current.id })}
        onDone={(symbols) => { practiceRecorded(symbols); setRoute({ name: 'song', id: current.id }); }}
      />
    );
  }

  if (route.name === 'practice') {
    return (
      <PracticeHub
        songs={songs}
        mastery={mastery}
        settings={settings}
        onBack={() => setRoute({ name: 'library' })}
        onOpenSong={(id) => setRoute({ name: 'song', id })}
        onStartFlashcards={() => setRoute({ name: 'flashcards' })}
        onStartEar={() => setRoute({ name: 'ear' })}
      />
    );
  }

  if (route.name === 'flashcards') {
    return (
      <ChordFlashcards
        pool={pool}
        mastery={mastery}
        instrument={settings.instrument}
        leftHanded={settings.leftHanded}
        onMasteryChange={updateMastery}
        onBack={() => setRoute({ name: 'practice' })}
      />
    );
  }

  if (route.name === 'ear') {
    return (
      <EarTraining
        pool={pool}
        mastery={mastery}
        onMasteryChange={updateMastery}
        onBack={() => setRoute({ name: 'practice' })}
      />
    );
  }

  if (route.name === 'edit' && current) {
    return (
      <SongEdit
        song={current}
        onBack={() => setRoute({ name: 'song', id: current.id })}
        onSave={(s) => { upsertSong(s); setRoute({ name: 'song', id: s.id }); }}
        onDelete={deleteSong}
      />
    );
  }

  if (route.name === 'import') {
    return (
      <ImportView
        settings={settings}
        onBack={() => setRoute({ name: 'library' })}
        onSave={(s) => { upsertSong(s); setRoute({ name: 'song', id: s.id }); }}
        onImportMany={importSongs}
      />
    );
  }

  if (route.name === 'settings') {
    return (
      <SettingsView
        settings={settings}
        songCount={songs.length}
        onBack={() => setRoute({ name: 'library' })}
        onChange={updateSettings}
        onDataChanged={async () => persistSongs(await loadSongs())}
      />
    );
  }

  return (
    <Library
      songs={songs}
      manifest={manifest}
      onLoadCollection={loadCollection}
      onOpen={(id) => setRoute({ name: 'song', id })}
      onImport={() => setRoute({ name: 'import' })}
      onSettings={() => setRoute({ name: 'settings' })}
      onPractice={() => setRoute({ name: 'practice' })}
      view={libView}
      onView={setLibView}
      scrollPos={libScroll}
    />
  );
}
