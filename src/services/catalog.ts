/**
 * Catalog access layer: merges the built-in demo catalog, tracks from the online
 * catalogs (Audius, Internet Archive), the listener's uploads and playlists, and
 * resolves artwork.
 */
import { ALBUM_MAP, ALBUMS, ARTIST_MAP, GENRE_MAP, PALETTES, PLAYLIST_MAP, TRACK_MAP, TRACKS } from '@/data/catalog';
import { libraryStore, type UserPlaylist } from '@/state/libraryStore';
import { getRemoteTrack } from '@/state/remoteCatalog';
import type { Album, Artist, CoverStyle, Genre, Palette, Playlist, RemoteArtist, RemoteCollection, Track, UploadedTrackMeta } from '@/types/music';
import { artistDataUrl, coverDataUrl } from '@/utils/art';
import { hashString } from '@/utils/random';

export const UPLOADS_ID = 'uploads';

const UPLOAD_PALETTE: Palette = { base: '#111827', a: '#64748b', b: '#34e0b6', c: '#8b6cff' };
const paletteList = Object.values(PALETTES);
const styleList: CoverStyle[] = ['mesh', 'waves', 'bloom', 'orbits', 'topo', 'rings', 'stripes'];

export function uploadToTrack(u: UploadedTrackMeta): Track {
  return {
    id: u.id,
    title: u.title,
    artistId: UPLOADS_ID,
    albumId: UPLOADS_ID,
    trackNumber: 0,
    duration: u.duration,
    genreId: UPLOADS_ID,
    releaseDate: u.addedAt.slice(0, 10),
    plays: 0,
    source: { kind: 'upload', blobKey: u.id },
    artistName: u.artist,
    albumTitle: 'Your uploads',
  };
}

export function getTrack(id: string): Track | undefined {
  const t = TRACK_MAP.get(id) ?? getRemoteTrack(id);
  if (t) return t;
  const u = libraryStore.get().uploads.find((x) => x.id === id);
  return u ? uploadToTrack(u) : undefined;
}

export const isRemoteTrack = (t: Track | undefined): boolean => t?.source.kind === 'remote';

export function getTracks(ids: string[]): Track[] {
  return ids.map(getTrack).filter((t): t is Track => Boolean(t));
}

export function allTracks(): Track[] {
  return [...TRACKS, ...libraryStore.get().uploads.map(uploadToTrack)];
}

export const getAlbum = (id: string): Album | undefined => ALBUM_MAP.get(id);
export const getArtist = (id: string): Artist | undefined => ARTIST_MAP.get(id);
export const getGenre = (id: string): Genre | undefined => GENRE_MAP.get(id);

export function userPlaylistToPlaylist(p: UserPlaylist): Playlist {
  const h = hashString(p.id);
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    trackIds: p.trackIds,
    curator: 'You',
    palette: paletteList[h % paletteList.length],
    coverStyle: styleList[h % styleList.length],
    isUser: true,
    createdAt: new Date(p.createdAt).toISOString(),
    updatedAt: new Date(p.updatedAt).toISOString(),
  };
}

export function getPlaylist(id: string): Playlist | undefined {
  const editorial = PLAYLIST_MAP.get(id);
  if (editorial) return editorial;
  const user = libraryStore.get().playlists.find((p) => p.id === id);
  return user ? userPlaylistToPlaylist(user) : undefined;
}

export function artistNameOf(track: Track): string {
  return track.artistName ?? getArtist(track.artistId)?.name ?? 'Unknown artist';
}

export function albumTitleOf(track: Track): string {
  return track.albumTitle ?? getAlbum(track.albumId)?.title ?? '';
}

export function albumCover(album: Album): string {
  return coverDataUrl({ seed: album.id, palette: album.palette, style: album.coverStyle });
}

/** Artwork from local, downloaded copies of online covers (object URLs), filled by the downloads service. */
const localArtwork = new Map<string, string>();
export function setLocalArtwork(trackId: string, url: string | null): void {
  const old = localArtwork.get(trackId);
  if (old && old !== url) URL.revokeObjectURL(old);
  if (url) localArtwork.set(trackId, url);
  else localArtwork.delete(trackId);
}

function hashedPalette(seed: string): Palette {
  return paletteList[hashString(seed) % paletteList.length];
}

/** Generated artwork — also the fallback when online artwork cannot be loaded. */
export function generatedCover(seed: string, title?: string, subtitle?: string): string {
  const h = hashString(seed);
  return coverDataUrl({ seed, palette: paletteList[h % paletteList.length], style: styleList[h % styleList.length], title, subtitle });
}

export function trackCover(track: Track): string {
  const local = localArtwork.get(track.id);
  if (local) return local;
  if (track.artworkUrl) return track.artworkUrl;
  const album = getAlbum(track.albumId);
  if (album) return albumCover(album);
  if (track.provider === 'audius' || track.provider === 'archive') return generatedCover(track.albumId || track.id);
  return coverDataUrl({ seed: track.id, palette: UPLOAD_PALETTE, style: 'mesh' });
}

/** Cover to show if `trackCover` fails to load (offline, blocked host…). */
export function trackFallbackCover(track: Track): string {
  const album = getAlbum(track.albumId);
  if (album) return albumCover(album);
  return generatedCover(track.albumId || track.id);
}

export function collectionCover(c: RemoteCollection): string {
  return c.artworkUrl ?? generatedCover(c.id, c.title, c.artistName);
}

export function remoteArtistImage(a: RemoteArtist): string {
  return a.imageUrl ?? artistDataUrl(a.id, hashedPalette(a.id));
}

/** Route of a track's album or online collection, if it has one. */
export function albumHref(track: Track): string | undefined {
  if (getAlbum(track.albumId)) return `/album/${track.albumId}`;
  if (track.source.kind === 'remote' && track.albumId) return `/collection/${encodeURIComponent(track.albumId)}`;
  return undefined;
}

/** Route of a track's artist page (uploads have none). */
export function artistHref(track: Track): string | undefined {
  if (track.source.kind === 'upload') return undefined;
  return `/artist/${encodeURIComponent(track.artistId)}`;
}

export function playlistCover(p: Playlist): string {
  return coverDataUrl({
    seed: p.id,
    palette: p.palette,
    style: p.coverStyle,
    title: p.title,
    subtitle: p.isUser ? 'Playlist' : 'MusicWave',
  });
}

export function artistImage(artist: Artist): string {
  return artistDataUrl(artist.id, artist.palette);
}

export function genreCover(genre: Genre): string {
  return coverDataUrl({ seed: `genre-${genre.id}`, palette: genre.palette, style: genre.coverStyle });
}

export function paletteOf(track: Track | undefined): Palette {
  if (!track) return UPLOAD_PALETTE;
  const album = getAlbum(track.albumId);
  if (album) return album.palette;
  return track.source.kind === 'remote' ? hashedPalette(track.albumId || track.id) : UPLOAD_PALETTE;
}

export const albumsByArtist = (artistId: string) => ALBUMS.filter((a) => a.artistId === artistId);
export const tracksByArtist = (artistId: string) => TRACKS.filter((t) => t.artistId === artistId).sort((a, b) => b.plays - a.plays);
