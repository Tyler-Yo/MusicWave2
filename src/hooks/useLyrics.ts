import { useCallback, useEffect, useMemo } from 'react';
import { lyricsSourceFor, parseCached } from '@/services/lyrics';
import { ensureRemoteLyrics, remoteLyricsStore, usesRemoteLyrics, type RemoteLyricsState } from '@/services/remoteLyrics';
import { useStore } from '@/state/createStore';
import { networkStore } from '@/state/networkStore';
import type { LyricsSourceKind, ParsedLyrics } from '@/types/lyrics';
import type { Track } from '@/types/music';
import { useLyricsState, useSettings } from './usePlayer';

/** Lookup state shown when a track has no lyrics to display yet. */
export type LyricsStatus = 'ready' | 'loading' | 'none' | 'instrumental' | 'offline' | 'error' | 'disabled';

export interface TrackLyrics {
  lyrics: ParsedLyrics | null;
  kind: LyricsSourceKind | null;
  lrc: string | null;
  status: LyricsStatus;
  /** Details about lyrics found online (e.g. why they are not synced). */
  remote?: RemoteLyricsState;
  retry: () => void;
}

/**
 * Lyrics for a track: a custom (Studio/imported) override wins over the built-in
 * file; online tracks get theirs from LRCLIB automatically.
 */
export function useLyrics(track: Track | undefined): TrackLyrics {
  const overrides = useLyricsState((s) => s.overrides);
  const custom = track ? overrides[track.id] : undefined;
  const remote = useStore(remoteLyricsStore, (s) => (track ? s.byTrack[track.id] : undefined));
  const online = useStore(networkStore, (s) => s.online);
  const autoLyrics = useSettings((s) => s.autoLyrics);
  const isRemote = usesRemoteLyrics(track);

  useEffect(() => {
    if (!isRemote || !track || custom) return;
    void ensureRemoteLyrics(track);
    // Re-run when connectivity or the setting changes so "offline"/"disabled" states recover.
  }, [isRemote, track, custom, online, autoLyrics]);

  const retry = useCallback(() => {
    if (track && isRemote) void ensureRemoteLyrics(track, { force: true });
  }, [track, isRemote]);

  return useMemo(() => {
    const src = lyricsSourceFor(track, custom ? { [track!.id]: custom } : {}, remote);
    if (src) return { lyrics: parseCached(src.lrc), kind: src.kind, lrc: src.lrc, status: 'ready', remote, retry };
    let status: LyricsStatus = 'none';
    if (isRemote) {
      switch (remote?.status) {
        case undefined:
        case 'loading':
          status = 'loading';
          break;
        case 'instrumental':
          status = 'instrumental';
          break;
        case 'offline':
          status = 'offline';
          break;
        case 'error':
          status = 'error';
          break;
        case 'disabled':
          status = 'disabled';
          break;
        default:
          status = 'none';
      }
    } else {
      status = 'instrumental';
    }
    return { lyrics: null, kind: null, lrc: null, status, remote, retry };
  }, [track, custom, remote, isRemote, retry]);
}
