/** The listener's library: likes, saves, playlists, history, downloads and uploads. */
import type { PlayContext, QualityTier, UploadedTrackMeta } from '@/types/music';
import { persistStore } from '@/services/storage';
import { createStore } from './createStore';

export interface UserPlaylist {
  id: string;
  title: string;
  description: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface HistoryEntry {
  trackId: string;
  playedAt: number;
  context?: PlayContext;
}

export interface LibraryState {
  likedTracks: Record<string, number>;
  savedAlbums: Record<string, number>;
  savedPlaylists: Record<string, number>;
  followedArtists: Record<string, number>;
  playlists: UserPlaylist[];
  history: HistoryEntry[];
  playCounts: Record<string, number>;
  /** Tracks explicitly downloaded for offline listening. */
  downloads: Record<string, DownloadInfo>;
  uploads: UploadedTrackMeta[];
  recentSearches: string[];
}

export interface DownloadInfo {
  savedAt: number;
  size: number;
  /** Quality of the saved file (online tracks). */
  tier?: QualityTier;
  /** e.g. "24-bit / 96 kHz FLAC" or "MP3". */
  detail?: string;
}

const HISTORY_LIMIT = 200;

export const libraryStore = createStore<LibraryState>({
  likedTracks: {},
  savedAlbums: {},
  savedPlaylists: {},
  followedArtists: {},
  playlists: [],
  history: [],
  playCounts: {},
  downloads: {},
  uploads: [],
  recentSearches: [],
});

persistStore(libraryStore, { key: 'library', version: 1, pick: (s) => s });

const toggleIn = (map: Record<string, number>, id: string) => {
  const next = { ...map };
  if (next[id]) delete next[id];
  else next[id] = Date.now();
  return next;
};

const uid = () => `pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const libraryActions = {
  toggleLike: (id: string) => libraryStore.set((s) => ({ likedTracks: toggleIn(s.likedTracks, id) })),
  toggleSaveAlbum: (id: string) => libraryStore.set((s) => ({ savedAlbums: toggleIn(s.savedAlbums, id) })),
  toggleSavePlaylist: (id: string) => libraryStore.set((s) => ({ savedPlaylists: toggleIn(s.savedPlaylists, id) })),
  toggleFollow: (id: string) => libraryStore.set((s) => ({ followedArtists: toggleIn(s.followedArtists, id) })),

  createPlaylist(title: string, trackIds: string[] = [], description = ''): UserPlaylist {
    const now = Date.now();
    const playlist: UserPlaylist = { id: uid(), title: title.trim() || 'New Playlist', description, trackIds, createdAt: now, updatedAt: now };
    libraryStore.set((s) => ({ playlists: [playlist, ...s.playlists] }));
    return playlist;
  },
  updatePlaylist(id: string, patch: Partial<Pick<UserPlaylist, 'title' | 'description'>>) {
    libraryStore.set((s) => ({
      playlists: s.playlists.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
    }));
  },
  deletePlaylist(id: string) {
    libraryStore.set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }));
  },
  /** Adds tracks, skipping ones already present. Returns how many were added. */
  addToPlaylist(id: string, trackIds: string[]): number {
    let added = 0;
    libraryStore.set((s) => ({
      playlists: s.playlists.map((p) => {
        if (p.id !== id) return p;
        const fresh = trackIds.filter((t) => !p.trackIds.includes(t));
        added = fresh.length;
        return { ...p, trackIds: [...p.trackIds, ...fresh], updatedAt: Date.now() };
      }),
    }));
    return added;
  },
  removeFromPlaylist(id: string, index: number) {
    libraryStore.set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === id ? { ...p, trackIds: p.trackIds.filter((_, i) => i !== index), updatedAt: Date.now() } : p,
      ),
    }));
  },
  movePlaylistTrack(id: string, from: number, to: number) {
    libraryStore.set((s) => ({
      playlists: s.playlists.map((p) => {
        if (p.id !== id) return p;
        const ids = [...p.trackIds];
        const [moved] = ids.splice(from, 1);
        ids.splice(to, 0, moved);
        return { ...p, trackIds: ids, updatedAt: Date.now() };
      }),
    }));
  },

  recordPlay(trackId: string, context?: PlayContext) {
    libraryStore.set((s) => ({
      history: [{ trackId, playedAt: Date.now(), context }, ...s.history].slice(0, HISTORY_LIMIT),
      playCounts: { ...s.playCounts, [trackId]: (s.playCounts[trackId] ?? 0) + 1 },
    }));
  },
  clearHistory: () => libraryStore.set({ history: [] }),

  setDownloaded(trackId: string, size: number, extra: Pick<DownloadInfo, 'tier' | 'detail'> = {}) {
    libraryStore.set((s) => ({ downloads: { ...s.downloads, [trackId]: { savedAt: Date.now(), size, ...extra } } }));
  },
  removeDownload(trackId: string) {
    libraryStore.set((s) => {
      const downloads = { ...s.downloads };
      delete downloads[trackId];
      return { downloads };
    });
  },

  addUpload: (meta: UploadedTrackMeta) => libraryStore.set((s) => ({ uploads: [meta, ...s.uploads] })),
  updateUpload: (id: string, patch: Partial<UploadedTrackMeta>) =>
    libraryStore.set((s) => ({ uploads: s.uploads.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),
  removeUpload: (id: string) =>
    libraryStore.set((s) => ({
      uploads: s.uploads.filter((u) => u.id !== id),
      playlists: s.playlists.map((p) => ({ ...p, trackIds: p.trackIds.filter((t) => t !== id) })),
    })),

  rememberSearch(q: string) {
    const query = q.trim();
    if (query.length < 2) return;
    libraryStore.set((s) => ({ recentSearches: [query, ...s.recentSearches.filter((x) => x !== query)].slice(0, 8) }));
  },
  clearSearches: () => libraryStore.set({ recentSearches: [] }),
};
