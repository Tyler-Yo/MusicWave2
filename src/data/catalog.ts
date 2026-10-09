/**
 * The MusicWave demo catalog. Every artist, album, track, playlist and genre
 * here is fictional and original. Audio is synthesized from the compositions in
 * ./compositions; artwork is generated from each palette (src/utils/art.ts).
 *
 * To add your own music, see README → "Replacing the demo tracks".
 */
import type { Album, Artist, Genre, Palette, Playlist, Track } from '@/types/music';
import { compositionDuration } from '@/audio/synth/arrangement';
import { COMPOSITIONS } from './compositions';

const P = (base: string, a: string, b: string, c: string): Palette => ({ base, a, b, c });

export const PALETTES = {
  lanterns: P('#1a1033', '#ff9e5e', '#ffd27a', '#7b5cff'),
  overclocked: P('#071a14', '#2ef2a0', '#00b3ff', '#e8ff5a'),
  golden: P('#2a0f1f', '#ffb347', '#ff5e7e', '#ffe29a'),
  nightDrive: P('#0c0626', '#ff3cac', '#784ba0', '#2b86c5'),
  harbor: P('#0b1d2a', '#f2c14e', '#4a90a4', '#e8e1d1'),
  moss: P('#1b1f16', '#a3c585', '#e6b89c', '#6b8f71'),
  tidal: P('#04121f', '#5ee7df', '#b490ca', '#d9f2ff'),
  bloom: P('#12001f', '#f72585', '#4cc9f0', '#b5179e'),
  pixel: P('#10101e', '#ff595e', '#ffca3a', '#8ac926'),
  meridian: P('#0d0d0d', '#c9a227', '#7a5c3e', '#e9e3d5'),
  blueHour: P('#0a1630', '#3a7bd5', '#f0a868', '#c2d4ff'),
  undercurrent: P('#001219', '#0a9396', '#94d2bd', '#ee9b00'),
  coast: P('#140a2e', '#00d2ff', '#ff7eb3', '#fdfc47'),
  kettle: P('#211a14', '#f4a259', '#bc4b51', '#f4e285'),
  aurora: P('#050a1a', '#7cffcb', '#74f2ce', '#c0b9dd'),
} as const;

// ---------------------------------------------------------------------------------------------
// Genres
// ---------------------------------------------------------------------------------------------

export const GENRES: Genre[] = [
  { id: 'pop', name: 'Pop', tagline: 'Hooks you will hum for days', palette: PALETTES.golden, coverStyle: 'bloom' },
  { id: 'hiphop', name: 'Hip-Hop', tagline: 'Boom-bap, bars and late-night flows', palette: PALETTES.overclocked, coverStyle: 'grid' },
  { id: 'synthwave', name: 'Synthwave', tagline: 'Neon, chrome and midnight highways', palette: PALETTES.nightDrive, coverStyle: 'horizon' },
  { id: 'folk', name: 'Folk & Acoustic', tagline: 'Wooden guitars and open roads', palette: PALETTES.harbor, coverStyle: 'topo' },
  { id: 'piano', name: 'Piano & Ballads', tagline: 'Slow songs for long evenings', palette: PALETTES.lanterns, coverStyle: 'lanterns' },
  { id: 'lofi', name: 'Lo-Fi Beats', tagline: 'Dusty keys to study and unwind', palette: PALETTES.moss, coverStyle: 'stripes' },
  { id: 'ambient', name: 'Ambient', tagline: 'Wide open space for your thoughts', palette: PALETTES.tidal, coverStyle: 'waves' },
  { id: 'electronic', name: 'Electronic', tagline: 'House, drum & bass and everything with a kick', palette: PALETTES.bloom, coverStyle: 'shards' },
  { id: 'chiptune', name: 'Chiptune', tagline: '8-bit hearts, 16-bit dreams', palette: PALETTES.pixel, coverStyle: 'pixels' },
  { id: 'cinematic', name: 'Cinematic', tagline: 'Scores for the film in your head', palette: PALETTES.meridian, coverStyle: 'rings' },
  { id: 'jazz', name: 'Jazz-Hop', tagline: 'Swing, smoke and blue notes', palette: PALETTES.blueHour, coverStyle: 'orbits' },
];

// ---------------------------------------------------------------------------------------------
// Artists
// ---------------------------------------------------------------------------------------------

