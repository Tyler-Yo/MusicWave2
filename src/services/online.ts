/**
 * Startup wiring for the online catalogs: keeps referenced online tracks in the
 * persisted registry, applies the optional Audius API key and restores the artwork
 * of downloaded songs.
 */
import { libraryStore } from '@/state/libraryStore';
import { playerStore } from '@/state/playerStore';
import { setReferenceProvider } from '@/state/remoteCatalog';
import { settingsStore } from '@/state/settingsStore';
import { restoreLocalArtwork } from './downloads';
import { setAudiusApiKey } from './providers/audius';

let started = false;

export function initOnline(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  setReferenceProvider(() => {
    const lib = libraryStore.get();
    const ids = new Set<string>([
      ...Object.keys(lib.likedTracks),
      ...Object.keys(lib.savedAlbums),
      ...Object.keys(lib.savedPlaylists),
      ...Object.keys(lib.followedArtists),
      ...Object.keys(lib.downloads),
      ...lib.history.map((h) => h.trackId),
      ...lib.playlists.flatMap((p) => p.trackIds),
      ...playerStore.get().queue.map((q) => q.trackId),
    ]);
    for (const h of lib.history) if (h.context?.id) ids.add(h.context.id);
    return ids;
  });

  setAudiusApiKey(settingsStore.get().audiusApiKey);
  settingsStore.subscribe((s, prev) => {
    if (s.audiusApiKey !== prev.audiusApiKey) setAudiusApiKey(s.audiusApiKey);
  });

  void restoreLocalArtwork();
}
