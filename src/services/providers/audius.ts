/**
 * Audius (https://audius.co) — an artist-owned streaming network with a free public
 * API. Full tracks stream as MP3; when an artist uploads a lossless original and
 * allows downloads, the original (WAV / FLAC / AIFF) is offered as a Lossless or
 * Hi-Res variant after its header is inspected.
 *
 * Field names follow the official @audius/sdk OpenAPI models (snake_case on the wire).
 */
import type { AudioVariant, RemoteArtist, RemoteCollection, Track } from '@/types/music';
import { formatFromName, isLossless } from '../quality';
import { fetchJSON, qs } from './http';

export const AUDIUS_API = 'https://api.audius.co/v1';
export const AUDIUS_APP_NAME = 'MusicWave';

/** Optional API key (Settings). Requests work with just the app name, at a lower rate limit. */
let apiKey = '';
export function setAudiusApiKey(key: string): void {
  apiKey = key.trim();
}

type Artwork = Partial<Record<'150x150' | '480x480' | '1000x1000', string>> & { mirrors?: string[] };

export interface AudiusUserJSON {
  id: string;
  name: string;
  handle: string;
  bio?: string;
  is_verified?: boolean;
  follower_count?: number;
  track_count?: number;
  profile_picture?: Artwork | null;
}

export interface AudiusTrackJSON {
  id: string;
  title: string;
  duration: number;
  genre?: string;
  mood?: string;
  description?: string;
  release_date?: string;
  created_at?: string;
  play_count?: number;
  favorite_count?: number;
  permalink?: string;
  artwork?: Artwork | null;
  user: AudiusUserJSON;
  is_streamable?: boolean;
  is_downloadable?: boolean;
  is_original_available?: boolean;
  orig_filename?: string;
  orig_file_cid?: string;
  license?: string;
  access?: { stream?: boolean; download?: boolean };
  album_backlink?: { playlist_id: number | string; playlist_name: string; permalink: string } | null;
}

export interface AudiusPlaylistJSON {
  id: string;
  playlist_name: string;
  description?: string;
  is_album?: boolean;
  permalink?: string;
  artwork?: Artwork | null;
  track_count?: number;
  total_play_count?: number;
  user: AudiusUserJSON;
  release_date?: string;
  created_at?: string;
}

function art(a: Artwork | null | undefined, size: '150x150' | '480x480' | '1000x1000' = '480x480'): string | undefined {
  if (!a) return undefined;
  return a[size] ?? a['480x480'] ?? a['1000x1000'] ?? a['150x150'];
}

function url(path: string, params: Record<string, string | number | boolean | undefined> = {}): string {
  return `${AUDIUS_API}${path}?${qs({ ...params, app_name: AUDIUS_APP_NAME, api_key: apiKey || undefined })}`;
}

export const audiusStreamUrl = (id: string) => url(`/tracks/${encodeURIComponent(id)}/stream`);
export const audiusDownloadUrl = (id: string) => url(`/tracks/${encodeURIComponent(id)}/download`);
export const audiusInspectUrl = (id: string) => url(`/tracks/${encodeURIComponent(id)}/inspect`, { original: true });

export const audiusTrackId = (id: string) => `audius:${id}`;
export const audiusUserId = (id: string) => `audius-user:${id}`;
export const audiusPlaylistId = (id: string | number) => `audius-playlist:${id}`;
export const rawId = (id: string) => id.slice(id.indexOf(':') + 1);

/** True if the track can be streamed by anyone (not gated / deleted / unlisted). */
export function isPlayable(t: AudiusTrackJSON): boolean {
  if (t.is_streamable === false) return false;
  if (t.access && t.access.stream === false) return false;
  return Boolean(t.id && t.user);
}

export function mapAudiusTrack(t: AudiusTrackJSON): Track {
  const variants: AudioVariant[] = [{ tier: 'high', url: audiusStreamUrl(t.id), format: 'mp3' }];
  const origFormat = t.orig_filename ? formatFromName(t.orig_filename) : 'unknown';
  const canDownload = t.is_downloadable && (!t.access || t.access.download !== false);
  if (canDownload && t.is_original_available && isLossless(origFormat)) {
    variants.push({ tier: 'lossless', url: audiusDownloadUrl(t.id), format: origFormat, needsInspection: true, maybeHiRes: true });
  }
  const album = t.album_backlink ?? undefined;
  return {
    id: audiusTrackId(t.id),
    title: t.title,
    artistId: audiusUserId(t.user.id),
    artistName: t.user.name,
    albumId: album ? audiusPlaylistId(album.playlist_id) : '',
    albumTitle: album?.playlist_name ?? 'Single',
    trackNumber: 0,
    duration: t.duration ?? 0,
    genreId: 'remote',
    genreName: t.genre || undefined,
    releaseDate: (t.release_date ?? t.created_at ?? '').slice(0, 10),
    plays: t.play_count ?? 0,
    source: { kind: 'remote', provider: 'audius', variants },
    provider: 'audius',
    artworkUrl: art(t.artwork),
    pageUrl: t.permalink ? `https://audius.co${t.permalink}` : undefined,
    license: t.license || undefined,
    moods: t.mood ? [t.mood] : undefined,
  };
}

export function mapAudiusUser(u: AudiusUserJSON): RemoteArtist {
  return {
    id: audiusUserId(u.id),
    provider: 'audius',
    name: u.name,
    imageUrl: art(u.profile_picture),
    bio: u.bio,
    followerCount: u.follower_count,
    trackCount: u.track_count,
    verified: u.is_verified,
    pageUrl: `https://audius.co/${u.handle}`,
  };
}

