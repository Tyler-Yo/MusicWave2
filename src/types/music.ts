/**
 * Core catalog model. Everything the UI renders about music flows through these types.
 */

export type ID = string;

/** A small color story used for generative artwork, page backgrounds and the Now Playing ambience. */
export interface Palette {
  /** Darkest / base color (hex). */
  base: string;
  /** Primary vivid color (hex). */
  a: string;
  /** Secondary vivid color (hex). */
  b: string;
  /** Highlight color (hex). */
  c: string;
}

/** Generative cover-art styles (see src/utils/art.ts). */
export type CoverStyle =
  | 'waves'
  | 'orbits'
  | 'horizon'
  | 'bloom'
  | 'stripes'
  | 'shards'
  | 'rings'
  | 'topo'
  | 'mesh'
  | 'pixels'
  | 'lanterns'
  | 'grid';

/**
 * Where a track's audio comes from.
 * - `synth`: an original composition rendered in the browser with the Web Audio API.
 * - `url`: any MP3/OGG/WAV/M4A URL (e.g. files you drop into /public/audio).
 * - `upload`: a file the listener imported; the blob lives in IndexedDB.
 */
export type AudioSource =
  | { kind: 'synth'; compositionId: ID }
  | { kind: 'url'; url: string }
  | { kind: 'upload'; blobKey: ID };

export interface Track {
  id: ID;
  title: string;
  artistId: ID;
  albumId: ID;
  trackNumber: number;
  /** Duration in seconds. For synth tracks this is computed exactly from the composition. */
  duration: number;
  genreId: ID;
  bpm?: number;
  key?: string;
  releaseDate: string;
  /** Simulated global play count, used by Top Charts. */
  plays: number;
  explicit?: boolean;
  source: AudioSource;
  /** Key into the lyrics registry. Absent means instrumental. */
  lyricsId?: ID;
  credits?: { writtenBy: string[]; producedBy: string[] };
  moods?: string[];
  /** Display overrides for imported files, which have no catalog artist/album. */
  artistName?: string;
  albumTitle?: string;
}

export interface Album {
  id: ID;
  title: string;
  artistId: ID;
  trackIds: ID[];
  releaseDate: string;
  genreId: ID;
  type: 'album' | 'ep' | 'single';
  palette: Palette;
  coverStyle: CoverStyle;
  description: string;
  label: string;
}

export interface Artist {
  id: ID;
  name: string;
  genreIds: ID[];
  bio: string;
  monthlyListeners: number;
  palette: Palette;
  verified?: boolean;
}

export interface Playlist {
  id: ID;
  title: string;
  description: string;
  trackIds: ID[];
  curator: string;
  palette: Palette;
  coverStyle: CoverStyle;
  /** True for playlists created by the listener (stored in localStorage). */
  isUser?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Genre {
  id: ID;
  name: string;
  tagline: string;
  palette: Palette;
  coverStyle: CoverStyle;
}

/** A track imported by the listener (metadata persisted in localStorage, blob in IndexedDB). */
export interface UploadedTrackMeta {
  id: ID;
  title: string;
  artist: string;
  duration: number;
  fileName: string;
  size: number;
  addedAt: string;
}

/** Where a play session originated — shown as "Playing from …". */
export interface PlayContext {
  type: 'album' | 'playlist' | 'artist' | 'genre' | 'library' | 'search' | 'chart' | 'mix' | 'queue';
  id?: ID;
  name: string;
  /** Route to navigate to when the listener clicks the context label. */
  href?: string;
}