export const ARTISTS: Artist[] = [
  {
    id: 'lumen-vale',
    name: 'Lumen Vale',
    genreIds: ['piano', 'pop'],
    bio: 'Lumen Vale writes slow-burning piano songs about rivers, cities and the people who light them up. Recorded mostly after midnight, with the windows open.',
    monthlyListeners: 1_840_000,
    palette: PALETTES.lanterns,
    verified: true,
  },
  {
    id: 'kassi-orbit',
    name: 'Kassi Orbit',
    genreIds: ['hiphop'],
    bio: 'Producer-rapper Kassi Orbit builds dusty boom-bap out of laptop fans and late-night thoughts. Fast flows, warm keys, and a soft spot for semicolons.',
    monthlyListeners: 2_310_000,
    palette: PALETTES.overclocked,
    verified: true,
  },
  {
    id: 'paper-comets',
    name: 'The Paper Comets',
    genreIds: ['pop'],
    bio: 'A four-piece from a coastal town nobody can find on a map, The Paper Comets make windows-down pop for the last hour of daylight.',
    monthlyListeners: 3_120_000,
    palette: PALETTES.golden,
    verified: true,
  },
  {
    id: 'neon-cartographer',
    name: 'Neon Cartographer',
    genreIds: ['synthwave'],
    bio: 'Neon Cartographer maps imaginary cities with analog-style synths, gated drums and a chrome-plated sense of nostalgia.',
    monthlyListeners: 1_270_000,
    palette: PALETTES.nightDrive,
    verified: true,
  },
  {
    id: 'wren-lowlands',
    name: 'Wren & the Lowlands',
    genreIds: ['folk'],
    bio: 'Fingerpicked guitars, stomps and harmonies about boats, fathers and the lights we leave on for each other.',
    monthlyListeners: 960_000,
    palette: PALETTES.harbor,
  },
  {
    id: 'mossgarden',
    name: 'Mossgarden',
    genreIds: ['lofi'],
    bio: 'Mossgarden is a one-person tea-fuelled beat lab. Rain on the window optional, but recommended.',
    monthlyListeners: 4_050_000,
    palette: PALETTES.moss,
    verified: true,
  },
  {
    id: 'halcyon-drift',
    name: 'Halcyon Drift',
    genreIds: ['ambient'],
    bio: 'Long tones, slow tides and glassy bells. Halcyon Drift makes music that is happy to sit quietly in the corner of the room.',
    monthlyListeners: 780_000,
    palette: PALETTES.tidal,
  },
  {
    id: 'voltage-choir',
    name: 'Voltage Choir',
    genreIds: ['electronic'],
    bio: 'Warehouse-ready house music with pumping pads, organ stabs and a kick drum you can feel in your shoelaces.',
    monthlyListeners: 1_530_000,
    palette: PALETTES.bloom,
  },
  {
    id: 'pixel-saints',
    name: 'Pixel Saints',
    genreIds: ['chiptune'],
    bio: 'Square waves with feelings. Pixel Saints write boss-battle anthems for games that do not exist yet.',
    monthlyListeners: 640_000,
    palette: PALETTES.pixel,
  },
  {
    id: 'atlas-meridian',
    name: 'Atlas Meridian',
    genreIds: ['cinematic'],
    bio: 'Composer Atlas Meridian scores imaginary films: wide strings, distant drums and a piano that remembers everything.',
    monthlyListeners: 1_120_000,
    palette: PALETTES.meridian,
    verified: true,
  },
  {
    id: 'blue-hour-quartet',
    name: 'Blue Hour Quartet',
    genreIds: ['jazz', 'lofi'],
    bio: 'Swinging drums, round bass and Rhodes chords — a quartet that sounds best between sunset and the first streetlight.',
    monthlyListeners: 870_000,
    palette: PALETTES.blueHour,
  },
  {
    id: 'subtera',
    name: 'Subtera',
    genreIds: ['electronic'],
    bio: 'Subtera makes deep, rolling drum & bass from the bottom of the ocean upwards.',
    monthlyListeners: 1_010_000,
    palette: PALETTES.undercurrent,
  },
];

// ---------------------------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------------------------

interface TrackSeed {
  id: string;
  title: string;
  artistId: string;
  albumId: string;
  trackNumber: number;
  genreId: string;
  releaseDate: string;
  plays: number;
  lyrics?: boolean;
  writtenBy: string[];
  producedBy: string[];
  moods: string[];
}

