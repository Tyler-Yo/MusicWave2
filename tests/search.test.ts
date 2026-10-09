import { describe, expect, it } from 'vitest';
import { normalize, scoreText, search, searchLyrics } from '@/services/search';

describe('search', () => {
  it('normalizes accents, case and punctuation', () => {
    expect(normalize('  Café — DÉJÀ vu! ')).toBe('cafe deja vu');
  });

  it('scores exact > prefix > word > substring, and tolerates one typo', () => {
    expect(scoreText('paper lanterns', 'Paper Lanterns')).toBe(100);
    expect(scoreText('paper', 'Paper Lanterns')).toBeGreaterThan(scoreText('lanterns', 'Paper Lanterns'));
    expect(scoreText('lantrens', 'Paper Lanterns')).toBeGreaterThan(0);
    expect(scoreText('zzz', 'Paper Lanterns')).toBe(0);
  });

  it('finds songs, artists and albums and picks a sensible top result', () => {
    const r = search('overclocked');
    expect(r.tracks[0].id).toBe('overclocked');
    expect(r.top).toMatchObject({ kind: 'track', id: 'overclocked' });
    expect(search('kassi').artists[0].id).toBe('kassi-orbit');
    expect(search('qwxzv').total).toBe(0);
  });

  it('does not return unrelated songs', () => {
    const r = search('carry me');
    expect(r.tracks.map((t) => t.id)).toEqual(['paper-lanterns']);
  });

  it('finds lyric lines with their timestamps (once per distinct line)', () => {
    const hits = searchLyrics('carry me home');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].track.id).toBe('paper-lanterns');
    expect(hits[0].time).toBeGreaterThan(40);
    const texts = hits.map((h) => h.text);
    expect(new Set(texts).size).toBe(texts.length);
  });
});