export function mapAudiusPlaylist(p: AudiusPlaylistJSON): RemoteCollection {
  return {
    id: audiusPlaylistId(p.id),
    provider: 'audius',
    kind: p.is_album ? 'album' : 'playlist',
    title: p.playlist_name,
    artistName: p.user?.name ?? 'Audius',
    artistId: p.user ? audiusUserId(p.user.id) : undefined,
    artworkUrl: art(p.artwork),
    description: p.description,
    year: (p.release_date ?? p.created_at ?? '').slice(0, 4) || undefined,
    trackCount: p.track_count,
    pageUrl: p.permalink ? `https://audius.co${p.permalink}` : undefined,
  };
}

interface Envelope<T> {
  data?: T;
}

async function get<T>(path: string, params: Record<string, string | number | boolean | undefined>, signal?: AbortSignal): Promise<T | undefined> {
  const body = await fetchJSON<Envelope<T>>(url(path, params), 'Audius', { signal });
  return body.data;
}

const tracksOf = (list: AudiusTrackJSON[] | undefined) => (list ?? []).filter(isPlayable).map(mapAudiusTrack);

export const AUDIUS_GENRES = [
  'Electronic',
  'Hip-Hop/Rap',
  'Pop',
  'Alternative',
  'R&B/Soul',
  'Lo-Fi',
  'House',
  'Ambient',
  'Rock',
  'Jazz',
  'Acoustic',
  'Classical',
  'Latin',
  'Funk',
  'Soundtrack',
  'Experimental',
];

export const audius = {
  async searchTracks(query: string, opts: { limit?: number; signal?: AbortSignal } = {}): Promise<Track[]> {
    return tracksOf(await get<AudiusTrackJSON[]>('/tracks/search', { query, limit: opts.limit ?? 20 }, opts.signal));
  },
  async trendingTracks(opts: { genre?: string; time?: 'week' | 'month' | 'year' | 'allTime'; limit?: number; signal?: AbortSignal } = {}): Promise<Track[]> {
    return tracksOf(await get<AudiusTrackJSON[]>('/tracks/trending', { genre: opts.genre, time: opts.time ?? 'week', limit: opts.limit ?? 20 }, opts.signal));
  },
  async undergroundTrending(opts: { limit?: number; signal?: AbortSignal } = {}): Promise<Track[]> {
    return tracksOf(await get<AudiusTrackJSON[]>('/tracks/trending/underground', { limit: opts.limit ?? 20 }, opts.signal));
  },
  async searchUsers(query: string, opts: { limit?: number; signal?: AbortSignal } = {}): Promise<RemoteArtist[]> {
    return ((await get<AudiusUserJSON[]>('/users/search', { query, limit: opts.limit ?? 8 }, opts.signal)) ?? []).map(mapAudiusUser);
  },
  async searchPlaylists(query: string, opts: { limit?: number; signal?: AbortSignal } = {}): Promise<RemoteCollection[]> {
    return ((await get<AudiusPlaylistJSON[]>('/playlists/search', { query, limit: opts.limit ?? 8 }, opts.signal)) ?? []).map(mapAudiusPlaylist);
  },
  async trendingPlaylists(opts: { limit?: number; signal?: AbortSignal } = {}): Promise<RemoteCollection[]> {
    return ((await get<AudiusPlaylistJSON[]>('/playlists/trending', { limit: opts.limit ?? 12, time: 'week', omit_tracks: true }, opts.signal)) ?? []).map(mapAudiusPlaylist);
  },
  async user(id: string, signal?: AbortSignal): Promise<RemoteArtist | undefined> {
    const u = await get<AudiusUserJSON | AudiusUserJSON[]>(`/users/${encodeURIComponent(id)}`, {}, signal);
    const one = Array.isArray(u) ? u[0] : u;
    return one ? mapAudiusUser(one) : undefined;
  },
  async userTracks(id: string, opts: { limit?: number; signal?: AbortSignal } = {}): Promise<Track[]> {
    return tracksOf(await get<AudiusTrackJSON[]>(`/users/${encodeURIComponent(id)}/tracks`, { limit: opts.limit ?? 30, sort_method: 'plays', sort_direction: 'desc' }, opts.signal));
  },
  async userAlbums(id: string, signal?: AbortSignal): Promise<RemoteCollection[]> {
    return ((await get<AudiusPlaylistJSON[]>(`/users/${encodeURIComponent(id)}/albums`, { limit: 20 }, signal)) ?? []).map(mapAudiusPlaylist);
  },
  async playlist(id: string, signal?: AbortSignal): Promise<RemoteCollection | undefined> {
    const p = await get<AudiusPlaylistJSON | AudiusPlaylistJSON[]>(`/playlists/${encodeURIComponent(id)}`, {}, signal);
    const one = Array.isArray(p) ? p[0] : p;
    return one ? mapAudiusPlaylist(one) : undefined;
  },
  async playlistTracks(id: string, signal?: AbortSignal): Promise<Track[]> {
    return tracksOf(await get<AudiusTrackJSON[]>(`/playlists/${encodeURIComponent(id)}/tracks`, {}, signal));
  },
  async track(id: string, signal?: AbortSignal): Promise<Track | undefined> {
    const t = await get<AudiusTrackJSON>(`/tracks/${encodeURIComponent(id)}`, {}, signal);
    return t && isPlayable(t) ? mapAudiusTrack(t) : undefined;
  },
};