function synthTrack(seed: TrackSeed): Track {
  const comp = COMPOSITIONS[seed.id];
  if (!comp) throw new Error(`Missing composition ${seed.id}`);
  return {
    id: seed.id,
    title: seed.title,
    artistId: seed.artistId,
    albumId: seed.albumId,
    trackNumber: seed.trackNumber,
    duration: compositionDuration(comp),
    genreId: seed.genreId,
    bpm: comp.bpm,
    key: `${comp.key} ${comp.mode}`,
    releaseDate: seed.releaseDate,
    plays: seed.plays,
    source: { kind: 'synth', compositionId: comp.id },
    lyricsId: seed.lyrics ? comp.id : undefined,
    credits: { writtenBy: seed.writtenBy, producedBy: seed.producedBy },
    moods: seed.moods,
  };
}

export const TRACKS: Track[] = [
  synthTrack({
    id: 'paper-lanterns',
    title: 'Paper Lanterns',
    artistId: 'lumen-vale',
    albumId: 'lanterns',
    trackNumber: 1,
    genreId: 'piano',
    releaseDate: '2026-09-26',
    plays: 48_200_000,
    lyrics: true,
    writtenBy: ['L. Vale'],
    producedBy: ['L. Vale', 'M. Okonkwo'],
    moods: ['tender', 'hopeful', 'slow'],
  }),
  synthTrack({
    id: 'lantern-reprise',
    title: 'Lantern Reprise (Piano)',
    artistId: 'lumen-vale',
    albumId: 'lanterns',
    trackNumber: 2,
    genreId: 'piano',
    releaseDate: '2026-09-26',
    plays: 9_400_000,
    writtenBy: ['L. Vale'],
    producedBy: ['L. Vale'],
    moods: ['calm', 'reflective'],
  }),
  synthTrack({
    id: 'overclocked',
    title: 'Overclocked',
    artistId: 'kassi-orbit',
    albumId: 'overclocked-single',
    trackNumber: 1,
    genreId: 'hiphop',
    releaseDate: '2026-10-03',
    plays: 61_700_000,
    lyrics: true,
    writtenBy: ['K. Orbit'],
    producedBy: ['K. Orbit'],
    moods: ['driven', 'late night', 'fast'],
  }),
  synthTrack({
    id: 'golden-hour-radio',
    title: 'Golden Hour Radio',
    artistId: 'paper-comets',
    albumId: 'golden-hour',
    trackNumber: 1,
    genreId: 'pop',
    releaseDate: '2026-08-15',
    plays: 93_500_000,
    lyrics: true,
    writtenBy: ['J. Amari', 'S. Lindqvist', 'T. Rowe'],
    producedBy: ['The Paper Comets'],
    moods: ['euphoric', 'summer', 'feel-good'],
  }),
  synthTrack({
    id: 'night-drive-protocol',
    title: 'Night Drive Protocol',
    artistId: 'neon-cartographer',
    albumId: 'night-drive',
    trackNumber: 1,
    genreId: 'synthwave',
    releaseDate: '2026-06-20',
    plays: 37_800_000,
    lyrics: true,
    writtenBy: ['N. Cartographer'],
    producedBy: ['N. Cartographer'],
    moods: ['nostalgic', 'driving', 'neon'],
  }),
  synthTrack({
    id: 'coastline-arcade',
    title: 'Coastline Arcade',
    artistId: 'neon-cartographer',
    albumId: 'night-drive',
    trackNumber: 2,
    genreId: 'synthwave',
    releaseDate: '2026-06-20',
    plays: 14_100_000,
    writtenBy: ['N. Cartographer'],
    producedBy: ['N. Cartographer'],
    moods: ['bright', 'retro'],
  }),
  synthTrack({
    id: 'harbor-lights',
    title: 'Harbor Lights',
    artistId: 'wren-lowlands',
    albumId: 'harbor-lights-single',
    trackNumber: 1,
    genreId: 'folk',
    releaseDate: '2026-09-12',
    plays: 22_900_000,
    lyrics: true,
    writtenBy: ['W. Ashdown'],
    producedBy: ['W. Ashdown', 'R. Calloway'],
    moods: ['warm', 'nostalgic', 'acoustic'],
  }),
  synthTrack({
    id: 'rainy-window-study',
    title: 'Rainy Window Study',
    artistId: 'mossgarden',
    albumId: 'tea-and-static',
    trackNumber: 1,
    genreId: 'lofi',
    releaseDate: '2025-11-02',
    plays: 120_300_000,
    writtenBy: ['Mossgarden'],
    producedBy: ['Mossgarden'],
    moods: ['focus', 'cozy', 'rain'],
  }),
  synthTrack({
    id: 'morning-kettle',
    title: 'Morning Kettle',
    artistId: 'mossgarden',
    albumId: 'tea-and-static',
    trackNumber: 2,
    genreId: 'lofi',
    releaseDate: '2025-11-02',
    plays: 76_400_000,
    writtenBy: ['Mossgarden'],
    producedBy: ['Mossgarden'],
    moods: ['morning', 'cozy'],
  }),
  synthTrack({
    id: 'tidal-memory',
    title: 'Tidal Memory',
    artistId: 'halcyon-drift',
    albumId: 'tidal-memory-ep',
    trackNumber: 1,
    genreId: 'ambient',
    releaseDate: '2026-02-14',
    plays: 18_600_000,
    writtenBy: ['Halcyon Drift'],
    producedBy: ['Halcyon Drift'],
    moods: ['calm', 'sleep', 'spacious'],
  }),
  synthTrack({
    id: 'glass-aurora',
    title: 'Glass Aurora',
    artistId: 'halcyon-drift',
    albumId: 'tidal-memory-ep',
    trackNumber: 2,
    genreId: 'ambient',
    releaseDate: '2026-02-14',
    plays: 11_200_000,
    writtenBy: ['Halcyon Drift'],
    producedBy: ['Halcyon Drift'],
    moods: ['calm', 'shimmering'],
  }),
  synthTrack({
    id: 'static-bloom',
    title: 'Static Bloom',
    artistId: 'voltage-choir',
    albumId: 'static-bloom-single',
    trackNumber: 1,
    genreId: 'electronic',
    releaseDate: '2026-09-30',
    plays: 29_800_000,
    writtenBy: ['Voltage Choir'],
    producedBy: ['Voltage Choir'],
    moods: ['dance', 'energetic'],
  }),
  synthTrack({
    id: 'cartridge-hearts',
    title: 'Cartridge Hearts',
    artistId: 'pixel-saints',
    albumId: 'continue',
    trackNumber: 1,
    genreId: 'chiptune',
    releaseDate: '2026-04-01',
    plays: 8_700_000,
    writtenBy: ['Pixel Saints'],
    producedBy: ['Pixel Saints'],
    moods: ['playful', 'energetic', 'retro'],
  }),
  synthTrack({
    id: 'the-long-meridian',
    title: 'The Long Meridian',
    artistId: 'atlas-meridian',
    albumId: 'long-meridian',
    trackNumber: 1,
    genreId: 'cinematic',
    releaseDate: '2026-01-23',
    plays: 15_300_000,
    writtenBy: ['A. Meridian'],
    producedBy: ['A. Meridian'],
    moods: ['epic', 'emotional'],
  }),
  synthTrack({
    id: 'blue-hour-walk',
    title: 'Blue Hour Walk',
    artistId: 'blue-hour-quartet',
    albumId: 'blue-hour',
    trackNumber: 1,
    genreId: 'jazz',
    releaseDate: '2025-12-05',
    plays: 21_400_000,
    writtenBy: ['Blue Hour Quartet'],
    producedBy: ['Blue Hour Quartet'],
    moods: ['smooth', 'evening', 'swing'],
  }),
  synthTrack({
    id: 'undercurrent',
    title: 'Undercurrent',
    artistId: 'subtera',
    albumId: 'undercurrent-single',
    trackNumber: 1,
    genreId: 'electronic',
    releaseDate: '2026-07-11',
    plays: 25_100_000,
    writtenBy: ['Subtera'],
    producedBy: ['Subtera'],
    moods: ['dark', 'driving', 'workout'],
  }),
];

