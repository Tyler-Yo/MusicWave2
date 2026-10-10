/**
 * Lyrics repository: picks the right LRC for a track (custom override > built-in >
 * looked up online) and memoizes parsing.
 */
import { BUILTIN_LYRICS } from '@/data/lyrics';
import { lyricsStore } from '@/state/lyricsStore';
import type { LyricsSourceKind, ParsedLyrics } from '@/types/lyrics';
import type { Track } from '@/types/music';
import { parseLrc } from './lrc/parser';
import { lrcFromState, remoteLyricsStore, type RemoteLyricsState } from './remoteLyrics';

const parseCache = new Map<string, ParsedLyrics>();

export function parseCached(lrc: string): ParsedLyrics {
  let parsed = parseCache.get(lrc);
  if (!parsed) {
    parsed = parseLrc(lrc);
    if (parseCache.size > 40) parseCache.delete(parseCache.keys().next().value as string);
    parseCache.set(lrc, parsed);
  }
  return parsed;
}

export interface LyricsSource {
  lrc: string;
  kind: LyricsSourceKind;
}

export function lyricsSourceFor(
  track: Track | undefined,
  overrides = lyricsStore.get().overrides,
  remote: RemoteLyricsState | undefined = track ? remoteLyricsStore.get().byTrack[track.id] : undefined,
): LyricsSource | null {
  if (!track) return null;
  const custom = overrides[track.id];
  if (custom) return { lrc: custom.lrc, kind: 'custom' };
  if (track.lyricsId && BUILTIN_LYRICS[track.lyricsId]) return { lrc: BUILTIN_LYRICS[track.lyricsId], kind: 'original' };
  const online = lrcFromState(remote);
  if (online) return { lrc: online, kind: 'lrclib' };
  return null;
}

/** The lyrics a track ships with (built-in file, or the online lookup) — what "Revert" restores. */
export function originalLyricsFor(track: Track | undefined): string | null {
  if (!track) return null;
  if (track.lyricsId) return BUILTIN_LYRICS[track.lyricsId] ?? null;
  return lrcFromState(remoteLyricsStore.get().byTrack[track.id]);
}

export function hasLyrics(track: Track, overrides = lyricsStore.get().overrides): boolean {
  return Boolean(overrides[track.id] || (track.lyricsId && BUILTIN_LYRICS[track.lyricsId]) || lrcFromState(remoteLyricsStore.get().byTrack[track.id]));
}
