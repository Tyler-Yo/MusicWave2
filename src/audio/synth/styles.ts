/**
 * Style presets: groove patterns, instrument patches and mix settings per genre.
 *
 * Pattern strings are one bar of sixteenth steps (16 chars). Drum velocity:
 *   X = accent, x = normal, o = soft, g = ghost, . = rest
 * Bass: R root, 5 fifth, 3 third, O octave, N approach to next chord, - tie, . rest
 * Keys / pluck: X/x hit (D/U = down/up strum for pluck), - tie, . rest
 */
import type { DrumLayer, StyleName } from './types';

export type BassPatch = 'sub' | 'saw' | 'square' | 'reese' | 'triangle' | 'pluck';
export type PadPatch = 'warm' | 'glass' | 'strings' | 'choir' | 'organ';
export type KeysPatch = 'epiano' | 'piano' | 'organ' | 'chip';
export type LeadPatch = 'saw' | 'square' | 'flute' | 'sine';
export type ArpPatch = 'saw' | 'square' | 'bell' | 'pluck';

export interface StylePreset {
  drums: Partial<Record<DrumLayer, string[]>>;
  /** Chip-tune style drum synthesis. */
  chipDrums?: boolean;
  bass: { pattern: string[]; low: number; patch: BassPatch; cutoff: number };
  keys?: { pattern: string[]; mode: 'block' | 'broken'; center: number; patch: KeysPatch; voices?: number };
  pad: { patch: PadPatch; center: number; cutoff: number };
  pluck?: { pattern: string[]; center: number };
  arp?: { order: 'up' | 'down' | 'updown' | 'played'; rate: 0.25 | 0.5 | 1; octaves: number; patch: ArpPatch; center: number };
  lead: { patch: LeadPatch; range: [number, number]; grid: number; density: number };
  bell?: { density: number; center: number };
  /** Linear gains per bus. */
  mix: {
    drums: number;
    bass: number;
    pad: number;
    keys: number;
    pluck: number;
    arp: number;
    lead: number;
    bell: number;
    vocal: number;
  };
  reverb: { seconds: number; wet: number };
  delay: { beats: number; feedback: number; wet: number };
  /** Sidechain-style ducking depth (0..1) of pads/keys on every kick. */
  pump?: number;
  /** Lo-fi master: low-pass + vinyl crackle. */
  lofi?: boolean;
  /** Humanize timing jitter in seconds. */
  humanize: number;
}

const baseMix = { drums: 0.9, bass: 0.8, pad: 0.32, keys: 0.5, pluck: 0.55, arp: 0.3, lead: 0.42, bell: 0.28, vocal: 0.74 };

