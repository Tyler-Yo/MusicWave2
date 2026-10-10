/**
 * Audio quality: tier classification, honest labels, header inspection and
 * variant selection.
 *
 * Tiers follow the common streaming definitions:
 *   High Quality      — lossy (MP3 / Ogg / AAC)
 *   Lossless          — lossless codec up to 48 kHz (16- or 24-bit)
 *   Hi-Res Lossless   — lossless above 48 kHz (24-bit)
 * A variant is only labelled Hi-Res when its sample rate is known to exceed 48 kHz.
 */
import type { AudioFormat, AudioVariant, QualityTier } from '@/types/music';

export const TIER_ORDER: QualityTier[] = ['high', 'lossless', 'hires'];
export const TIER_LABEL: Record<QualityTier, string> = {
  high: 'High Quality',
  lossless: 'Lossless',
  hires: 'Hi-Res Lossless',
};
export const TIER_SHORT: Record<QualityTier, string> = { high: 'HQ', lossless: 'Lossless', hires: 'Hi-Res' };

export const LOSSLESS_FORMATS: AudioFormat[] = ['flac', 'wav', 'aiff', 'alac'];

export function tierRank(t: QualityTier): number {
  return TIER_ORDER.indexOf(t);
}

export function formatFromName(name: string, contentType = ''): AudioFormat {
  const n = name.toLowerCase();
  const ct = contentType.toLowerCase();
  if (n.endsWith('.flac') || ct.includes('flac')) return 'flac';
  if (n.endsWith('.wav') || n.endsWith('.wave') || ct.includes('wav')) return 'wav';
  if (n.endsWith('.aif') || n.endsWith('.aiff') || ct.includes('aiff')) return 'aiff';
  if (n.endsWith('.m4a') && ct.includes('alac')) return 'alac';
  if (n.endsWith('.mp3') || ct.includes('mpeg') || ct.includes('mp3')) return 'mp3';
  if (n.endsWith('.ogg') || n.endsWith('.oga') || n.endsWith('.opus') || ct.includes('ogg')) return 'ogg';
  if (n.endsWith('.m4a') || n.endsWith('.aac') || ct.includes('aac') || ct.includes('mp4')) return 'aac';
  return 'unknown';
}

export function isLossless(format: AudioFormat): boolean {
  return LOSSLESS_FORMATS.includes(format);
}

/** Tier implied by a format and (optionally) its sample rate. */
export function classify(format: AudioFormat, sampleRate?: number): QualityTier {
  if (!isLossless(format)) return 'high';
  return sampleRate !== undefined && sampleRate > 48000 ? 'hires' : 'lossless';
}

export interface AudioSpecs {
  format: AudioFormat;
  sampleRate: number;
  bitDepth: number;
  channels: number;
}

function ascii(b: Uint8Array, at: number, len: number): string {
  return String.fromCharCode(...b.subarray(at, at + len));
}

/** Reads a big-endian IEEE 754 80-bit extended float (AIFF sample rate). */
function readExtended(b: Uint8Array, at: number): number {
  const expon = ((b[at] & 0x7f) << 8) | b[at + 1];
  let hi = 0;
  let lo = 0;
  for (let i = 0; i < 4; i++) hi = hi * 256 + b[at + 2 + i];
  for (let i = 0; i < 4; i++) lo = lo * 256 + b[at + 6 + i];
  if (expon === 0 && hi === 0 && lo === 0) return 0;
  const f = hi * Math.pow(2, expon - 16383 - 31) + lo * Math.pow(2, expon - 16383 - 63);
  return b[at] & 0x80 ? -f : f;
}

/**
 * Parses the first bytes of a FLAC, WAV or AIFF file and returns its real specs,
 * or null if the header is not recognized / incomplete.
 */
export function parseAudioHeader(bytes: Uint8Array): AudioSpecs | null {
  let b = bytes;
  // Skip an ID3v2 tag (some FLAC files carry one).
  if (b.length > 10 && ascii(b, 0, 3) === 'ID3') {
    const size = ((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f);
    b = b.subarray(10 + size);
  }
  if (b.length >= 42 && ascii(b, 0, 4) === 'fLaC') {
    // First metadata block must be STREAMINFO (type 0); its body starts at byte 8.
    if ((b[4] & 0x7f) !== 0) return null;
    const s = 8;
    const sampleRate = (b[s + 10] << 12) | (b[s + 11] << 4) | (b[s + 12] >> 4);
    const channels = ((b[s + 12] >> 1) & 0x07) + 1;
    const bitDepth = (((b[s + 12] & 0x01) << 4) | (b[s + 13] >> 4)) + 1;
    return sampleRate > 0 ? { format: 'flac', sampleRate, bitDepth, channels } : null;
  }
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WAVE') {
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let p = 12;
    while (p + 8 <= b.length) {
      const id = ascii(b, p, 4);
      const size = view.getUint32(p + 4, true);
      if (id === 'fmt ' && p + 24 <= b.length) {
        return {
          format: 'wav',
          channels: view.getUint16(p + 10, true),
          sampleRate: view.getUint32(p + 12, true),
          bitDepth: view.getUint16(p + 22, true),
        };
      }
      p += 8 + size + (size % 2);
    }
    return null;
  }
  if (b.length >= 12 && ascii(b, 0, 4) === 'FORM' && (ascii(b, 8, 4) === 'AIFF' || ascii(b, 8, 4) === 'AIFC')) {
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let p = 12;
    while (p + 8 <= b.length) {
      const id = ascii(b, p, 4);
      const size = view.getUint32(p + 4, false);
      if (id === 'COMM' && p + 26 <= b.length) {
        return {
          format: 'aiff',
          channels: view.getUint16(p + 8, false),
          bitDepth: view.getUint16(p + 14, false),
          sampleRate: Math.round(readExtended(b, p + 16)),
        };
      }
      p += 8 + size + (size % 2);
    }
  }
  return null;
}

