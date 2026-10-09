/**
 * Lyrics timing: line-end estimation, word interpolation, the display timeline
 * (lines + instrumental interludes) and O(log n) active-item lookup.
 *
 * Conventions:
 *  - All times are absolute song seconds.
 *  - "Lyrics time" = media time + user offset (positive offset shows lyrics earlier).
 */
import type { LyricLine, LyricsTimeline, LyricWord, ParsedLyrics, TimelineItem } from '@/types/lyrics';
import { countSyllables } from './syllables';

export interface DraftSegment {
  text: string;
  start: number;
  end?: number;
  trailingSpace: boolean;
}

export interface DraftLine {
  start: number;
  text: string;
  order: number;
  segments?: DraftSegment[];
  explicitEnd?: number;
}

/** Gaps between consecutive line starts at or above this are treated as non-continuous singing. */
const MAX_CONTINUOUS_GAP = 10;

function median(values: number[]): number {
  if (values.length === 0) return 3.2;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Relative "singing weight" of a word: syllables plus a little for the word itself and punctuation pauses. */
export function wordWeight(word: string): number {
  const syl = Math.max(1, countSyllables(word));
  const pause = /[,;:—–-]$/.test(word) ? 0.6 : /[.!?…]$/.test(word) ? 0.9 : 0;
  return syl + 0.45 + pause;
}

/**
 * Distributes `text` across [start, end] proportionally to word weights.
 * This is what makes line-level LRC still feel like a smooth karaoke sweep.
 */
export function interpolateWords(text: string, start: number, end: number): LyricWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const weights = tokens.map(wordWeight);
  const total = weights.reduce((a, b) => a + b, 0);
  const span = Math.max(0.05, end - start);
  let cursor = start;
  return tokens.map((t, i) => {
    const dur = (weights[i] / total) * span;
    const w: LyricWord = { text: t, start: cursor, end: cursor + dur, trailingSpace: i < tokens.length - 1 };
    cursor += dur;
    return w;
  });
}

/** Rough natural duration of a sung line, used only as an upper bound when the next line is far away. */
function naturalDuration(text: string, typical: number, avgWeight: number): number {
  const weight = text.split(/\s+/).filter(Boolean).reduce((a, w) => a + wordWeight(w), 0);
  const ratio = avgWeight > 0 ? weight / avgWeight : 1;
  return Math.min(12, Math.max(1.2, typical * Math.min(1.6, Math.max(0.6, ratio))));
}

/** Turns sorted drafts (+ sorted break markers) into complete lines with ends and word timings. */
export function finalizeLines(drafts: DraftLine[], markers: number[]): LyricLine[] {
  // Typical spacing between line starts, ignoring long instrumental gaps and marker-separated lines.
  const gaps: number[] = [];
  for (let i = 0; i + 1 < drafts.length; i++) {
    const gap = drafts[i + 1].start - drafts[i].start;
    const markerBetween = markers.some((m) => m > drafts[i].start && m < drafts[i + 1].start);
    if (gap > 0.2 && gap < MAX_CONTINUOUS_GAP && !markerBetween) gaps.push(gap);
  }
  const typical = median(gaps);
  const avgWeight =
    drafts.reduce((a, d) => a + d.text.split(/\s+/).filter(Boolean).reduce((s, w) => s + wordWeight(w), 0), 0) /
    Math.max(1, drafts.length);

  return drafts.map((d, i) => {
    const nextStart = i + 1 < drafts.length ? drafts[i + 1].start : Infinity;
    const marker = markers.find((m) => m > d.start && m <= nextStart);
    const segs = d.segments && d.segments.length > 0 ? d.segments : undefined;

    let end: number;
    let endIsExplicit = false;
    if (d.explicitEnd !== undefined && d.explicitEnd > d.start) {
      end = Math.min(d.explicitEnd, nextStart);
      endIsExplicit = true;
    } else if (marker !== undefined) {
      end = marker;
      endIsExplicit = true;
    } else if (segs) {
      const last = segs[segs.length - 1];
      const tail = last.end ?? last.start + Math.max(0.45, countSyllables(last.text) * 0.38);
      end = Math.min(nextStart, Math.max(tail, last.start + 0.2));
    } else {
      const est = naturalDuration(d.text, typical, avgWeight);
      const gap = nextStart - d.start;
      end = gap <= est * 1.5 ? nextStart : d.start + est;
    }
    end = Math.max(end, d.start + 0.05);

    let words: LyricWord[];
    if (segs) {
      words = segs.map((s, j) => {
        const next = segs[j + 1];
        const segEnd = s.end ?? (next ? next.start : end);
        return {
          text: s.text,
          start: s.start,
          end: Math.max(s.start + 0.01, Math.min(segEnd, end)),
          trailingSpace: j < segs.length - 1 ? s.trailingSpace : false,
        };
      });
    } else {
      // Leave a natural breath before the next line when the end was inferred from it.
      const singEnd = endIsExplicit ? end : d.start + (end - d.start) * 0.92;
      words = interpolateWords(d.text, d.start, singEnd);
    }

    return {
      id: `l${i}`,
      start: d.start,
      end,
      text: d.text,
      words,
      hasWordTiming: Boolean(segs),
      endIsExplicit,
    };
  });
}

