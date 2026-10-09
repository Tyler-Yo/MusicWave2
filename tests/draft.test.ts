import { describe, expect, it } from 'vitest';
import { applyTap, draftToLyrics, linesFromLyrics, linesFromText, nextCursor, undoLast } from '@/services/lrc/draft';
import { parseLrc } from '@/services/lrc/parser';
import { serializeLrc } from '@/services/lrc/serializer';

describe('Lyrics Studio draft model', () => {
  it('turns pasted text into untimed lines and keeps timings when text is edited', () => {
    let lines = linesFromText('First line\n\n second line \nthird');
    expect(lines.map((l) => l.text)).toEqual(['First line', 'second line', 'third']);
    lines = applyTap(lines, { line: 0, word: 0 }, 'line', 1.5);
    const edited = linesFromText('First line\nsecond line changed\nthird', lines);
    expect(edited[0].time).toBe(1.5);
    expect(edited[1].time).toBeNull();
  });

  it('line-mode taps advance through lines and export standard LRC', () => {
    let lines = linesFromText('one\ntwo\nthree');
    const taps = [1, 3.2, 5.75];
    for (const t of taps) {
      const c = nextCursor(lines, 'line')!;
      lines = applyTap(lines, c, 'line', t);
    }
    expect(nextCursor(lines, 'line')).toBeNull();
    const lyrics = draftToLyrics(lines)!;
    expect(lyrics.kind).toBe('standard');
    const lrc = serializeLrc(lyrics, { mode: 'standard' });
    expect(parseLrc(lrc).lines.map((l) => l.start)).toEqual(taps);
  });

  it('word-mode taps produce enhanced LRC with exact word times', () => {
    let lines = linesFromText('neon rain\nfalls down');
    const taps = [10, 10.5, 12, 12.4];
    for (const t of taps) lines = applyTap(lines, nextCursor(lines, 'word')!, 'word', t);
    const lyrics = draftToLyrics(lines)!;
    expect(lyrics.kind).toBe('enhanced');
    const reparsed = parseLrc(serializeLrc(lyrics, { mode: 'enhanced' }));
    expect(reparsed.lines.flatMap((l) => l.words.map((w) => w.start))).toEqual(taps);
  });

  it('undo removes the latest stamp', () => {
    let lines = linesFromText('a b\nc');
    lines = applyTap(lines, { line: 0, word: 0 }, 'word', 1);
    lines = applyTap(lines, { line: 0, word: 1 }, 'word', 2);
    lines = undoLast(lines, 'word')!;
    expect(lines[0].words[1].time).toBeNull();
    expect(nextCursor(lines, 'word')).toEqual({ line: 0, word: 1 });
  });

  it('round-trips existing enhanced lyrics through the editor', () => {
    const parsed = parseLrc('[00:01.00]<00:01.00>hello <00:01.50>world<00:02.20>\n[00:02.20]\n[00:09.00]<00:09.00>again<00:09.80>');
    const lines = linesFromLyrics(parsed);
    expect(lines[0].words.map((w) => w.time)).toEqual([1, 1.5]);
    expect(lines[0].end).toBeCloseTo(2.2, 6);
    const back = draftToLyrics(lines)!;
    expect(back.lines[0].end).toBeCloseTo(2.2, 6);
    expect(back.lines[1].words[0].start).toBe(9);
  });
});
