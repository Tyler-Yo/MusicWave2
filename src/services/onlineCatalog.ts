/**
 * One place to query the online catalogs. Everything returned is registered in the
 * remote catalog, so tracks can be played, liked, queued, added to playlists and
 * downloaded by id like any built-in track.
 */
import {
  getCollectionTrackIds,
  getRemoteArtist,
  getRemoteCollection,
  getRemoteTrack,
  registerArtists,
  registerCollections,
  registerTracks,
  setCollectionTracks,
} from '@/state/remoteCatalog';
import type { RemoteArtist, RemoteCollection, Track } from '@/types/music';
import { archive, archiveCreatorId } from './providers/archive';
import { audius, rawId } from './providers/audius';
import { bestTier } from './quality';

type Opts = { signal?: AbortSignal; limit?: number };

export interface CollectionData {
  collection: RemoteCollection;
  tracks: Track[];
}

export interface ArtistData {
  artist: RemoteArtist;
  tracks: Track[];
  collections: RemoteCollection[];
}

const variantsOf = (t: Track) => (t.source.kind === 'remote' ? t.source.variants : []);

export const onlineCatalog = {
  // ---- Audius -------------------------------------------------------------------------------
  trending: async (o: Opts & { genre?: string; time?: 'week' | 'month' | 'year' | 'allTime' } = {}) =>
    registerTracks(await audius.trendingTracks({ genre: o.genre, time: o.time, limit: o.limit, signal: o.signal })),
  underground: async (o: Opts = {}) => registerTracks(await audius.undergroundTrending({ limit: o.limit, signal: o.signal })),
  trendingPlaylists: async (o: Opts = {}) => registerCollections(await audius.trendingPlaylists({ limit: o.limit, signal: o.signal })),
  searchTracks: async (q: string, o: Opts = {}) => registerTracks(await audius.searchTracks(q, { limit: o.limit, signal: o.signal })),
  searchArtists: async (q: string, o: Opts = {}) => registerArtists(await audius.searchUsers(q, { limit: o.limit, signal: o.signal })),
  searchPlaylists: async (q: string, o: Opts = {}) => registerCollections(await audius.searchPlaylists(q, { limit: o.limit, signal: o.signal })),

  // ---- Internet Archive --------------------------------------------------------------------
  searchArchive: async (q: string, o: Opts & { losslessOnly?: boolean } = {}) =>
    registerCollections(await archive.search(q, { rows: o.limit, losslessOnly: o.losslessOnly, signal: o.signal })),
  hiResConcerts: async (o: Opts = {}) => registerCollections(await archive.hiResConcerts({ rows: o.limit, signal: o.signal })),
  losslessConcerts: async (o: Opts = {}) => registerCollections(await archive.losslessConcerts({ rows: o.limit, signal: o.signal })),
  classic78s: async (o: Opts = {}) => registerCollections(await archive.classic78s({ rows: o.limit, signal: o.signal })),
  netlabels: async (o: Opts = {}) => registerCollections(await archive.netlabels({ rows: o.limit, signal: o.signal })),

  /** An album / playlist (Audius) or a recording (Internet Archive) with its tracks. */
  async collection(id: string, signal?: AbortSignal): Promise<CollectionData | null> {
    if (id.startsWith('audius-playlist:')) {
      const raw = rawId(id);
      const [collection, tracks] = await Promise.all([audius.playlist(raw, signal), audius.playlistTracks(raw, signal)]);
      if (!collection) return null;
      const registered = registerTracks(tracks);
      const withTier = { ...collection, trackCount: registered.length, bestTier: bestTier(registered.flatMap(variantsOf)) };
      registerCollections([withTier]);
      setCollectionTracks(id, registered.map((t) => t.id));
      return { collection: withTier, tracks: registered };
    }
    if (id.startsWith('ia-item:')) {
      const item = await archive.item(rawId(id), signal);
      if (!item) return null;
      const registered = registerTracks(item.tracks);
      registerCollections([item.collection]);
      setCollectionTracks(id, registered.map((t) => t.id));
      return { collection: item.collection, tracks: registered };
    }
    return null;
  },

  /** What is already known about a collection (instant render, and offline). */
  cachedCollection(id: string): CollectionData | null {
    const collection = getRemoteCollection(id);
    const ids = getCollectionTrackIds(id);
    if (!collection || !ids) return null;
    const tracks = ids.map(getRemoteTrack).filter((t): t is Track => Boolean(t));
    return { collection, tracks };
  },

  /** An Audius artist, or an Internet Archive creator. */
  async artist(id: string, signal?: AbortSignal): Promise<ArtistData | null> {
    if (id.startsWith('audius-user:')) {
      const raw = rawId(id);
      const [artist, tracks, collections] = await Promise.all([
        audius.user(raw, signal),
        audius.userTracks(raw, { limit: 30, signal }),
        audius.userAlbums(raw, signal).catch(() => [] as RemoteCollection[]),
      ]);
      if (!artist) return null;
      registerArtists([artist]);
      return { artist, tracks: registerTracks(tracks), collections: registerCollections(collections) };
    }
    if (id.startsWith('ia-creator:')) {
      const name = rawId(id);
      const collections = registerCollections(await archive.byCreator(name, { rows: 40, signal }));
      const artist: RemoteArtist = getRemoteArtist(id) ?? {
        id: archiveCreatorId(name),
        provider: 'archive',
        name,
        pageUrl: `https://archive.org/search?query=${encodeURIComponent(`creator:"${name}"`)}`,
      };
      registerArtists([artist]);
      return { artist, tracks: [], collections };
    }
    return null;
  },
};
