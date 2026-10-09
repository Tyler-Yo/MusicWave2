/**
 * Serializes lyrics back to LRC — used by the Lyrics Studio export and by
 * scripts/generate-lrc.ts to produce the demo .lrc files.
 */
import type { LyricLine, LyricsMetadata, ParsedLyrics } from '@/types/lyrics';
import { DEFAULT_TIMELINE } from './timing';
import { formatLrcTime } from './time';

export interface SerializeOptions {
  /** `enhanced` writes word timestamps; `standard` writes line timestamps only. */
  mode: 'enhanced' | 'standard';
  metadata?: LyricsMetadata;
  /** Standard mode only: merge identical lines into `[t1][t2]text` (classic chorus compression). */
  compressRepeats?: boolean;
  /** Write empty `[mm:ss.xx]` markers where an instrumental break starts. Default true. */
  breakMarkers?: boolean;
  /** Fractional digits: 2 (centiseconds, most compatible) or 3 (milliseconds). */
  precision?: 2 | 3;
}

const HEADER_ORDER: Array<[keyof LyricsMetadata, string]> = [
  ['title', 'ti'],
  ['artist', 'ar'],
  ['album', 'al'],
  ['author', 'au'],
  ['by', 'by'],
  ['length', 'length'],
  ['tool', 're'],
  ['version', 've'],
];

function header(meta: LyricsMetadata | undefined): string[] {
  if (!meta) return [];
  return HEADER_ORDER.filter(([k]) => meta[k] !== undefined && meta[k] !== '').map(
    ([k, tag]) => `[${tag}:${meta[k]}]`,
  );
}

function enhancedLine(line: LyricLine, p: 2 | 3): string {
  const ts = (t: number) => formatLrcTime(t, p);
  const words = line.words
    .map((w, i) => {
      const sep = i < line.words.length - 1 && w.trailingSpace ? ' ' : '';
      return `<${ts(w.start)}>${w.text}${sep}`;
    })
    .join('');
  return `[${ts(line.start)}]${words}<${ts(line.end)}>`;
}

/** True when an instrumental break follows `line` (so an explicit end marker is useful). */
function breakAfter(lines: LyricLine[], i: number): boolean {
  const line = lines[i];
  const next = lines[i + 1];
  if (!line.endIsExplicit) return false;
  if (!next) return true;
  return next.start - line.end >= DEFAULT_TIMELINE.interludeMinGap;
}

export function serializeLrc(lyrics: Pick<ParsedLyrics, 'lines'>, options: SerializeOptions): string {
  const p = options.precision ?? 2;
  const ts = (t: number) => formatLrcTime(t, p);
  const out = header(options.metadata);
  const markers = options.breakMarkers ?? true;
  const { lines } = lyrics;

  if (options.mode === 'enhanced') {
    lines.forEach((line, i) => {
      out.push(enhancedLine(line, p));
      // Enhanced lines already carry their end; add a bare marker so standard-only players see the break too.
      if (markers && breakAfter(lines, i)) out.push(`[${ts(line.end)}]`);
    });
    return out.join('\n') + '\n';
  }

  if (options.compressRepeats) {
    const groups = new Map<string, number[]>();
    for (const line of lines) {
      const list = groups.get(line.text) ?? [];
      list.push(line.start);
      groups.set(line.text, list);
    }
    for (const [text, starts] of groups) {
      out.push(`${starts.map((s) => `[${ts(s)}]`).join('')}${text}`);
    }
    if (markers) {
      lines.forEach((line, i) => {
        if (breakAfter(lines, i)) out.push(`[${ts(line.end)}]`);
      });
    }
    return out.join('\n') + '\n';
  }

  lines.forEach((line, i) => {
    out.push(`[${ts(line.start)}]${line.text}`);
    if (markers && breakAfter(lines, i)) out.push(`[${ts(line.end)}]`);
  });
  return out.join('\n') + '\n';
}
