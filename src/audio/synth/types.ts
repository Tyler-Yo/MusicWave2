/**
 * Composition model for MusicWave's procedural, original demo tracks.
 *
 * A `Composition` is a compact musical score: tempo, key, a style preset, a list
 * of sections (chords + active layers) and — for songs — lyric lines. The
 * arrangement compiler (arrangement.ts) turns it into timed note events and
 * timed lyrics; the renderer (renderer.ts) turns events into audio.
 */
import type { ModeName } from './theory';
import type { Vowel } from '@/services/lrc/syllables';

export type DrumLayer = 'kick' | 'snare' | 'clap' | 'hats' | 'openhat' | 'shaker' | 'rim' | 'toms';
export type Layer = DrumLayer | 'bass' | 'pad' | 'keys' | 'pluck' | 'arp' | 'lead' | 'bell' | 'vocal' | 'crackle' | 'riser';

export type StyleName =
  | 'ballad'
  | 'boombap'
  | 'pop'
  | 'synthwave'
  | 'folk'
  | 'lofi'
  | 'ambient'
  | 'house'
  | 'chiptune'
  | 'cinematic'
  | 'jazzhop'
  | 'dnb';

export type SectionType = 'intro' | 'verse' | 'pre' | 'chorus' | 'bridge' | 'break' | 'solo' | 'outro' | 'drop' | 'build';

export interface LyricLineSpec {
  text: string;
  /** Bar within the section where the line starts (default: sequential). */
  bar?: number;
  /** Beat offset inside that bar; negative values create pickups. */
  beat?: number;
  /** Bars the line occupies (default: section.lineBars). */
  bars?: number;
}

export interface SectionSpec {
  name: string;
  type: SectionType;
  bars: number;
  /** One entry per bar (cycled). Two chords in a bar: "I V". */
  chords: string[];
  layers: Layer[];
  lines?: Array<string | LyricLineSpec>;
  /** Bars per lyric line (default 2). */
  lineBars?: number;
  /** Default beat offset for lyric lines in this section. */
  lineBeat?: number;
  /** Drum fill in the last bar. */
  fill?: boolean;
  /** Override the vocal grid (beats per syllable step) for this section — e.g. a sung hook in a rap song. */
  grid?: number;
  /** Override the vocal delivery for this section. */
  delivery?: 'sung' | 'rap';
}

export interface VocalSpec {
  /** MIDI range of the guide melody. */
  range: [number, number];
  /** Rhythmic grid in beats (0.5 = eighths, 0.25 = sixteenths). */
  grid: number;
  delivery: 'sung' | 'rap';
}

export interface Composition {
  id: string;
  bpm: number;
  key: string;
  mode: ModeName;
  style: StyleName;
  /** 0..0.5 — delays off-beat sixteenths. */
  swing?: number;
  sections: SectionSpec[];
  vocal?: VocalSpec;
  /** Lyric presentation in the generated LRC file. */
  lrcFormat?: 'enhanced' | 'standard';
}

export type Instrument =
  | 'kick'
  | 'snare'
  | 'clap'
  | 'hat'
  | 'openhat'
  | 'shaker'
  | 'rim'
  | 'tom'
  | 'crash'
  | 'bass'
  | 'pad'
  | 'keys'
  | 'pluck'
  | 'arp'
  | 'lead'
  | 'bell';

export interface NoteEvent {
  inst: Instrument;
  time: number;
  dur: number;
  midi: number;
  vel: number;
}

export interface VocalNote {
  time: number;
  dur: number;
  midi: number;
  vel: number;
  vowel: Vowel;
  noisyOnset: boolean;
}

export interface ComposedWord {
  text: string;
  start: number;
  end: number;
  trailingSpace: boolean;
}

export interface ComposedLine {
  text: string;
  start: number;
  end: number;
  words: ComposedWord[];
  section: string;
}

export interface SectionTiming {
  name: string;
  type: SectionType;
  start: number;
  end: number;
  layers: Layer[];
}

export interface Arrangement {
  /** Musical length in seconds (without reverb tail). */
  musicEnd: number;
  /** Total rendered length in seconds (music + tail). */
  duration: number;
  secondsPerBeat: number;
  events: NoteEvent[];
  vocal: VocalNote[];
  lines: ComposedLine[];
  sections: SectionTiming[];
  /** Times of riser sweeps: [start, end]. */
  risers: Array<[number, number]>;
  /** Kick times — used for sidechain "pumping". */
  kicks: number[];
}
