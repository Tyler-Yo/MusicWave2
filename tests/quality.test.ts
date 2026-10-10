import { describe, expect, it } from 'vitest';
import { bestTier, classify, formatFromName, parseAudioHeader, rankVariants, variantDetail, withSpecs } from '@/services/quality';
import type { AudioFormat, AudioVariant } from '@/types/music';

/** Builds the first bytes of a FLAC file with a STREAMINFO block. */
function flacHeader(sampleRate: number, bitDepth: number, channels: number): Uint8Array {
  const b = new Uint8Array(42);
  b.set([0x66, 0x4c, 0x61, 0x43]); // "fLaC"
  b[4] = 0x80; // last-metadata-block flag + type 0 (STREAMINFO)
  b[7] = 34; // block length
  const s = 8;
  // bytes 10..13 of STREAMINFO: 20-bit sample rate, 3-bit channels-1, 5-bit bps-1, 36-bit total samples
  b[s + 10] = (sampleRate >> 12) & 0xff;
  b[s + 11] = (sampleRate >> 4) & 0xff;
  b[s + 12] = ((sampleRate & 0x0f) << 4) | (((channels - 1) & 0x07) << 1) | (((bitDepth - 1) >> 4) & 0x01);
  b[s + 13] = ((bitDepth - 1) & 0x0f) << 4;
  return b;
}

function wavHeader(sampleRate: number, bitDepth: number, channels: number, extraChunk = false): Uint8Array {
  const parts: number[] = [];
  const str = (t: string) => [...t].forEach((c) => parts.push(c.charCodeAt(0)));
  const u32 = (n: number) => parts.push(n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff);
  const u16 = (n: number) => parts.push(n & 0xff, (n >> 8) & 0xff);
  str('RIFF');
  u32(1000);
  str('WAVE');
  if (extraChunk) {
    str('LIST');
    u32(5);
    parts.push(1, 2, 3, 4, 5, 0); // odd size + pad byte
  }
  str('fmt ');
  u32(16);
  u16(1);
  u16(channels);
  u32(sampleRate);
  u32((sampleRate * channels * bitDepth) / 8);
  u16((channels * bitDepth) / 8);
  u16(bitDepth);
  return new Uint8Array(parts);
}

/** 80-bit IEEE extended encoding of an integer sample rate (as AIFF stores it). */
function extended(n: number): number[] {
  const exp = Math.floor(Math.log2(n));
  const mant = BigInt(n) << BigInt(63 - exp);
  const e = exp + 16383;
  const out = [(e >> 8) & 0x7f, e & 0xff];
  for (let i = 7; i >= 0; i--) out.push(Number((mant >> BigInt(i * 8)) & 0xffn));
  return out;
}

