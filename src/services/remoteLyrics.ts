/**
 * Lyrics for online tracks, looked up automatically on LRCLIB.
 *
 * Results are kept in memory (reactive store) and in IndexedDB, so a song's lyrics
 * are fetched once and stay available offline once the song is downloaded.
 * "Not found" answers are cached for a few days, then retried.
 */
import { createStore } from '@/state/createStore';
import { isOffline } from '@/state/networkStore';
import { settingsStore } from '@/state/settingsStore';
import type { Track } from '@/types/music';
import { offlineStore } from './offlineStore';
import { findLyrics, stripTimestamps, type RemoteLyricsResult } from './providers/lrclib';

const MISS_TTL = 3 * 24 * 3600 * 1000;

export type RemoteLyricsState =
  | RemoteLyricsResult
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'offline' }
  | { status: 'disabled' };

export const remoteLyricsStore = createStore<{ byTrack: Record<string, RemoteLyricsState> }>({ byTrack: {} });

const inflight = new Map<string, Promise<RemoteLyricsState>>();
/** Lookups made before the track's length was known are redone once it is (to validate sync). */
const blindLookups = new Set<string>();

function put(trackId: string, state: RemoteLyricsState): RemoteLyricsState {
  remoteLyricsStore.set((s) => ({ byTrack: { ...s.byTrack, [trackId]: state } }));
  return state;
}

/** Tracks whose lyrics come from LRCLIB (online catalogs). */
export function usesRemoteLyrics(track: Track | undefined): track is Track {
  return Boolean(track && track.source.kind === 'remote');
}

export function remoteLyricsState(trackId: string): RemoteLyricsState | undefined {
  return remoteLyricsStore.get().byTrack[trackId];
}

/** The LRC text to display for a resolved state (plain lyrics are returned untimed). */
export function lrcFromState(state: RemoteLyricsState | undefined): string | null {
  if (!state) return null;
  if (state.status === 'synced') return state.lrc;
  if (state.status === 'plain') return stripTimestamps(state.plain);
  return null;
}

const albumHint = (track: Track) => (track.albumTitle && track.albumTitle !== 'Single' ? track.albumTitle : undefined);

/**
 * Makes sure lyrics for `track` are loaded (memory → IndexedDB → LRCLIB).
 * Safe to call repeatedly; concurrent calls share one request.
 */
export function ensureRemoteLyrics(track: Track, opts: { force?: boolean } = {}): Promise<RemoteLyricsState> {
  const current = remoteLyricsState(track.id);
  const retryable = !current || current.status === 'error' || current.status === 'offline' || current.status === 'disabled';
  const lengthNowKnown = blindLookups.has(track.id) && track.duration > 0;
  if (current && !retryable && !opts.force && !lengthNowKnown) return Promise.resolve(current);
  const force = opts.force || lengthNowKnown;
  const pending = inflight.get(track.id);
  if (pending) return pending;

  const job = (async (): Promise<RemoteLyricsState> => {
    // Keep showing what we have while re-checking; only show a spinner when there is nothing yet.
    if (!current || retryable) put(track.id, { status: 'loading' });
    const cached = await offlineStore.getLyrics(track.id);
    const fresh = cached && (cached.result.status !== 'none' || Date.now() - cached.fetchedAt < MISS_TTL);
    if (cached && fresh && !force) return put(track.id, cached.result);
    if (!settingsStore.get().autoLyrics) return put(track.id, cached ? cached.result : { status: 'disabled' });
    if (isOffline()) return put(track.id, cached ? cached.result : { status: 'offline' });
    try {
      const result = await findLyrics({
        title: track.title,
        artist: track.artistName ?? '',
        album: albumHint(track),
        duration: track.duration,
      });
      if (track.duration > 0) {
        blindLookups.delete(track.id);
        void offlineStore.putLyrics({ trackId: track.id, result, fetchedAt: Date.now() });
      } else blindLookups.add(track.id);
      return put(track.id, result);
    } catch (err) {
      if (cached) return put(track.id, cached.result);
      return put(track.id, { status: 'error', message: err instanceof Error ? err.message : 'Lyrics lookup failed' });
    }
  })().finally(() => inflight.delete(track.id));
  inflight.set(track.id, job);
  return job;
}
