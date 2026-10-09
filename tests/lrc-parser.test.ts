import { describe, expect, it } from 'vitest';
import { parseLrc } from '@/services/lrc/parser';
import { serializeLrc } from '@/services/lrc/serializer';
import { formatLrcTime, parseLooseTime } from '@/services/lrc/time';

describe('parseLrc — standard LRC', () => {
  it('parses metadata, timestamps with 1/2/3 fractional digits and colon variants', () => {
    const lrc = [
      '[ti:Test Song]',
      '[ar:Test Artist]',
      '[al:Test Album]',
      '[by:someone]',
      '[00:01.5]tenths',
      '[00:02.25]hundredths',
      '[00:03.125]millis',
      '[00:04:50]colon variant',
      '[00:06]no fraction',
    ].join('\n');
    const parsed = parseLrc(lrc);
    expect(parsed.kind).toBe('standard');
    expect(parsed.metadata).toMatchObject({ title: 'Test Song', artist: 'Test Artist', album: 'Test Album', by: 'someone' });
    expect(parsed.lines.map((l) => l.start)).toEqual([1.5, 2.25, 3.125, 4.5, 6]);
    expect(parsed.lines.map((l) => l.text)).toEqual(['tenths', 'hundredths', 'millis', 'colon variant', 'no fraction']);
  });

  it('expands repeated timestamps (compressed choruses) and sorts chronologically', () => {
    const lrc = ['[00:10.00][01:10.00]Chorus line', '[00:05.00]Verse line', '[01:05.00]Verse two'].join('\n');
    const parsed = parseLrc(lrc);
    expect(parsed.lines.map((l) => [l.start, l.text])).toEqual([
      [5, 'Verse line'],
      [10, 'Chorus line'],
      [65, 'Verse two'],
      [70, 'Chorus line'],
    ]);
  });

  it('treats empty timestamp lines as break markers that end the previous line', () => {
    const lrc = ['[00:10.00]Line before the solo', '[00:13.50]', '[00:40.00]After the solo'].join('\n');
    const parsed = parseLrc(lrc);
    expect(parsed.breakMarkers).toEqual([13.5]);
    expect(parsed.lines[0].end).toBe(13.5);
    expect(parsed.lines[0].endIsExplicit).toBe(true);
  });

  it('applies the [offset:] tag (positive = earlier)', () => {
    const parsed = parseLrc('[offset:+500]\n[00:10.00]Hello world');
    expect(parsed.metadata.offsetMs).toBe(500);
    expect(parsed.lines[0].start).toBeCloseTo(9.5, 6);
    const later = parseLrc('[offset:-250]\n[00:10.00]Hello world');
    expect(later.lines[0].start).toBeCloseTo(10.25, 6);
  });

  it('interpolates word timings across line-level lines, weighted by syllables', () => {
    const parsed = parseLrc('[00:10.00]a beautiful day\n[00:14.00]next');
    const words = parsed.lines[0].words;
    expect(words.map((w) => w.text)).toEqual(['a', 'beautiful', 'day']);
    expect(parsed.lines[0].hasWordTiming).toBe(false);
    // "beautiful" (3 syllables) gets more time than "a" or "day".
    const dur = words.map((w) => w.end - w.start);
    expect(dur[1]).toBeGreaterThan(dur[0] * 2);
    // Words are contiguous and monotonic.
    for (let i = 1; i < words.length; i++) expect(words[i].start).toBeCloseTo(words[i - 1].end, 6);
    expect(words[0].start).toBe(10);
    expect(words[2].end).toBeLessThanOrEqual(14);
  });

  it('caps the estimated end of a line followed by a long instrumental gap', () => {
    const lrc = ['[00:01.00]one', '[00:04.00]two', '[00:07.00]three', '[00:40.00]four'].join('\n');
    const parsed = parseLrc(lrc);
    expect(parsed.lines[2].end).toBeLessThan(15);
    expect(parsed.lines[2].endIsExplicit).toBe(false);
    expect(parsed.lines[0].end).toBe(4);
  });

  it('handles BOM, CRLF, junk tags and untimed lines with warnings', () => {
    const parsed = parseLrc('﻿[ti:x]\r\n[00:01.00]ok\r\n[bad tag here]\r\nloose text\r\n');
    expect(parsed.lines).toHaveLength(1);
    expect(parsed.warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('returns plain lyrics when there are no timestamps', () => {
    const parsed = parseLrc('First line\nSecond line\n\nThird');
    expect(parsed.kind).toBe('plain');
    expect(parsed.lines.map((l) => l.text)).toEqual(['First line', 'Second line', 'Third']);
  });
});

describe('parseLrc — enhanced LRC', () => {
  it('parses word timestamps and the trailing end tag', () => {
    const parsed = parseLrc('[00:12.00]<00:12.00>Neon <00:12.40>rain <00:12.90>falls<00:13.80>');
    expect(parsed.kind).toBe('enhanced');
    const [line] = parsed.lines;
    expect(line.hasWordTiming).toBe(true);
    expect(line.end).toBeCloseTo(13.8, 6);
    expect(line.words.map((w) => [w.text, w.start, w.end])).toEqual([
      ['Neon', 12, 12.4],
      ['rain', 12.4, 12.9],
      ['falls', 12.9, 13.8],
    ]);
    expect(line.text).toBe('Neon rain falls');
  });

  it('supports syllable segments (no space) and text before the first word tag', () => {
    const parsed = parseLrc('[00:05.00]Oh <00:05.50>lan<00:05.80>terns <00:06.30>glow<00:07.00>');
    const [line] = parsed.lines;
    expect(line.words.map((w) => w.text)).toEqual(['Oh', 'lan', 'terns', 'glow']);
    expect(line.words[0].start).toBe(5);
    expect(line.words[1].trailingSpace).toBe(false);
    expect(line.words[2].trailingSpace).toBe(true);
    expect(line.text).toBe('Oh lanterns glow');
  });

  it('honours empty inline markers as word end times (rests inside a line)', () => {
    const parsed = parseLrc('[00:01.00]<00:01.00>wait<00:01.50> <00:03.00>now<00:03.40>');
    const [line] = parsed.lines;
    expect(line.words[0].end).toBe(1.5);
    expect(line.words[1].start).toBe(3);
  });

  it('shifts word times for repeated enhanced lines', () => {
    const parsed = parseLrc('[00:10.00][00:30.00]<00:10.00>la <00:10.50>la<00:11.00>');
    expect(parsed.lines[1].words.map((w) => w.start)).toEqual([30, 30.5]);
    expect(parsed.lines[1].end).toBe(31);
  });

  it('estimates an end when the end tag is missing', () => {
    const parsed = parseLrc('[00:01.00]<00:01.00>hello <00:01.40>there\n[00:09.00]<00:09.00>next<00:09.50>');
    const [line] = parsed.lines;
    expect(line.end).toBeGreaterThan(1.6);
    expect(line.end).toBeLessThan(3);
  });
});

describe('serializeLrc', () => {
  const enhanced = [
    '[ti:Round Trip]',
    '[00:01.00]<00:01.00>one <00:01.50>two<00:02.00>',
    '[00:02.00]<00:02.00>three<00:02.80>',
    '[00:02.80]',
    '[00:20.00]<00:20.00>after <00:20.60>break<00:21.30>',
  ].join('\n');

  it('round-trips enhanced lyrics', () => {
    const a = parseLrc(enhanced);
    const text = serializeLrc(a, { mode: 'enhanced', metadata: a.metadata });
    const b = parseLrc(text);
    expect(b.lines.map((l) => l.text)).toEqual(a.lines.map((l) => l.text));
    b.lines.forEach((l, i) => {
      expect(l.start).toBeCloseTo(a.lines[i].start, 2);
      expect(l.end).toBeCloseTo(a.lines[i].end, 2);
      l.words.forEach((w, j) => expect(w.start).toBeCloseTo(a.lines[i].words[j].start, 2));
    });
    expect(text).toContain('[ti:Round Trip]');
  });

  it('writes standard LRC with break markers and optional chorus compression', () => {
    const a = parseLrc('[00:01.00]hey\n[00:03.00]chorus\n[00:05.00]chorus\n[00:06.00]\n[00:30.00]end');
    const std = serializeLrc(a, { mode: 'standard' });
    expect(std).toContain('[00:06.00]\n');
    const compressed = serializeLrc(a, { mode: 'standard', compressRepeats: true });
    expect(compressed).toContain('[00:03.00][00:05.00]chorus');
    expect(parseLrc(compressed).lines.map((l) => l.text)).toEqual(['hey', 'chorus', 'chorus', 'end']);
  });
});

describe('time helpers', () => {
  it('formats with correct rounding at boundaries', () => {
    expect(formatLrcTime(59.999)).toBe('01:00.00');
    expect(formatLrcTime(61.005, 3)).toBe('01:01.005');
    expect(formatLrcTime(0)).toBe('00:00.00');
    expect(formatLrcTime(754.32)).toBe('12:34.32');
  });
  it('parses loose user input', () => {
    expect(parseLooseTime('01:02.50')).toBe(62.5);
    expect(parseLooseTime('[00:10.00]')).toBe(10);
    expect(parseLooseTime('12.5')).toBe(12.5);
    expect(parseLooseTime('abc')).toBeNaN();
  });
});
