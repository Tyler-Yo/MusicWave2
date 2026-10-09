/**
 * Renders a short song with the real engine and checks that the audio is sane and
 * that each sung syllable begins where its lyric timestamp says it does.
 */
import { describe, expect, it } from 'vitest';
import { compileArrangement } from '@/audio/synth/arrangement';
import { renderSong, renderSongToWav } from '@/audio/synth/engine';
import type { Composition } from '@/audio/synth/types';

const mini: Composition = {
  id: 'test-mini',
  bpm: 100,
  key: 'C',
  mode: 'major',
  style: 'pop',
  vocal: { range: [60, 72], grid: 0.5, delivery: 'sung' },
  sections: [
    { name: 'Intro', type: 'intro', bars: 2, chords: ['I', 'V'], layers: ['kick', 'pad'] },
    {
      name: 'Verse',
      type: 'verse',
      bars: 4,
      chords: ['I', 'V', 'vi', 'IV'],
      layers: ['kick', 'clap', 'hats', 'bass', 'pluck', 'pad', 'vocal'],
      lines: ['Testing every single word', 'singing right on time'],
    },
  ],
};

describe('synth engine', () => {
  it('renders finite, non-silent, limited stereo audio of the right length', () => {
    const song = renderSong(mini, { sampleRate: 16000 });
    const arr = compileArrangement(mini);
    expect(song.left.length).toBe(Math.ceil(arr.duration * 16000));
    let peak = 0;
    let sum = 0;
    for (let i = 0; i < song.left.length; i++) {
      const v = song.left[i];
      expect(Number.isFinite(v)).toBe(true);
      peak = Math.max(peak, Math.abs(v), Math.abs(song.right[i]));
      sum += v * v;
    }
    expect(peak).toBeLessThanOrEqual(1);
    expect(Math.sqrt(sum / song.left.length)).toBeGreaterThan(0.05);
  });

  it('produces a valid 16-bit stereo WAV', () => {
    const { wav, analysis } = renderSongToWav(mini, { sampleRate: 16000 });
    const view = new DataView(wav);
    const tag = (o: number) => String.fromCharCode(...new Uint8Array(wav, o, 4));
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(analysis.peaks.length).toBe(480);
  });

  it('starts every isolated sung syllable within 40 ms of its timestamp', () => {
    const sr = 16000;
    const arr = compileArrangement(mini);
    const vocal = renderSong(mini, { sampleRate: sr, only: ['vocal'], raw: true }).left;
    const energy = (a: number, b: number) => {
      let s = 0;
      for (let i = Math.max(0, a); i < b; i++) s += vocal[i] * vocal[i];
      return s / Math.max(1, b - a);
    };
    let checked = 0;
    arr.vocal.forEach((note, i) => {
      const prev = arr.vocal[i - 1];
      if (prev && note.time - (prev.time + prev.dur) < 0.12) return;
      const s0 = Math.round(note.time * sr);
      const steady = energy(s0 + Math.round(0.05 * sr), s0 + Math.round(0.09 * sr));
      const frame = Math.round(0.002 * sr);
      let onset = NaN;
      for (let k = s0 - Math.round(0.06 * sr); k < s0 + Math.round(0.08 * sr); k += frame) {
        if (energy(k, k + frame) > steady * 0.25) {
          onset = (k - s0) / sr;
          break;
        }
      }
      expect(Math.abs(onset)).toBeLessThanOrEqual(0.04);
      checked++;
    });
    expect(checked).toBeGreaterThanOrEqual(2);
  });
});