function aiffHeader(sampleRate: number, bitDepth: number, channels: number): Uint8Array {
  const parts: number[] = [];
  const str = (t: string) => [...t].forEach((c) => parts.push(c.charCodeAt(0)));
  const u32 = (n: number) => parts.push((n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff);
  const u16 = (n: number) => parts.push((n >> 8) & 0xff, n & 0xff);
  str('FORM');
  u32(1000);
  str('AIFF');
  str('COMM');
  u32(18);
  u16(channels);
  u32(44100 * 60);
  u16(bitDepth);
  parts.push(...extended(sampleRate));
  return new Uint8Array(parts);
}

const v = (tier: AudioVariant['tier'], format: AudioFormat, extra: Partial<AudioVariant> = {}): AudioVariant => ({
  tier,
  format,
  url: `https://example.test/${tier}-${format}-${Math.random()}`,
  ...extra,
});

describe('parseAudioHeader', () => {
  it('reads FLAC STREAMINFO', () => {
    expect(parseAudioHeader(flacHeader(96000, 24, 2))).toEqual({ format: 'flac', sampleRate: 96000, bitDepth: 24, channels: 2 });
    expect(parseAudioHeader(flacHeader(44100, 16, 2))).toEqual({ format: 'flac', sampleRate: 44100, bitDepth: 16, channels: 2 });
    expect(parseAudioHeader(flacHeader(192000, 24, 1))).toEqual({ format: 'flac', sampleRate: 192000, bitDepth: 24, channels: 1 });
  });

  it('skips an ID3v2 tag in front of FLAC', () => {
    const id3 = new Uint8Array(10 + 20);
    id3.set([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 20]);
    const both = new Uint8Array(id3.length + 42);
    both.set(id3);
    both.set(flacHeader(88200, 24, 2), id3.length);
    expect(parseAudioHeader(both)?.sampleRate).toBe(88200);
  });

  it('walks WAV chunks to fmt', () => {
    expect(parseAudioHeader(wavHeader(44100, 16, 2))).toEqual({ format: 'wav', sampleRate: 44100, bitDepth: 16, channels: 2 });
    expect(parseAudioHeader(wavHeader(96000, 24, 2, true))).toEqual({ format: 'wav', sampleRate: 96000, bitDepth: 24, channels: 2 });
  });

  it('decodes the 80-bit AIFF sample rate', () => {
    expect(parseAudioHeader(aiffHeader(44100, 16, 2))).toEqual({ format: 'aiff', sampleRate: 44100, bitDepth: 16, channels: 2 });
    expect(parseAudioHeader(aiffHeader(176400, 24, 2))).toEqual({ format: 'aiff', sampleRate: 176400, bitDepth: 24, channels: 2 });
  });

  it('rejects unknown or truncated data', () => {
    expect(parseAudioHeader(new Uint8Array([0xff, 0xfb, 0x90, 0x64]))).toBeNull();
    expect(parseAudioHeader(flacHeader(44100, 16, 2).subarray(0, 20))).toBeNull();
  });
});

describe('tiers', () => {
  it('classifies by codec and sample rate', () => {
    expect(classify('mp3', 48000)).toBe('high');
    expect(classify('flac', 44100)).toBe('lossless');
    expect(classify('flac', 48000)).toBe('lossless');
    expect(classify('wav', 96000)).toBe('hires');
    expect(classify('flac')).toBe('lossless');
  });

  it('guesses formats from names and content types', () => {
    expect(formatFromName('track.FLAC')).toBe('flac');
    expect(formatFromName('x', 'audio/x-wav')).toBe('wav');
    expect(formatFromName('a.aif')).toBe('aiff');
    expect(formatFromName('', 'audio/mpeg')).toBe('mp3');
    expect(formatFromName('song.m4a')).toBe('aac');
  });

  it('only calls something Hi-Res once its header proves it', () => {
    const candidate = v('lossless', 'flac', { maybeHiRes: true, bitDepth: 24 });
    expect(bestTier([v('high', 'mp3'), candidate])).toBe('lossless');
    const verified = withSpecs(candidate, { format: 'flac', sampleRate: 96000, bitDepth: 24, channels: 2 });
    expect(verified).toMatchObject({ tier: 'hires', verified: true, maybeHiRes: false, sampleRate: 96000 });
    expect(bestTier([v('high', 'mp3'), verified])).toBe('hires');
    const cd = withSpecs(candidate, { format: 'flac', sampleRate: 48000, bitDepth: 24, channels: 2 });
    expect(cd.tier).toBe('lossless');
  });

  it('describes variants', () => {
    expect(variantDetail({ format: 'flac', bitDepth: 24, sampleRate: 96000 })).toBe('24-bit / 96 kHz FLAC');
    expect(variantDetail({ format: 'wav', bitDepth: 16, sampleRate: 44100 })).toBe('16-bit / 44.1 kHz WAV');
    expect(variantDetail({ format: 'mp3', bitrateKbps: 320 })).toBe('MP3 · 320 kbps');
    expect(variantDetail({ format: 'flac' })).toBe('FLAC');
  });
});

describe('rankVariants', () => {
  const all = new Set<AudioFormat>(['mp3', 'ogg', 'flac', 'wav', 'aiff']);
  const mp3 = v('high', 'mp3', { bitrateKbps: 320 });
  const mp3low = v('high', 'mp3', { bitrateKbps: 128 });
  const flac = v('lossless', 'flac', { verified: true, bitDepth: 16, sampleRate: 44100 });
  const hires = v('hires', 'flac', { verified: true, bitDepth: 24, sampleRate: 96000 });
  const maybe = v('lossless', 'flac', { maybeHiRes: true });

  it('High Quality prefers the best lossy file and uses lossless only as a last resort', () => {
    expect(rankVariants([hires, flac, mp3low, mp3], 'high', all)).toEqual([mp3, mp3low, flac, hires]);
    expect(rankVariants([hires, flac], 'high', all)[0]).toBe(flac);
  });

  it('Lossless prefers ≤48 kHz lossless, then Hi-Res, then lossy', () => {
    expect(rankVariants([mp3, hires, flac], 'lossless', all)).toEqual([flac, hires, mp3]);
    expect(rankVariants([mp3, hires], 'lossless', all)).toEqual([hires, mp3]);
  });

  it('Hi-Res prefers verified Hi-Res, then 24-bit candidates, then lossless', () => {
    expect(rankVariants([mp3, flac, maybe, hires], 'hires', all)).toEqual([hires, maybe, flac, mp3]);
    expect(rankVariants([mp3, flac, maybe], 'hires', all)[0]).toBe(maybe);
  });

  it('drops formats the browser cannot decode', () => {
    expect(rankVariants([flac, mp3], 'lossless', new Set<AudioFormat>(['mp3']))).toEqual([mp3]);
  });
});
