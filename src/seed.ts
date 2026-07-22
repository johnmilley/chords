import type { Song } from './types';
import { favoriteSeedSongs } from './seed-favorites';

// Public-domain songs so the app isn't empty on first run and shows off the
// reader, transpose, capo, and chord diagrams. Delete these anytime.
const now = Date.now();

function song(s: Omit<Song, 'createdAt' | 'updatedAt' | 'tags'> & { tags?: string[] }): Song {
  return { tags: ['sample'], createdAt: now, updatedAt: now, ...s };
}

const DEMO_SONGS: Song[] = [
  song({
    id: 'seed-house',
    title: 'House of the Rising Sun',
    artist: 'Traditional',
    key: 'Am',
    capo: 0,
    body: `{comment: Verse}
There [Am]is a [C]house in [D]New Or-[F]leans
They [Am]call the [C]Rising [E]Sun [E7]
And it's [Am]been the [C]ruin of [D]many a poor [F]boy
And [Am]God I [E]know I'm [Am]one [C][E7]

{comment: Verse}
My [Am]mother [C]was a [D]tailor [F]
She [Am]sewed my [C]new blue [E]jeans [E7]
My [Am]father [C]was a [D]gamblin' [F]man
[Am]Down in [E]New Or-[Am]leans [C][E7]
`,
  }),
  song({
    id: 'seed-amazing',
    title: 'Amazing Grace',
    artist: 'Traditional',
    key: 'G',
    capo: 0,
    body: `{comment: Verse 1}
A-[G]mazing [G7]grace, how [C]sweet the [G]sound
That [G]saved a wretch like [D]me [D7]
I [G]once [G7]was lost, but [C]now am [G]found
Was [G]blind, but [D]now I [G]see

{comment: Verse 2}
'Twas [G]grace that [G7]taught my [C]heart to [G]fear
And [G]grace my fears re-[D]lieved [D7]
How [G]precious [G7]did that [C]grace ap-[G]pear
The [G]hour I [D]first be-[G]lieved
`,
  }),
  song({
    id: 'seed-jingle',
    title: 'Jingle Bells',
    artist: 'Traditional',
    key: 'C',
    capo: 0,
    body: `{comment: Chorus}
[C]Jingle bells, jingle bells, jingle [F]all the [C]way
[F]Oh what [C]fun it [D]is to ride in a [G]one-horse open [C]sleigh, hey
[C]Jingle bells, jingle bells, jingle [F]all the [C]way
[F]Oh what [C]fun it [G]is to ride in a [C]one-horse [G]open [C]sleigh
`,
  }),
];

// The three public-domain samples above (with chords, so the reader works out
// of the box) plus the user's imported Ultimate Guitar favorites as link-only
// stubs. Open a favorite to fetch or paste its chords.
export const SEED_SONGS: Song[] = [...DEMO_SONGS, ...favoriteSeedSongs(now)];
