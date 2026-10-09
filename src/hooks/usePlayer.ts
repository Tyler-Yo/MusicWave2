/** Convenience selectors over the player, library and settings stores. */
import { useCallback } from 'react';
import { getTrack } from '@/services/catalog';
import { libraryStore } from '@/state/libraryStore';
import { playerStore } from '@/state/playerStore';
import { settingsStore, type SettingsState } from '@/state/settingsStore';
import { uiStore, type UIState } from '@/state/uiStore';
import { lyricsStore, type LyricsState } from '@/state/lyricsStore';
import type { LibraryState } from '@/state/libraryStore';
import type { PlayerState } from '@/types/player';
import type { Track } from '@/types/music';
import { shallowEqual, useStore } from '@/state/createStore';

export function usePlayer<S>(selector: (s: PlayerState) => S, eq?: (a: S, b: S) => boolean): S {
  return useStore(playerStore, selector, eq);
}
export function useLibrary<S>(selector: (s: LibraryState) => S, eq?: (a: S, b: S) => boolean): S {
  return useStore(libraryStore, selector, eq);
}
export function useSettings<S>(selector: (s: SettingsState) => S, eq?: (a: S, b: S) => boolean): S {
  return useStore(settingsStore, selector, eq);
}
export function useUI<S>(selector: (s: UIState) => S, eq?: (a: S, b: S) => boolean): S {
  return useStore(uiStore, selector, eq);
}
export function useLyricsState<S>(selector: (s: LyricsState) => S, eq?: (a: S, b: S) => boolean): S {
  return useStore(lyricsStore, selector, eq);
}

const selectCurrentId = (s: PlayerState) => (s.index >= 0 ? s.queue[s.index]?.trackId : undefined);

/** The current track (re-renders only when the track changes). */
export function useCurrentTrack(): Track | undefined {
  const id = usePlayer(selectCurrentId);
  // Uploaded tracks resolve through the library, so subscribe to uploads too.
  useLibrary((s) => s.uploads, shallowEqual);
  return id ? getTrack(id) : undefined;
}

export function useIsCurrent(trackId: string): { current: boolean; playing: boolean } {
  return usePlayer(
    useCallback((s: PlayerState) => {
      const current = s.index >= 0 && s.queue[s.index]?.trackId === trackId;
      return { current, playing: current && s.isPlaying };
    }, [trackId]),
    shallowEqual,
  );
}

export function useIsLiked(trackId: string): boolean {
  return useLibrary(useCallback((s: LibraryState) => Boolean(s.likedTracks[trackId]), [trackId]));
}
