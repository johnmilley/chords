import type { Song } from './types';
import favorites from './data/favorites.json';

// The user's Ultimate Guitar favorites with chords baked in (fetched and
// parsed from their favorites list). Order preserved. `createdAt` is assigned
// at runtime by index so the library keeps the original ordering.
interface FavRow {
  id: string;
  artist: string;
  title: string;
  key: string;
  capo: number;
  body: string;
  sourceUrl: string;
  tags: string[];
}

export function favoriteSeedSongs(now: number): Song[] {
  return (favorites as FavRow[]).map((f, i) => ({
    id: f.id,
    title: f.title,
    artist: f.artist,
    key: f.key,
    capo: f.capo,
    body: f.body,
    sourceUrl: f.sourceUrl,
    tags: f.tags,
    createdAt: now + i,
    updatedAt: now + i,
  }));
}