/** "24-bit / 96 kHz FLAC", "16-bit / 44.1 kHz WAV", "MP3 · 320 kbps", "MP3". */
export function variantDetail(v: Pick<AudioVariant, 'format' | 'bitDepth' | 'sampleRate' | 'bitrateKbps'>): string {
  const codec = v.format === 'unknown' ? 'Audio' : v.format.toUpperCase();
  if (isLossless(v.format)) {
    const parts: string[] = [];
    if (v.bitDepth) parts.push(`${v.bitDepth}-bit`);
    if (v.sampleRate) parts.push(`${+(v.sampleRate / 1000).toFixed(1)} kHz`);
    return parts.length ? `${parts.join(' / ')} ${codec}` : codec;
  }
  return v.bitrateKbps ? `${codec} · ${Math.round(v.bitrateKbps)} kbps` : codec;
}

/** Applies inspected header specs to a variant (re-classifying its tier). */
export function withSpecs(v: AudioVariant, specs: AudioSpecs): AudioVariant {
  return {
    ...v,
    format: specs.format,
    sampleRate: specs.sampleRate,
    bitDepth: specs.bitDepth,
    channels: specs.channels,
    tier: classify(specs.format, specs.sampleRate),
    verified: true,
    maybeHiRes: false,
    needsInspection: false,
  };
}

/** Formats the browser can decode, checked once. */
let playable: Set<AudioFormat> | null = null;
export function playableFormats(): Set<AudioFormat> {
  if (playable) return playable;
  const set = new Set<AudioFormat>(['mp3']);
  if (typeof document !== 'undefined') {
    const a = document.createElement('audio');
    const can = (t: string) => a.canPlayType(t) !== '';
    if (can('audio/flac') || can('audio/x-flac')) set.add('flac');
    if (can('audio/wav') || can('audio/wave') || can('audio/x-wav')) set.add('wav');
    if (can('audio/aiff') || can('audio/x-aiff')) set.add('aiff');
    if (can('audio/ogg; codecs="vorbis"') || can('audio/ogg')) set.add('ogg');
    if (can('audio/mp4; codecs="mp4a.40.2"') || can('audio/aac')) set.add('aac');
    if (can('audio/mp4; codecs="alac"')) set.add('alac');
  } else {
    ['flac', 'wav', 'ogg', 'aac'].forEach((f) => set.add(f as AudioFormat));
  }
  playable = set;
  return set;
}

/**
 * Orders variants for a requested tier, best first:
 *  - High Quality:  lossy first; lossless only as a last resort (it costs more data).
 *  - Lossless:      lossless ≤ 48 kHz, then Hi-Res (still lossless), then lossy.
 *  - Hi-Res:        Hi-Res, then 24-bit candidates, then other lossless, then lossy.
 * Variants the browser cannot decode are dropped.
 */
export function rankVariants(variants: AudioVariant[], requested: QualityTier, formats = playableFormats()): AudioVariant[] {
  const want = tierRank(requested);
  const score = (v: AudioVariant) => {
    const r = tierRank(v.tier);
    let s: number;
    if (r <= want) s = r * 10;
    else if (requested === 'high') s = -10 - r;
    else s = want * 10 - 5;
    if (requested === 'hires' && v.maybeHiRes) s += 5;
    if (v.verified) s += 1;
    if (v.bitrateKbps) s += v.bitrateKbps / 1000;
    return s;
  };
  return variants
    .filter((v) => v.format === 'unknown' || formats.has(v.format))
    .slice()
    .sort((a, b) => score(b) - score(a));
}

/** Best tier a set of variants is known to reach (unverified 24-bit sources count as Lossless). */
export function bestTier(variants: AudioVariant[]): QualityTier {
  let best: QualityTier = 'high';
  for (const v of variants) if (tierRank(v.tier) > tierRank(best)) best = v.tier;
  return best;
}