export const STYLES: Record<StyleName, StylePreset> = {
  ballad: {
    drums: {
      kick: ['X.......x.......', 'X.......x..o....'],
      rim: ['....x.......x...'],
      snare: ['....X.......X...'],
      shaker: ['o.g.o.g.o.g.o.g.'],
      hats: ['x.o.x.o.x.o.x.o.'],
      toms: ['............x.x.'],
    },
    bass: { pattern: ['R-------R---5---'], low: 29, patch: 'sub', cutoff: 400 },
    keys: { pattern: ['x.x.x.x.x.x.x.x.'], mode: 'broken', center: 62, patch: 'piano' },
    pad: { patch: 'strings', center: 64, cutoff: 1600 },
    bell: { density: 0.18, center: 84 },
    lead: { patch: 'flute', range: [67, 81], grid: 0.5, density: 0.55 },
    mix: { ...baseMix, drums: 0.55, keys: 0.62, pad: 0.3, vocal: 0.78 },
    reverb: { seconds: 3.6, wet: 0.34 },
    delay: { beats: 0.75, feedback: 0.28, wet: 0.14 },
    humanize: 0.006,
  },
  boombap: {
    drums: {
      kick: ['X.....x...X.....', 'X.....x..X..x...'],
      snare: ['....X.......X...', '....X.......X..g'],
      hats: ['x.o.x.o.x.oxx.o.', 'x.o.x.o.x.o.x.ox'],
      openhat: ['..............x.'],
    },
    bass: { pattern: ['R-....R-..R-..5-', 'R-....R-.R-.O-..'], low: 31, patch: 'sub', cutoff: 380 },
    keys: { pattern: ['X-----..x-....x-', 'X------.x-..x---'], mode: 'block', center: 62, patch: 'epiano' },
    pad: { patch: 'warm', center: 60, cutoff: 900 },
    bell: { density: 0.12, center: 79 },
    lead: { patch: 'flute', range: [65, 79], grid: 0.5, density: 0.5 },
    mix: { ...baseMix, drums: 1.0, bass: 0.95, keys: 0.45, pad: 0.22, vocal: 1.25 },
    reverb: { seconds: 1.6, wet: 0.16 },
    delay: { beats: 0.5, feedback: 0.25, wet: 0.08 },
    lofi: true,
    humanize: 0.008,
  },
  pop: {
    drums: {
      kick: ['X.....x.X.....x.', 'X.....x.X...x...'],
      clap: ['....X.......X...'],
      snare: ['....X.......X...'],
      hats: ['..x...x...x...x.'],
      shaker: ['xoxoxoxoxoxoxoxo'],
      openhat: ['..............x.'],
    },
    bass: { pattern: ['R.R.R.R.R.R.R.RO', 'R.R.R.R.R.R.5.N.'], low: 33, patch: 'pluck', cutoff: 900 },
    keys: { pattern: ['X.....X.....X...', 'X.....X...X.X...'], mode: 'block', center: 64, patch: 'epiano' },
    pluck: { pattern: ['D...D.U...U.D.U.'], center: 55 },
    pad: { patch: 'warm', center: 64, cutoff: 1800 },
    arp: { order: 'up', rate: 0.25, octaves: 2, patch: 'bell', center: 72 },
    bell: { density: 0.15, center: 84 },
    lead: { patch: 'square', range: [69, 83], grid: 0.5, density: 0.6 },
    mix: { ...baseMix, keys: 0.36, pluck: 0.45, arp: 0.18 },
    reverb: { seconds: 2.2, wet: 0.22 },
    delay: { beats: 0.75, feedback: 0.3, wet: 0.12 },
    pump: 0.3,
    humanize: 0.003,
  },
  synthwave: {
    drums: {
      kick: ['X.......X.......', 'X.......X.x.....'],
      snare: ['....X.......X...'],
      hats: ['x.x.x.x.x.x.x.x.'],
      toms: ['........x.x.X.X.'],
      openhat: ['..x...x...x...x.'],
    },
    bass: { pattern: ['R.R.R.R.R.R.R.R.', 'R.R.R.R.O.R.R.R.'], low: 33, patch: 'saw', cutoff: 700 },
    pad: { patch: 'warm', center: 64, cutoff: 2200 },
    arp: { order: 'updown', rate: 0.25, octaves: 2, patch: 'saw', center: 64 },
    lead: { patch: 'saw', range: [69, 86], grid: 0.5, density: 0.7 },
    bell: { density: 0.1, center: 84 },
    mix: { ...baseMix, pad: 0.36, arp: 0.24, lead: 0.4 },
    reverb: { seconds: 3.0, wet: 0.3 },
    delay: { beats: 0.75, feedback: 0.38, wet: 0.2 },
    pump: 0.25,
    humanize: 0,
  },
  folk: {
    drums: {
      kick: ['X.......X.......', 'X.......X...x...'],
      clap: ['....x.......x...'],
      shaker: ['x.oxx.oxx.oxx.ox'],
      toms: ['X.......X..x....'],
    },
    bass: { pattern: ['R-------5-------', 'R-------3---5---'], low: 31, patch: 'triangle', cutoff: 600 },
    pluck: { pattern: ['D...D.U...U.D.U.', 'D...D.U...U.D.UU'], center: 52 },
    pad: { patch: 'strings', center: 62, cutoff: 1500 },
    bell: { density: 0.22, center: 79 },
    lead: { patch: 'flute', range: [67, 81], grid: 0.5, density: 0.55 },
    mix: { ...baseMix, drums: 0.6, pluck: 0.7, pad: 0.24 },
    reverb: { seconds: 2.4, wet: 0.24 },
    delay: { beats: 0.75, feedback: 0.2, wet: 0.08 },
    humanize: 0.007,
  },
  lofi: {
    drums: {
      kick: ['X......x..X.....', 'X.........X..x..'],
      snare: ['....X.......X...'],
      hats: ['x.x.x.x.x.x.x.xo', 'x.x.x.x.x.x.xox.'],
    },
    bass: { pattern: ['R-------R---5---', 'R-----R-....3-5-'], low: 31, patch: 'sub', cutoff: 380 },
    keys: { pattern: ['X-------.....x--', 'X------...x-----'], mode: 'block', center: 62, patch: 'epiano', voices: 5 },
    pad: { patch: 'warm', center: 60, cutoff: 700 },
    bell: { density: 0.16, center: 79 },
    lead: { patch: 'sine', range: [67, 79], grid: 0.5, density: 0.4 },
    mix: { ...baseMix, keys: 0.6, pad: 0.2, drums: 0.8 },
    reverb: { seconds: 2.2, wet: 0.24 },
    delay: { beats: 0.75, feedback: 0.3, wet: 0.12 },
    lofi: true,
    humanize: 0.01,
  },
  ambient: {
    drums: {},
    bass: { pattern: ['R---------------'], low: 31, patch: 'sub', cutoff: 300 },
    pad: { patch: 'glass', center: 62, cutoff: 2600 },
    arp: { order: 'played', rate: 1, octaves: 2, patch: 'bell', center: 72 },
    bell: { density: 0.3, center: 79 },
    lead: { patch: 'sine', range: [72, 86], grid: 1, density: 0.35 },
    mix: { ...baseMix, pad: 0.5, arp: 0.2, bell: 0.25 },
    reverb: { seconds: 6, wet: 0.5 },
    delay: { beats: 1.5, feedback: 0.45, wet: 0.22 },
    humanize: 0,
  },
  house: {
    drums: {
      kick: ['X...X...X...X...'],
      clap: ['....X.......X...'],
      hats: ['..X...X...X...X.'],
      shaker: ['xoxoxoxoxoxoxoxo'],
      openhat: ['..x...x...x...x.'],
    },
    bass: { pattern: ['..R...R...R...R.', '..R...R...R..RO.'], low: 33, patch: 'square', cutoff: 650 },
    keys: { pattern: ['X..X..X...X..X..', 'X..X..X...X.X...'], mode: 'block', center: 62, patch: 'organ' },
    pad: { patch: 'warm', center: 64, cutoff: 2000 },
    arp: { order: 'up', rate: 0.25, octaves: 2, patch: 'pluck', center: 72 },
    lead: { patch: 'square', range: [69, 84], grid: 0.5, density: 0.55 },
    mix: { ...baseMix, keys: 0.42, arp: 0.2 },
    reverb: { seconds: 1.8, wet: 0.18 },
    delay: { beats: 0.75, feedback: 0.3, wet: 0.12 },
    pump: 0.55,
    humanize: 0,
  },
  chiptune: {
    drums: {
      kick: ['X.......X.X.....', 'X.....X.X.......'],
      snare: ['....X.......X...'],
      hats: ['x.x.x.x.x.x.x.x.'],
    },
    chipDrums: true,
    bass: { pattern: ['R.R.O.R.R.R.O.R.', 'R.R.O.R.5.5.O.5.'], low: 33, patch: 'triangle', cutoff: 3000 },
    keys: { pattern: ['X.X.X.X.X.X.X.X.'], mode: 'broken', center: 64, patch: 'chip' },
    pad: { patch: 'organ', center: 64, cutoff: 1500 },
    arp: { order: 'up', rate: 0.25, octaves: 2, patch: 'square', center: 72 },
    lead: { patch: 'square', range: [72, 88], grid: 0.25, density: 0.7 },
    mix: { ...baseMix, keys: 0.22, pad: 0.12, arp: 0.18, lead: 0.32, bass: 0.7 },
    reverb: { seconds: 1.2, wet: 0.1 },
    delay: { beats: 0.375, feedback: 0.25, wet: 0.1 },
    humanize: 0,
  },
  cinematic: {
    drums: {
      toms: ['X.....x.X...x...', 'X.....x.X.x.X.x.'],
      kick: ['X.......X.......'],
      snare: ['............X...'],
    },
    bass: { pattern: ['R---------------'], low: 26, patch: 'sub', cutoff: 300 },
    keys: { pattern: ['x...x...x...x...'], mode: 'broken', center: 60, patch: 'piano' },
    pad: { patch: 'strings', center: 60, cutoff: 1800 },
    arp: { order: 'updown', rate: 0.5, octaves: 2, patch: 'pluck', center: 67 },
    bell: { density: 0.2, center: 84 },
    lead: { patch: 'flute', range: [67, 84], grid: 1, density: 0.5 },
    mix: { ...baseMix, pad: 0.46, drums: 0.8 },
    reverb: { seconds: 4.5, wet: 0.4 },
    delay: { beats: 1, feedback: 0.25, wet: 0.08 },
    humanize: 0.004,
  },
  jazzhop: {
    drums: {
      kick: ['X......x.xX.....', 'X.........X..x..'],
      snare: ['....X.......X..g', '....X..g....X...'],
      hats: ['x.oxx.oxx.oxx.ox'],
      rim: ['..........g.....'],
    },
    bass: { pattern: ['R---3---5---N---', 'R---5---O---N---'], low: 31, patch: 'triangle', cutoff: 700 },
    keys: { pattern: ['X-----x-..x-----', '..X-----x-....x-'], mode: 'block', center: 62, patch: 'epiano', voices: 5 },
    pad: { patch: 'warm', center: 60, cutoff: 800 },
    lead: { patch: 'flute', range: [67, 81], grid: 0.5, density: 0.55 },
    bell: { density: 0.1, center: 79 },
    mix: { ...baseMix, keys: 0.55, lead: 0.36 },
    reverb: { seconds: 2.0, wet: 0.2 },
    delay: { beats: 0.75, feedback: 0.3, wet: 0.1 },
    lofi: true,
    humanize: 0.009,
  },
  dnb: {
    drums: {
      kick: ['X.........X.....', 'X.........X..x..'],
      snare: ['....X.......X...', '....X..g....X.g.'],
      hats: ['x.o.x.o.x.o.x.o.', 'x.oox.o.x.o.xoo.'],
      shaker: ['xoxoxoxoxoxoxoxo'],
    },
    bass: { pattern: ['R-------R---5---', 'R-------O---R-N-'], low: 29, patch: 'reese', cutoff: 520 },
    pad: { patch: 'glass', center: 64, cutoff: 2400 },
    arp: { order: 'updown', rate: 0.25, octaves: 2, patch: 'bell', center: 72 },
    lead: { patch: 'saw', range: [69, 84], grid: 0.5, density: 0.5 },
    bell: { density: 0.12, center: 84 },
    mix: { ...baseMix, pad: 0.34, arp: 0.16, bass: 0.75 },
    reverb: { seconds: 2.8, wet: 0.26 },
    delay: { beats: 0.75, feedback: 0.35, wet: 0.12 },
    pump: 0.2,
    humanize: 0,
  },
};
