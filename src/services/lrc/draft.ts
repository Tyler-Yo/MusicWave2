/**
 * Lyrics Studio draft model (pure): plain text → lines/words with optional
 * timestamps → ParsedLyrics for preview and LRC export.
 */
import type { LyricsMetadata, ParsedLyrics } from '@/types/lyrics';
import { lyricsFromLines } from './parser';

export interface DraftWord {
  text: string;
  time: number | null;
}

export interface DraftLine {
  text: string;
  time: number | null;
  /** Explicit end (instrumental break after this line), if tapped. */
  end: number | null;
  words: DraftWord[];
}

export type TapMode = 'line' | 'word';

export interface Cursor {
  line: number;
  word: number;
}

const splitWords = (text: string): DraftWord[] => text.split(/\s+/).filter(Boolean).map((t) => ({ text: t, time: null }));

/** Rebuilds lines from text, keeping timestamps for lines whose text did not change. */
export function linesFromText(text: string, previous: DraftLine[] = []): DraftLine[] {
  const rows = text
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean);
  const byText = new Map<string, DraftLine[]>();
  previous.forEach((l) => byText.set(l.text, [...(byText.get(l.text) ?? []), l]));
  return rows.map((row, i) => {
    const same = previous[i]?.text === row ? previous[i] : byText.get(row)?.shift();
    return same ? { ...same, words: same.words.map((w) => ({ ...w })) } : { text: row, time: null, end: null, words: splitWords(row) };
  });
}

export function linesFromLyrics(parsed: ParsedLyrics): DraftLine[] {
  return parsed.lines.map((l) => {
    const timed = parsed.kind !== 'plain';
    if (l.hasWordTiming) {
      // Merge syllable segments back into whole words.
      const words: DraftWord[] = [];
      let joined = false;
      for (const w of l.words) {
        if (joined && words.length) words[words.length - 1].text += w.text;
        else words.push({ text: w.text, time: w.start });
        joined = !w.trailingSpace;
      }
      return { text: l.text, time: l.start, end: l.endIsExplicit ? l.end : null, words };
    }
    return { text: l.text, time: timed ? l.start : null, end: timed && l.endIsExplicit ? l.end : null, words: splitWords(l.text) };
  });
}

export function textOf(lines: DraftLine[]): string {
  return lines.map((l) => l.text).join('\n');
}

/** Lyrics built from the timed lines (untimed ones are skipped). Word times are used only when complete. */
export function draftToLyrics(lines: DraftLine[], metadata: LyricsMetadata = {}): ParsedLyrics | null {
  const timed = lines.filter((l) => l.time !== null);
  if (timed.length === 0) return null;
  const sorted = [...timed].sort((a, b) => (a.time as number) - (b.time as number));
  const markers: number[] = [];
  const out = sorted.map((l, i) => {
    const start = l.time as number;
    const nextStart = sorted[i + 1]?.time ?? Infinity;
    const end = l.end !== null && l.end > start && l.end <= nextStart ? l.end : undefined;
    if (end !== undefined) markers.push(end);
    const allWords = l.words.length > 0 && l.words.every((w) => w.time !== null);
    if (!allWords) return { start, text: l.text, end };
    const words = l.words.map((w, j) => {
      const s = Math.max(start, w.time as number);
      const next = l.words[j + 1]?.time;
      const e = next ?? end ?? Math.min(nextStart, s + Math.max(0.35, w.text.length * 0.09));
      return { text: w.text, start: s, end: Math.max(s + 0.02, e), trailingSpace: j < l.words.length - 1 };
    });
    return { start, text: l.text, words, end: end ?? words[words.length - 1].end };
  });
  return lyricsFromLines(out, metadata, markers);
}

export function draftStats(lines: DraftLine[]): { lines: number; timedLines: number; words: number; timedWords: number } {
  let words = 0;
  let timedWords = 0;
  for (const l of lines) {
    words += l.words.length;
    timedWords += l.words.filter((w) => w.time !== null).length;
  }
  return { lines: lines.length, timedLines: lines.filter((l) => l.time !== null).length, words, timedWords };
}

/** First position that still needs a timestamp (after the last stamped one). */
export function nextCursor(lines: DraftLine[], mode: TapMode): Cursor | null {
  if (mode === 'line') {
    let lastTimed = -1;
    lines.forEach((l, i) => l.time !== null && (lastTimed = i));
    const i = lines.findIndex((l, idx) => idx > lastTimed && l.time === null);
    return i >= 0 ? { line: i, word: 0 } : null;
  }
  let last: Cursor | null = null;
  lines.forEach((l, i) => l.words.forEach((w, j) => w.time !== null && (last = { line: i, word: j })));
  const start: Cursor = last ? advance(lines, last) ?? { line: lines.length, word: 0 } : { line: 0, word: 0 };
  for (let i = start.line; i < lines.length; i++) {
    for (let j = i === start.line ? start.word : 0; j < lines[i].words.length; j++) {
      if (lines[i].words[j].time === null) return { line: i, word: j };
    }
  }
  return null;
}

function advance(lines: DraftLine[], c: Cursor): Cursor | null {
  if (c.word + 1 < (lines[c.line]?.words.length ?? 0)) return { line: c.line, word: c.word + 1 };
  for (let i = c.line + 1; i < lines.length; i++) if (lines[i].words.length) return { line: i, word: 0 };
  return null;
}

/** Applies one tap at `time`. Returns the new lines and the stamped position. */
export function applyTap(lines: DraftLine[], cursor: Cursor, mode: TapMode, time: number): DraftLine[] {
  const next = lines.map((l) => ({ ...l, words: l.words.map((w) => ({ ...w })) }));
  const line = next[cursor.line];
  if (!line) return lines;
  const t = Math.max(0, Math.round(time * 1000) / 1000);
  if (mode === 'line') {
    line.time = t;
    // Re-timing a line invalidates stale word stamps inside it.
    line.words.forEach((w) => (w.time = null));
  } else {
    line.words[cursor.word].time = t;
    if (cursor.word === 0) line.time = t;
  }
  return next;
}

/** Clears the most recent stamp (by time). Returns null when there is nothing to undo. */
export function undoLast(lines: DraftLine[], mode: TapMode): DraftLine[] | null {
  let best: { line: number; word: number; time: number } | null = null;
  lines.forEach((l, i) => {
    if (mode === 'line') {
      if (l.time !== null && (!best || l.time >= best.time)) best = { line: i, word: -1, time: l.time };
    } else {
      l.words.forEach((w, j) => {
        if (w.time !== null && (!best || w.time >= best.time)) best = { line: i, word: j, time: w.time };
      });
    }
  });
  if (!best) return null;
  const b = best as { line: number; word: number; time: number };
  const next = lines.map((l) => ({ ...l, words: l.words.map((w) => ({ ...w })) }));
  if (b.word < 0) {
    next[b.line].time = null;
    next[b.line].end = null;
  } else {
    next[b.line].words[b.word].time = null;
    if (b.word === 0) next[b.line].time = null;
  }
  return next;
}
