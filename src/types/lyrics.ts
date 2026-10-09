/**
 * Lyrics model. A `ParsedLyrics` object is the single runtime representation of
 * standard LRC, enhanced (word-level) LRC and plain, untimed lyrics.
 */

/** One timed text segment — usually a word, sometimes a syllable in enhanced LRC. */
export interface LyricWord {
  text: string;
  /** Start time in seconds (absolute song time). */
  start: number;
  /** End time in seconds — when the segment is fully "sung". */
  end: number;
  /** Whether a space follows this segment (false when a word is split into syllables). */
  trailingSpace: boolean;
}

export interface LyricLine {
  /** Stable id, unique within a lyrics document. */
  id: string;
  /** Line start in seconds. */
  start: number;
  /** Line end in seconds — explicit (enhanced end tag / break marker) or estimated. */
  end: number;
  text: string;
  /** Always populated: explicit word timing, or interpolated from the line duration. */
  words: LyricWord[];
  /** True when the word timings came from the file (enhanced LRC). */
  hasWordTiming: boolean;
  /** True when `end` came from the file rather than being estimated. */
  endIsExplicit: boolean;
}

export interface LyricsMetadata {
  title?: string;
  artist?: string;
  album?: string;
  author?: string;
  by?: string;
  /** `[offset:]` tag value in milliseconds (already applied to all times). */
  offsetMs?: number;
  length?: string;
  tool?: string;
  [key: string]: string | number | undefined;
}

export type LyricsKind = 'enhanced' | 'standard' | 'plain';

export interface ParsedLyrics {
  kind: LyricsKind;
  metadata: LyricsMetadata;
  lines: LyricLine[];
  /** Explicit empty-timestamp markers (`[01:23.45]` with no text) — instrumental breaks. */
  breakMarkers: number[];
  /** Non-fatal problems found while parsing (shown in the Lyrics Studio). */
  warnings: string[];
}

/** An item in the rendered lyrics timeline: either a line or an instrumental interlude. */
export type TimelineItem =
  | {
      type: 'line';
      key: string;
      line: LyricLine;
      lineIndex: number;
      /** Song time at which this item becomes the active (highlighted, centered) item. */
      activateAt: number;
    }
  | {
      type: 'interlude';
      key: string;
      start: number;
      end: number;
      activateAt: number;
    };

export interface LyricsTimeline {
  items: TimelineItem[];
  /** Sorted activation times, parallel to `items` — used for binary search. */
  activateTimes: number[];
  /** After this time no item is active (song outro). */
  finishedAt: number;
}

/** Where the lyrics shown for a track came from. */
export type LyricsSourceKind = 'original' | 'custom';
