import { useMemo } from 'react';
import { lyricsSourceFor, parseCached } from '@/services/lyrics';
import type { LyricsSourceKind, ParsedLyrics } from '@/types/lyrics';
import type { Track } from '@/types/music';
import { useLyricsState } from './usePlayer';

export interface TrackLyrics {
  lyrics: ParsedLyrics | null;
  kind: LyricsSourceKind | null;
  lrc: string | null;
}

/** Lyrics for a track: a custom (Studio/imported) override wins over the built-in file. */
export function useLyrics(track: Track | undefined): TrackLyrics {
  const overrides = useLyricsState((s) => s.overrides);
  const custom = track ? overrides[track.id] : undefined;
  return useMemo(() => {
    const src = lyricsSourceFor(track, custom ? { [track!.id]: custom } : {});
    if (!src) return { lyrics: null, kind: null, lrc: null };
    return { lyrics: parseCached(src.lrc), kind: src.kind, lrc: src.lrc };
  }, [track, custom]);
}
