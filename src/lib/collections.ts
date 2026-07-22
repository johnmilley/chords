import type { Song } from '../types';

// Downloadable song collections (Dylan, Cohen, etc.) live as static JSON in
// public/collections and are fetched on demand — not bundled — so the app stays
// small and each section only loads when you open it. Once fetched they're
// saved locally, so they work offline afterward.

export interface CollectionInfo {
  id: string;
  name: string;
  file: string;
  count: number;
}

const BASE = import.meta.env.BASE_URL;

export async function fetchManifest(): Promise<CollectionInfo[]> {
  try {
    const res = await fetch(`${BASE}collections/index.json`, { cache: 'no-cache' });
    if (!res.ok) return [];
    return (await res.json()) as CollectionInfo[];
  } catch {
    return [];
  }
}

export async function fetchCollection(info: CollectionInfo): Promise<Song[]> {
  const res = await fetch(`${BASE}collections/${info.file}`);
  if (!res.ok) throw new Error(`Couldn't load ${info.name} (${res.status})`);
  const rows = (await res.json()) as Partial<Song>[];
  const now = Date.now();
  return rows.map((r, i) => ({
    id: r.id ?? `${info.id}-${i}`,
    title: r.title ?? 'Untitled',
    artist: r.artist ?? '',
    key: r.key ?? '',
    capo: r.capo ?? 0,
    body: r.body ?? '',
    sourceUrl: r.sourceUrl,
    tags: r.tags ?? [],
    collection: r.collection ?? info.name,
    createdAt: now + i,
    updatedAt: now + i,
  }));
}
