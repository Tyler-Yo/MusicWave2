/**
 * Converts the timed lyrics produced by the arrangement compiler into a
 * ParsedLyrics document / LRC text. Used by scripts/generate-lrc.ts and tests.
 */
import { lyricsFromLines } from '@/services/lrc/parser';
import { serializeLrc } from '@/services/lrc/serializer';
import { formatLrcTime } from '@/services/lrc/time';
import type { LyricsMetadata, ParsedLyrics } from '@/types/lyrics';
import { compileArrangement } from './arrangement';
import type { Composition } from './types';

export function composedLyrics(comp: Composition, metadata: LyricsMetadata = {}): ParsedLyrics {
  const arrangement = compileArrangement(comp);
  return lyricsFromLines(
    arrangement.lines.map((l) => ({ start: l.start, end: l.end, text: l.text, words: l.words })),
    metadata,
  );
}

export function compositionToLrc(comp: Composition, metadata: LyricsMetadata = {}): string {
  const arrangement = compileArrangement(comp);
  const lyrics = composedLyrics(comp, metadata);
  const mode = comp.lrcFormat ?? 'enhanced';
  return serializeLrc(lyrics, {
    mode,
    compressRepeats: mode === 'standard',
    metadata: {
      ...metadata,
      length: formatLrcTime(arrangement.duration).slice(0, 5),
      tool: 'MusicWave arrangement compiler',
    },
  });
}