// ---------------------------------------------------------------------------------------------
// Albums
// ---------------------------------------------------------------------------------------------

export const ALBUMS: Album[] = [
  {
    id: 'lanterns',
    title: 'Lanterns',
    artistId: 'lumen-vale',
    trackIds: ['paper-lanterns', 'lantern-reprise'],
    releaseDate: '2026-09-26',
    genreId: 'piano',
    type: 'ep',
    palette: PALETTES.lanterns,
    coverStyle: 'lanterns',
    description: 'Two songs about the small lights we send out into the dark — one sung, one remembered on piano.',
    label: 'Riverlight Records',
  },
  {
    id: 'overclocked-single',
    title: 'Overclocked',
    artistId: 'kassi-orbit',
    trackIds: ['overclocked'],
    releaseDate: '2026-10-03',
    genreId: 'hiphop',
    type: 'single',
    palette: PALETTES.overclocked,
    coverStyle: 'grid',
    description: 'Three verses, one hook, and a reminder to step away from the keyboard.',
    label: 'Orbit Works',
  },
  {
    id: 'golden-hour',
    title: 'Golden Hour Radio',
    artistId: 'paper-comets',
    trackIds: ['golden-hour-radio'],
    releaseDate: '2026-08-15',
    genreId: 'pop',
    type: 'single',
    palette: PALETTES.golden,
    coverStyle: 'bloom',
    description: 'The summer single: windows down, volume up, sing every chorus.',
    label: 'Comet Tail',
  },
  {
    id: 'night-drive',
    title: 'Night Drive Protocol',
    artistId: 'neon-cartographer',
    trackIds: ['night-drive-protocol', 'coastline-arcade'],
    releaseDate: '2026-06-20',
    genreId: 'synthwave',
    type: 'ep',
    palette: PALETTES.nightDrive,
    coverStyle: 'horizon',
    description: 'A two-part drive through a city that only exists after midnight.',
    label: 'Chrome Atlas',
  },
  {
    id: 'harbor-lights-single',
    title: 'Harbor Lights',
    artistId: 'wren-lowlands',
    trackIds: ['harbor-lights'],
    releaseDate: '2026-09-12',
    genreId: 'folk',
    type: 'single',
    palette: PALETTES.harbor,
    coverStyle: 'topo',
    description: 'A song passed from father to child, like the boat in its verses.',
    label: 'Lowland Folk Co.',
  },
  {
    id: 'tea-and-static',
    title: 'Tea & Static',
    artistId: 'mossgarden',
    trackIds: ['rainy-window-study', 'morning-kettle'],
    releaseDate: '2025-11-02',
    genreId: 'lofi',
    type: 'ep',
    palette: PALETTES.moss,
    coverStyle: 'stripes',
    description: 'Beats for the hours between the kettle and the rain.',
    label: 'Mossgarden',
  },
  {
    id: 'tidal-memory-ep',
    title: 'Tidal Memory',
    artistId: 'halcyon-drift',
    trackIds: ['tidal-memory', 'glass-aurora'],
    releaseDate: '2026-02-14',
    genreId: 'ambient',
    type: 'ep',
    palette: PALETTES.tidal,
    coverStyle: 'waves',
    description: 'Slow-moving ambient pieces built from glass, water and light.',
    label: 'Stillwater',
  },
  {
    id: 'static-bloom-single',
    title: 'Static Bloom',
    artistId: 'voltage-choir',
    trackIds: ['static-bloom'],
    releaseDate: '2026-09-30',
    genreId: 'electronic',
    type: 'single',
    palette: PALETTES.bloom,
    coverStyle: 'shards',
    description: 'Peak-time house with a pumping heart.',
    label: 'Voltage',
  },
  {
    id: 'continue',
    title: 'Continue?',
    artistId: 'pixel-saints',
    trackIds: ['cartridge-hearts'],
    releaseDate: '2026-04-01',
    genreId: 'chiptune',
    type: 'single',
    palette: PALETTES.pixel,
    coverStyle: 'pixels',
    description: 'Insert coin. Press start. Feel things.',
    label: '8-Bit Chapel',
  },
  {
    id: 'long-meridian',
    title: 'The Long Meridian',
    artistId: 'atlas-meridian',
    trackIds: ['the-long-meridian'],
    releaseDate: '2026-01-23',
    genreId: 'cinematic',
    type: 'single',
    palette: PALETTES.meridian,
    coverStyle: 'rings',
    description: 'A main title for a film about crossing an ocean.',
    label: 'Meridian Scores',
  },
  {
    id: 'blue-hour',
    title: 'Blue Hour',
    artistId: 'blue-hour-quartet',
    trackIds: ['blue-hour-walk'],
    releaseDate: '2025-12-05',
    genreId: 'jazz',
    type: 'single',
    palette: PALETTES.blueHour,
    coverStyle: 'orbits',
    description: 'A walking tempo for the bluest part of the evening.',
    label: 'Indigo Room',
  },
  {
    id: 'undercurrent-single',
    title: 'Undercurrent',
    artistId: 'subtera',
    trackIds: ['undercurrent'],
    releaseDate: '2026-07-11',
    genreId: 'electronic',
    type: 'single',
    palette: PALETTES.undercurrent,
    coverStyle: 'waves',
    description: 'Rolling drum & bass from the deep end.',
    label: 'Deepwater Audio',
  },
];

