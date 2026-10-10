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
  | { kind: 'upload'; blobKey: ID }
  | { kind: 'remote'; provider: RemoteProvider; variants: AudioVariant[] };

/** Online catalogs MusicWave can search and stream from. */
export type RemoteProvider = 'audius' | 'archive';

/** Where a track comes from (used for badges, attribution and filtering). */
export type TrackProvider = 'musicwave' | 'upload' | 'url' | RemoteProvider;

/**
 * Audio quality tiers, defined by what the file actually is:
 * - `high`: lossy (MP3 / Ogg / AAC)
 * - `lossless`: FLAC / WAV / AIFF / ALAC up to 48 kHz
 * - `hires`: lossless above 48 kHz (24-bit "Hi-Res Lossless")
 */
export type QualityTier = 'high' | 'lossless' | 'hires';

export type AudioFormat = 'mp3' | 'ogg' | 'aac' | 'flac' | 'wav' | 'aiff' | 'alac' | 'unknown';

/** One playable/downloadable rendition of a track. */
export interface AudioVariant {
  tier: QualityTier;
  url: string;
  format: AudioFormat;
  /** Lossy bitrate if known. */
  bitrateKbps?: number;
  /** Lossless specs — only set when known (from the file header or reliable metadata). */
  bitDepth?: number;
  sampleRate?: number;
  channels?: number;
  sizeBytes?: number;
  /** True when bit depth and sample rate were read from the file itself. */
  verified?: boolean;
  /** The source only says "24-bit"; the sample rate decides Lossless vs Hi-Res once inspected. */
  maybeHiRes?: boolean;
  /** Original uploads whose format must be confirmed before use (e.g. Audius originals). */
  needsInspection?: boolean;
}

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
  /** Display overrides for imported files and online tracks, which have no local artist/album. */
  artistName?: string;
  albumTitle?: string;
  /** Catalog the track belongs to (defaults to "musicwave" for the built-in demo tracks). */
  provider?: TrackProvider;
  /** Remote artwork (online catalogs). */
  artworkUrl?: string;
  /** Genre name as given by the source (online catalogs). */
  genreName?: string;
  /** Link to the track's page on its source, for attribution. */
  pageUrl?: string;
  /** License or rights statement reported by the source. */
  license?: string;
}

/** An album, playlist or recording from an online catalog. */
export interface RemoteCollection {
  id: ID;
  provider: RemoteProvider;
  kind: 'album' | 'playlist' | 'recording';
  title: string;
  artistName: string;
  artistId?: ID;
  artworkUrl?: string;
  description?: string;
  year?: string;
  trackCount?: number;
  /** Best quality any track in it offers (for badges). */
  bestTier?: QualityTier;
  /** The source lists 24-bit masters (Hi-Res is confirmed per file when played). */
  has24Bit?: boolean;
  pageUrl?: string;
}

/** An artist/user from an online catalog. */
export interface RemoteArtist {
  id: ID;
  provider: RemoteProvider;
  name: string;
  imageUrl?: string;
  bio?: string;
  followerCount?: number;
  trackCount?: number;
  verified?: boolean;
  pageUrl?: string;
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