export interface TimelineOptions {
  /** Seconds before a line's first word at which the line becomes active (eyes lead the voice). */
  leadIn?: number;
  /** Minimum silent gap (seconds) that produces an instrumental interlude item. */
  interludeMinGap?: number;
  /** Seconds a finished line stays highlighted before an interlude takes over. */
  lineTail?: number;
}

export const DEFAULT_TIMELINE: Required<TimelineOptions> = {
  leadIn: 0.32,
  interludeMinGap: 4.5,
  lineTail: 0.35,
};

export function buildTimeline(lyrics: ParsedLyrics | null, options: TimelineOptions = {}): LyricsTimeline {
  const opts = { ...DEFAULT_TIMELINE, ...options };
  const items: TimelineItem[] = [];
  if (!lyrics || lyrics.kind === 'plain' || lyrics.lines.length === 0) {
    return { items, activateTimes: [], finishedAt: Infinity };
  }
  const { lines } = lyrics;

  const first = lines[0];
  if (first.start >= opts.interludeMinGap) {
    items.push({ type: 'interlude', key: 'intro', start: 0, end: first.start - opts.leadIn, activateAt: 0 });
  }

  lines.forEach((line, i) => {
    const prev = lines[i - 1];
    const prevItem = items[items.length - 1];
    let activateAt: number;
    if (!prev || prevItem?.type === 'interlude') {
      activateAt = Math.max(0, line.start - opts.leadIn);
    } else {
      // Never steal focus while the previous line is still being sung.
      activateAt = Math.min(line.start, Math.max(line.start - opts.leadIn, prev.end));
    }
    if (prevItem) activateAt = Math.max(activateAt, prevItem.activateAt);
    items.push({ type: 'line', key: line.id, line, lineIndex: i, activateAt });

    const next = lines[i + 1];
    if (next && next.start - line.end >= opts.interludeMinGap) {
      const start = line.end + opts.lineTail;
      items.push({ type: 'interlude', key: `gap-${line.id}`, start, end: next.start - opts.leadIn, activateAt: start });
    }
  });

  const last = lines[lines.length - 1];
  return {
    items,
    activateTimes: items.map((it) => it.activateAt),
    finishedAt: last.end + 1.5,
  };
}

/** Index of the item active at time `t` (binary search), or -1 before the first item. */
export function findActiveIndex(timeline: LyricsTimeline, t: number): number {
  const times = timeline.activateTimes;
  let lo = 0;
  let hi = times.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** 0..1 fill progress of a timed segment at time `t`. */
export function segmentProgress(seg: { start: number; end: number }, t: number): number {
  if (t <= seg.start) return 0;
  if (t >= seg.end) return 1;
  return (t - seg.start) / (seg.end - seg.start);
}

/** Index of the line whose [start, nextStart) contains `t`, or -1. Used by the Lyrics Studio. */
export function findLineAt(lines: LyricLine[], t: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].start <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}