// ---------------------------------------------------------------------------------------------
// Editorial playlists
// ---------------------------------------------------------------------------------------------

const editorial = (p: Omit<Playlist, 'curator' | 'createdAt' | 'updatedAt'>): Playlist => ({
  ...p,
  curator: 'MusicWave',
  createdAt: '2026-01-01',
  updatedAt: '2026-10-06',
});

export const PLAYLISTS: Playlist[] = [
  editorial({
    id: 'lyrics-lab',
    title: 'Lyrics Lab',
    description: 'Every song here has word-by-word synchronized lyrics. Open the lyrics view and sing along.',
    trackIds: ['paper-lanterns', 'overclocked', 'golden-hour-radio', 'night-drive-protocol', 'harbor-lights'],
    palette: PALETTES.coast,
    coverStyle: 'mesh',
  }),
  editorial({
    id: 'karaoke-night',
    title: 'Karaoke Night',
    description: 'From the slow opener to the rap verse nobody can keep up with. Karaoke mode recommended.',
    trackIds: ['golden-hour-radio', 'harbor-lights', 'night-drive-protocol', 'overclocked', 'paper-lanterns'],
    palette: PALETTES.golden,
    coverStyle: 'rings',
  }),
  editorial({
    id: 'focus-flow',
    title: 'Focus Flow',
    description: 'Lo-fi, jazz-hop and ambient textures that stay out of your way.',
    trackIds: ['rainy-window-study', 'blue-hour-walk', 'tidal-memory', 'morning-kettle', 'glass-aurora', 'lantern-reprise'],
    palette: PALETTES.moss,
    coverStyle: 'topo',
  }),
  editorial({
    id: 'night-drive-mix',
    title: 'After Midnight',
    description: 'Synthwave, drum & bass and house for empty highways.',
    trackIds: ['night-drive-protocol', 'undercurrent', 'coastline-arcade', 'static-bloom', 'overclocked'],
    palette: PALETTES.nightDrive,
    coverStyle: 'horizon',
  }),
  editorial({
    id: 'energy-boost',
    title: 'Energy Boost',
    description: 'High tempo, high spirits. Workout-ready.',
    trackIds: ['static-bloom', 'undercurrent', 'cartridge-hearts', 'golden-hour-radio', 'overclocked'],
    palette: PALETTES.bloom,
    coverStyle: 'shards',
  }),
  editorial({
    id: 'sunday-slow',
    title: 'Sunday Slow',
    description: 'Piano, folk and wide-open ambience for a slow morning.',
    trackIds: ['paper-lanterns', 'harbor-lights', 'lantern-reprise', 'tidal-memory', 'the-long-meridian'],
    palette: PALETTES.harbor,
    coverStyle: 'lanterns',
  }),
  editorial({
    id: 'pixel-and-neon',
    title: 'Pixel & Neon',
    description: 'Square waves meet saw waves: chiptune and synthwave side by side.',
    trackIds: ['cartridge-hearts', 'coastline-arcade', 'night-drive-protocol', 'static-bloom'],
    palette: PALETTES.pixel,
    coverStyle: 'pixels',
  }),
  editorial({
    id: 'cinema-of-sound',
    title: 'Cinema of Sound',
    description: 'Big, emotional instrumentals with room to breathe.',
    trackIds: ['the-long-meridian', 'glass-aurora', 'lantern-reprise', 'tidal-memory', 'coastline-arcade'],
    palette: PALETTES.meridian,
    coverStyle: 'orbits',
  }),
];

// ---------------------------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------------------------

const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((i) => [i.id, i]));

export const TRACK_MAP = byId(TRACKS);
export const ALBUM_MAP = byId(ALBUMS);
export const ARTIST_MAP = byId(ARTISTS);
export const PLAYLIST_MAP = byId(PLAYLISTS);
export const GENRE_MAP = byId(GENRES);
