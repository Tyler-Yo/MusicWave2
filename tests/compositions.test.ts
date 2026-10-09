/**
 * The demo songs double as lyric-sync test fixtures:
 *   slow ballad · fast rap · repeated choruses · long instrumental breaks · standard LRC.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMPOSITIONS, LYRIC_COMPOSITIONS } from '@/data/compositions';
import { ALBUMS, ARTISTS, TRACKS } from '@/data/catalog';
import { compileArrangement, compositionDuration } from '@/audio/synth/arrangement';
import { compositionToLrc } from '@/audio/synth/lyricsExport';
import { parseLrc } from '@/services/lrc/parser';
import { buildTimeline, findActiveIndex } from '@/services/lrc/timing';

const lrcPath = (id: string) => join(__dirname, '..', 'src', 'data', 'lyrics', `${id}.lrc`);

function metadataFor(id: string) {
  const track = TRACKS.find((t) => t.lyricsId === id)!;
  return {
    title: track.title,
    artist: ARTISTS.find((a) => a.id === track.artistId)?.name,
    album: ALBUMS.find((a) => a.id === track.albumId)?.title,
    author: track.credits?.writtenBy.join(', '),
    by: 'MusicWave',
  };
}

describe('demo catalog', () => {
  it('has at least 12 tracks and 5 songs with lyrics', () => {
    expect(TRACKS.length).toBeGreaterThanOrEqual(12);
    expect(TRACKS.filter((t) => t.lyricsId).length).toBeGreaterThanOrEqual(5);
  });
  it('uses exact composition durations', () => {
    for (const t of TRACKS) {
      if (t.source.kind !== 'synth') continue;
      expect(t.duration).toBeCloseTo(compositionDuration(COMPOSITIONS[t.source.compositionId]), 6);
    }
  });
  it('references existing artists and albums', () => {
    for (const t of TRACKS) {
      expect(ARTISTS.some((a) => a.id === t.artistId)).toBe(true);
      expect(ALBUMS.find((a) => a.id === t.albumId)?.trackIds).toContain(t.id);
    }
  });
});

describe.each(LYRIC_COMPOSITIONS.map((c) => [c.id, c] as const))('lyrics fixture: %s', (id, comp) => {
  const arrangement = compileArrangement(comp);
  const file = readFileSync(lrcPath(id), 'utf8');
  const parsed = parseLrc(file);

  it('committed .lrc matches the generator (run `npm run generate:lrc` after editing a song)', () => {
    expect(file).toBe(compositionToLrc(comp, metadataFor(id)));
  });

  it('parses to the same lines, in order, with centisecond-accurate timing', () => {
    expect(parsed.lines.map((l) => l.text)).toEqual(arrangement.lines.map((l) => l.text));
    parsed.lines.forEach((line, i) => {
      expect(Math.abs(line.start - arrangement.lines[i].start)).toBeLessThanOrEqual(0.006);
    });
  });

  it('word timestamps line up with the sung syllables (enhanced files)', () => {
    if (comp.lrcFormat === 'standard') return;
    parsed.lines.forEach((line, i) => {
      const words = arrangement.lines[i].words;
      expect(line.words).toHaveLength(words.length);
      line.words.forEach((w, j) => expect(Math.abs(w.start - words[j].start)).toBeLessThanOrEqual(0.006));
      expect(Math.abs(line.end - arrangement.lines[i].end)).toBeLessThanOrEqual(0.006);
    });
  });

  it('never has overlapping lines, so exactly one line is active at a time', () => {
    for (let i = 1; i < arrangement.lines.length; i++) {
      expect(arrangement.lines[i].start).toBeGreaterThanOrEqual(arrangement.lines[i - 1].end - 1e-9);
    }
    const tl = buildTimeline(parsed);
    for (let i = 1; i < tl.activateTimes.length; i++) expect(tl.activateTimes[i]).toBeGreaterThanOrEqual(tl.activateTimes[i - 1]);
  });

  it('activates every line by the time its first word is sung', () => {
    const tl = buildTimeline(parsed);
    tl.items.forEach((item, idx) => {
      if (item.type !== 'line') return;
      expect(findActiveIndex(tl, item.line.start + 0.001)).toBe(idx);
    });
  });
});

describe('sync stress scenarios', () => {
  it('slow ballad: long lines with generous lead-in', () => {
    const lines = compileArrangement(COMPOSITIONS['paper-lanterns']).lines;
    const avg = lines.reduce((a, l) => a + (l.end - l.start), 0) / lines.length;
    expect(avg).toBeGreaterThan(4);
  });

  it('fast rap: ≥ 5.5 syllables per second, back-to-back lines', () => {
    const arr = compileArrangement(COMPOSITIONS.overclocked);
    const verse = arr.lines.filter((l) => l.section.startsWith('Verse'));
    const syllables = arr.vocal.filter((v) => verse.some((l) => v.time >= l.start && v.time < l.end)).length;
    const seconds = verse.reduce((a, l) => a + (l.end - l.start), 0);
    expect(syllables / seconds).toBeGreaterThan(5.5);
  });

  it('repeated choruses: identical relative word timing every time', () => {
    const arr = compileArrangement(COMPOSITIONS['golden-hour-radio']);
    const first = arr.lines.filter((l) => l.text === 'Turn it up, golden hour radio');
    expect(first.length).toBe(4);
    const rel = (l: (typeof first)[number]) => l.words.map((w) => +(w.start - l.start).toFixed(4));
    for (const l of first) expect(rel(l)).toEqual(rel(first[0]));
  });

  it('instrumental breaks: interludes appear for the intro and the solo', () => {
    const tl = buildTimeline(parseLrc(readFileSync(lrcPath('night-drive-protocol'), 'utf8')));
    const interludes = tl.items.filter((i) => i.type === 'interlude');
    expect(interludes.length).toBeGreaterThanOrEqual(2);
    const longest = Math.max(...interludes.map((i) => (i.type === 'interlude' ? i.end - i.start : 0)));
    expect(longest).toBeGreaterThan(30);
  });

  it('standard LRC: compressed choruses expand and get interpolated word progress', () => {
    const text = readFileSync(lrcPath('harbor-lights'), 'utf8');
    expect(text).toMatch(/\[\d\d:\d\d\.\d\d\]\[\d\d:\d\d\.\d\d\]\[\d\d:\d\d\.\d\d\]So leave the harbor lights on/);
    const parsed = parseLrc(text);
    expect(parsed.kind).toBe('standard');
    expect(parsed.lines.filter((l) => l.text === 'So leave the harbor lights on')).toHaveLength(3);
    for (const line of parsed.lines) {
      expect(line.hasWordTiming).toBe(false);
      expect(line.words.length).toBeGreaterThan(0);
      expect(line.words[0].start).toBeCloseTo(line.start, 6);
    }
  });
});
