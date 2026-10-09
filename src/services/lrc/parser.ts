/**
 * LRC parser supporting:
 *  - standard LRC: `[mm:ss.xx]Line`, with 1–3 fractional digits or `[mm:ss:xx]`
 *  - repeated lines: `[00:12.00][01:30.00]Chorus line`
 *  - enhanced (A2) LRC with word/syllable timestamps: `[00:12.00]<00:12.00>Neon <00:12.40>rain<00:13.10>`
 *  - empty timestamp lines `[01:02.00]` as instrumental-break / end-of-line markers
 *  - ID tags: ti, ar, al, au, by, length, re, ve, and `offset` (applied to every time)
 *  - plain, untimed lyrics (rendered statically and syncable in the Lyrics Studio)
 */
import type { LyricLine, LyricsMetadata, LyricWord, ParsedLyrics } from '@/types/lyrics';
import { finalizeLines, type DraftLine } from './timing';
import { lrcPartsToSeconds } from './time';

const LINE_TIME_TAG = /^\s*\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/;
const WORD_TIME_TAG = /<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?>/g;
const ID_TAG = /^\s*\[([a-zA-Z#][\w#]*)\s*:(.*)\]\s*$/;

const META_KEYS: Record<string, keyof LyricsMetadata> = {
  ti: 'title',
  ar: 'artist',
  al: 'album',
  au: 'author',
  by: 'by',
  length: 'length',
  re: 'tool',
  ve: 'version',
};

interface RawSegment {
  text: string;
  start: number;
  end?: number;
  trailingSpace: boolean;
}

/**
 * Splits enhanced-LRC content into timed segments.
 * Returns null when the content has no inline word tags.
 */
function parseSegments(
  content: string,
  lineStart: number,
  warnings: string[],
  lineNo: number,
): { segments: RawSegment[]; end?: number } | null {
  const tags = [...content.matchAll(WORD_TIME_TAG)];
  if (tags.length === 0) return null;

  const segments: RawSegment[] = [];
  let end: number | undefined;

  const lead = content.slice(0, tags[0].index);
  if (lead.trim()) {
    segments.push({ text: lead.trim(), start: lineStart, trailingSpace: /\s$/.test(lead) });
  }

  tags.forEach((tag, i) => {
    const time = lrcPartsToSeconds(tag[1], tag[2], tag[3]);
    const from = (tag.index ?? 0) + tag[0].length;
    const to = i + 1 < tags.length ? (tags[i + 1].index ?? content.length) : content.length;
    const raw = content.slice(from, to);
    const prev = segments[segments.length - 1];
    if (prev && /^\s/.test(raw)) prev.trailingSpace = true;

    if (!raw.trim()) {
      // An empty segment is a timing marker: it ends the previous segment (or the line).
      if (i === tags.length - 1) end = time;
      else if (prev && prev.end === undefined) prev.end = time;
      if (prev && /\s/.test(raw)) prev.trailingSpace = true;
      return;
    }
    if (prev && time < prev.start) {
      warnings.push(`Line ${lineNo}: word "${raw.trim()}" starts before the previous word; clamped.`);
    }
    segments.push({
      text: raw.trim(),
      start: prev ? Math.max(time, prev.start) : time,
      trailingSpace: /\s$/.test(raw),
    });
  });

  return { segments, end };
}

export interface ParseOptions {
  /** Extra offset in seconds added on top of the file's `[offset:]` tag (positive = earlier). */
  extraOffset?: number;
}

export function parseLrc(source: string, options: ParseOptions = {}): ParsedLyrics {
  const metadata: LyricsMetadata = {};
  const warnings: string[] = [];
  const drafts: DraftLine[] = [];
  const markers: number[] = [];
  const untimed: string[] = [];
  let sawTimestamp = false;
  let sawWordTiming = false;

  const rows = source.replace(/^\uFEFF/, '').split(/\r?\n/);

  rows.forEach((row, rowIndex) => {
    const lineNo = rowIndex + 1;
    if (!row.trim()) return;

    // ID / metadata tags (only when the whole row is a single non-time tag).
    const id = row.match(ID_TAG);
    if (id && !LINE_TIME_TAG.test(row)) {
      const key = id[1].toLowerCase();
      const value = id[2].trim();
      if (key === 'offset') {
        const ms = parseInt(value, 10);
        if (Number.isFinite(ms)) metadata.offsetMs = ms;
        else warnings.push(`Line ${lineNo}: invalid offset "${value}".`);
      } else if (key !== '#') {
        metadata[META_KEYS[key] ?? key] = value;
      }
      return;
    }

    // One or more leading time tags.
    const times: number[] = [];
    let rest = row;
    for (;;) {
      const m = rest.match(LINE_TIME_TAG);
      if (!m) break;
      times.push(lrcPartsToSeconds(m[1], m[2], m[3]));
      rest = rest.slice(m[0].length);
    }

    if (times.length === 0) {
      if (/^\s*\[[^\]]*\]/.test(row)) {
        warnings.push(`Line ${lineNo}: unrecognized tag skipped.`);
        return;
      }
      untimed.push(row.trim());
      return;
    }
    sawTimestamp = true;

    const content = rest.replace(/\s+$/, '').replace(/^\s+/, '');
    if (!content) {
      markers.push(...times);
      return;
    }

    const base = times[0];
    const parsed = parseSegments(content, base, warnings, lineNo);
    if (parsed) sawWordTiming = true;

    for (const t of times) {
      const shift = t - base;
      if (parsed) {
        drafts.push({
          start: Math.min(t, parsed.segments[0]?.start + shift),
          text: parsed.segments.map((s) => s.text + (s.trailingSpace ? ' ' : '')).join('').trim(),
          segments: parsed.segments.map((s) => ({
            ...s,
            start: s.start + shift,
            end: s.end !== undefined ? s.end + shift : undefined,
          })),
          explicitEnd: parsed.end !== undefined ? parsed.end + shift : undefined,
          order: drafts.length,
        });
      } else {
        drafts.push({ start: t, text: content, order: drafts.length });
      }
    }
  });

  if (!sawTimestamp) {
    // Plain lyrics: keep text, no timing. The Lyrics Studio can sync these.
    const lines: LyricLine[] = untimed.map((text, i) => ({
      id: `p${i}`,
      start: 0,
      end: 0,
      text,
      words: text.split(/\s+/).map((w) => ({ text: w, start: 0, end: 0, trailingSpace: true })),
      hasWordTiming: false,
      endIsExplicit: false,
    }));
    return { kind: 'plain', metadata, lines, breakMarkers: [], warnings };
  }
  if (untimed.length > 0) {
    warnings.push(`${untimed.length} line(s) without a timestamp were ignored.`);
  }

  // Apply [offset:] (+ = lyrics earlier) and any caller offset.
  const shift = -((metadata.offsetMs ?? 0) / 1000) - (options.extraOffset ?? 0);
  if (shift !== 0) {
    for (const d of drafts) {
      d.start = Math.max(0, d.start + shift);
      if (d.explicitEnd !== undefined) d.explicitEnd = Math.max(0, d.explicitEnd + shift);
      d.segments?.forEach((s) => {
        s.start = Math.max(0, s.start + shift);
        if (s.end !== undefined) s.end = Math.max(0, s.end + shift);
      });
    }
    for (let i = 0; i < markers.length; i++) markers[i] = Math.max(0, markers[i] + shift);
  }

  markers.sort((a, b) => a - b);
  drafts.sort((a, b) => a.start - b.start || a.order - b.order);

  return {
    kind: sawWordTiming ? 'enhanced' : 'standard',
    metadata,
    lines: finalizeLines(drafts, markers),
    breakMarkers: markers,
    warnings,
  };
}

/** Convenience: builds a ParsedLyrics from already-timed lines (used by the editor & generator). */
export function lyricsFromLines(
  lines: Array<{ start: number; text: string; words?: LyricWord[]; end?: number }>,
  metadata: LyricsMetadata = {},
  breakMarkers: number[] = [],
): ParsedLyrics {
  const drafts: DraftLine[] = lines
    .map((l, i) => ({
      start: l.start,
      text: l.text,
      order: i,
      explicitEnd: l.end,
      segments: l.words?.map((w) => ({ text: w.text, start: w.start, end: w.end, trailingSpace: w.trailingSpace })),
    }))
    .sort((a, b) => a.start - b.start || a.order - b.order);
  const markers = [...breakMarkers].sort((a, b) => a - b);
  const hasWords = drafts.some((d) => d.segments && d.segments.length > 0);
  return {
    kind: hasWords ? 'enhanced' : 'standard',
    metadata,
    lines: finalizeLines(drafts, markers),
    breakMarkers: markers,
    warnings: [],
  };
}
