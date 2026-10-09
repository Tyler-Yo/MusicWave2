import type { Composition } from '@/audio/synth/types';

/** Original instrumental compositions, rendered in the browser with the Web Audio API. */

export const rainyWindowStudy: Composition = {
  id: 'rainy-window-study',
  bpm: 78,
  key: 'F',
  mode: 'major',
  style: 'lofi',
  swing: 0.18,
  sections: [
    { name: 'Intro', type: 'intro', bars: 4, chords: ['ii7', 'V9', 'Imaj7', 'vi7'], layers: ['keys'] },
    { name: 'A', type: 'verse', bars: 16, chords: ['ii7', 'V9', 'Imaj7', 'vi7'], layers: ['kick', 'snare', 'hats', 'bass', 'keys'], fill: true },
    { name: 'B', type: 'chorus', bars: 8, chords: ['IVmaj7', 'iii7', 'ii7', 'V9'], layers: ['kick', 'snare', 'hats', 'bass', 'keys', 'lead'] },
    { name: 'A2', type: 'verse', bars: 16, chords: ['ii7', 'V9', 'Imaj7', 'vi7'], layers: ['kick', 'snare', 'hats', 'bass', 'keys', 'bell'] },
    { name: 'Outro', type: 'outro', bars: 4, chords: ['ii7', 'V9', 'Imaj7', 'Imaj7'], layers: ['keys', 'pad'] },
  ],
};

export const tidalMemory: Composition = {
  id: 'tidal-memory',
  bpm: 60,
  key: 'D',
  mode: 'lydian',
  style: 'ambient',
  sections: [
    { name: 'Intro', type: 'intro', bars: 4, chords: ['I', 'II'], layers: ['pad'] },
    { name: 'A', type: 'verse', bars: 8, chords: ['I', 'II', 'vi', 'II'], layers: ['pad', 'bell', 'bass'] },
    { name: 'B', type: 'chorus', bars: 8, chords: ['IV', 'I', 'II', 'vi'], layers: ['pad', 'arp', 'bell', 'bass', 'lead'] },
    { name: 'A2', type: 'verse', bars: 8, chords: ['I', 'II', 'vi', 'II'], layers: ['pad', 'arp', 'bell', 'bass'] },
    { name: 'Outro', type: 'outro', bars: 4, chords: ['I', 'I'], layers: ['pad', 'bell'] },
  ],
};

export const staticBloom: Composition = {
  id: 'static-bloom',
  bpm: 124,
  key: 'C',
  mode: 'dorian',
  style: 'house',
  sections: [
    { name: 'Intro', type: 'intro', bars: 8, chords: ['i7', 'IV7'], layers: ['kick', 'hats'] },
    { name: 'Build', type: 'build', bars: 8, chords: ['i7', 'IV7'], layers: ['kick', 'hats', 'shaker', 'bass', 'pad'], fill: true },
    { name: 'Drop', type: 'drop', bars: 16, chords: ['i7', 'IV7', 'i7', 'VII'], layers: ['kick', 'clap', 'hats', 'openhat', 'shaker', 'bass', 'pad', 'keys', 'arp'] },
    { name: 'Break', type: 'break', bars: 8, chords: ['VI', 'VII', 'i7', 'i7'], layers: ['pad', 'keys', 'riser'], fill: true },
    { name: 'Drop 2', type: 'drop', bars: 16, chords: ['i7', 'IV7', 'i7', 'VII'], layers: ['kick', 'clap', 'hats', 'openhat', 'shaker', 'bass', 'pad', 'keys', 'arp', 'lead'] },
    { name: 'Outro', type: 'outro', bars: 8, chords: ['i7', 'IV7'], layers: ['kick', 'hats', 'pad'] },
  ],
};

export const cartridgeHearts: Composition = {
  id: 'cartridge-hearts',
  bpm: 140,
  key: 'C',
  mode: 'major',
  style: 'chiptune',
  sections: [
    { name: 'Intro', type: 'intro', bars: 4, chords: ['I', 'vi', 'IV', 'V'], layers: ['arp'] },
    { name: 'A', type: 'verse', bars: 16, chords: ['I', 'vi', 'IV', 'V'], layers: ['kick', 'snare', 'hats', 'bass', 'lead', 'keys'], fill: true },
    { name: 'B', type: 'chorus', bars: 8, chords: ['IV', 'V', 'iii', 'vi'], layers: ['kick', 'snare', 'hats', 'bass', 'lead', 'arp'] },
    { name: 'A2', type: 'verse', bars: 16, chords: ['I', 'vi', 'IV', 'V'], layers: ['kick', 'snare', 'hats', 'bass', 'lead', 'keys', 'arp'], fill: true },
    { name: 'B2', type: 'chorus', bars: 8, chords: ['IV', 'V', 'iii', 'vi'], layers: ['kick', 'snare', 'hats', 'bass', 'lead', 'arp', 'pad'] },
    { name: 'A3', type: 'verse', bars: 16, chords: ['I', 'vi', 'IV', 'V'], layers: ['kick', 'snare', 'hats', 'bass', 'lead', 'keys'] },
    { name: 'Outro', type: 'outro', bars: 4, chords: ['IV', 'V', 'I', 'I'], layers: ['arp', 'bass'] },
  ],
};

export const theLongMeridian: Composition = {
  id: 'the-long-meridian',
  bpm: 72,
  key: 'D',
  mode: 'minor',
  style: 'cinematic',
  sections: [
    { name: 'Intro', type: 'intro', bars: 4, chords: ['i', 'VI'], layers: ['pad'] },
    { name: 'A', type: 'verse', bars: 8, chords: ['i', 'VI', 'III', 'VII'], layers: ['pad', 'keys', 'bass'] },
    { name: 'B', type: 'build', bars: 8, chords: ['VI', 'VII', 'i', 'v'], layers: ['pad', 'keys', 'toms', 'bass', 'bell'], fill: true },
    { name: 'C', type: 'chorus', bars: 8, chords: ['i', 'VI', 'III', 'VII'], layers: ['pad', 'toms', 'kick', 'snare', 'arp', 'bass', 'lead'], fill: true },
    { name: 'D', type: 'chorus', bars: 8, chords: ['VI', 'VII', 'III', 'i'], layers: ['pad', 'toms', 'kick', 'snare', 'arp', 'bass', 'lead', 'bell'] },
    { name: 'Outro', type: 'outro', bars: 4, chords: ['VI', 'i'], layers: ['pad', 'bell'] },
  ],
};

export const blueHourWalk: Composition = {
  id: 'blue-hour-walk',
  bpm: 88,
  key: 'Bb',
  mode: 'major',
  style: 'jazzhop',
  swing: 0.22,
  sections: [
    { name: 'Intro', type: 'intro', bars: 4, chords: ['ii7', 'V7', 'Imaj7', 'vi7'], layers: ['keys', 'hats'] },
    { name: 'A', type: 'verse', bars: 16, chords: ['ii7', 'V7', 'Imaj7', 'vi7'], layers: ['kick', 'snare', 'hats', 'rim', 'bass', 'keys'], fill: true },
    { name: 'B', type: 'chorus', bars: 8, chords: ['IVmaj7', 'iii7', 'ii7', 'V7'], layers: ['kick', 'snare', 'hats', 'bass', 'keys', 'lead'] },
    { name: 'A2', type: 'verse', bars: 16, chords: ['ii7', 'V7', 'Imaj7', 'vi7'], layers: ['kick', 'snare', 'hats', 'bass', 'keys', 'lead', 'bell'] },
    { name: 'Outro', type: 'outro', bars: 4, chords: ['ii7', 'V7', 'Imaj7', 'Imaj7'], layers: ['keys', 'bass'] },
  ],
};

export const undercurrent: Composition = {
  id: 'undercurrent',
  bpm: 172,
  key: 'F',
  mode: 'minor',
  style: 'dnb',
  sections: [
    { name: 'Intro', type: 'intro', bars: 8, chords: ['i', 'VI', 'III', 'VII'], layers: ['pad', 'arp'] },
    { name: 'Build', type: 'build', bars: 8, chords: ['i', 'VI', 'III', 'VII'], layers: ['pad', 'arp', 'hats', 'riser'], fill: true },
    { name: 'Drop', type: 'drop', bars: 24, chords: ['i', 'i', 'VI', 'VII'], layers: ['kick', 'snare', 'hats', 'shaker', 'bass', 'pad', 'arp'], fill: true },
    { name: 'Break', type: 'break', bars: 8, chords: ['VI', 'VII', 'i', 'i'], layers: ['pad', 'bell', 'arp'] },
    { name: 'Drop 2', type: 'drop', bars: 24, chords: ['i', 'i', 'VI', 'VII'], layers: ['kick', 'snare', 'hats', 'shaker', 'bass', 'pad', 'lead'] },
    { name: 'Outro', type: 'outro', bars: 8, chords: ['i', 'VI'], layers: ['pad', 'arp'] },
  ],
};

export const morningKettle: Composition = {
  id: 'morning-kettle',
  bpm: 84,
  key: 'A',
  mode: 'major',
  style: 'lofi',
  swing: 0.16,
  sections: [
    { name: 'Intro', type: 'intro', bars: 4, chords: ['IVmaj7', 'iii7', 'ii7', 'Imaj7'], layers: ['keys', 'bell'] },
    { name: 'A', type: 'verse', bars: 16, chords: ['IVmaj7', 'iii7', 'ii7', 'Imaj7'], layers: ['kick', 'snare', 'hats', 'bass', 'keys'], fill: true },
    { name: 'B', type: 'chorus', bars: 8, chords: ['vi7', 'V9', 'IVmaj7', 'Imaj7'], layers: ['kick', 'snare', 'hats', 'bass', 'keys', 'lead', 'pad'] },
    { name: 'A2', type: 'verse', bars: 16, chords: ['IVmaj7', 'iii7', 'ii7', 'Imaj7'], layers: ['kick', 'snare', 'hats', 'bass', 'keys', 'bell'] },
    { name: 'Outro', type: 'outro', bars: 4, chords: ['IVmaj7', 'Imaj7'], layers: ['keys'] },
  ],
};

export const glassAurora: Composition = {
  id: 'glass-aurora',
  bpm: 66,
  key: 'E',
  mode: 'dorian',
  style: 'ambient',
  sections: [
    { name: 'Intro', type: 'intro', bars: 4, chords: ['i9', 'IV'], layers: ['pad', 'bell'] },
    { name: 'A', type: 'verse', bars: 8, chords: ['i9', 'IV', 'i9', 'VII'], layers: ['pad', 'arp', 'bass'] },
    { name: 'B', type: 'chorus', bars: 8, chords: ['III', 'VII', 'IV', 'i9'], layers: ['pad', 'arp', 'bell', 'bass', 'lead'] },
    { name: 'A2', type: 'verse', bars: 8, chords: ['i9', 'IV', 'i9', 'VII'], layers: ['pad', 'bell', 'bass'] },
    { name: 'Outro', type: 'outro', bars: 4, chords: ['i9', 'i9'], layers: ['pad'] },
  ],
};

export const coastlineArcade: Composition = {
  id: 'coastline-arcade',
  bpm: 100,
  key: 'E',
  mode: 'minor',
  style: 'synthwave',
  sections: [
    { name: 'Intro', type: 'intro', bars: 8, chords: ['i', 'VI', 'III', 'VII'], layers: ['arp', 'pad'] },
    { name: 'A', type: 'verse', bars: 16, chords: ['i', 'VI', 'III', 'VII'], layers: ['kick', 'snare', 'hats', 'bass', 'arp', 'pad', 'lead'], fill: true },
    { name: 'B', type: 'bridge', bars: 8, chords: ['VI', 'VII', 'i', 'i'], layers: ['pad', 'arp', 'bell', 'toms', 'riser'], fill: true },
    { name: 'A2', type: 'chorus', bars: 16, chords: ['i', 'VI', 'III', 'VII'], layers: ['kick', 'snare', 'hats', 'openhat', 'bass', 'arp', 'pad', 'lead'] },
    { name: 'Outro', type: 'outro', bars: 8, chords: ['i', 'VI', 'III', 'VII'], layers: ['arp', 'pad'] },
  ],
};

export const lanternReprise: Composition = {
  id: 'lantern-reprise',
  bpm: 70,
  key: 'F',
  mode: 'major',
  style: 'ballad',
  sections: [
    { name: 'Intro', type: 'intro', bars: 4, chords: ['I', 'V', 'vi', 'IV'], layers: ['keys'] },
    { name: 'A', type: 'verse', bars: 8, chords: ['I', 'V', 'vi', 'IV'], layers: ['keys', 'pad', 'bass'] },
    { name: 'B', type: 'chorus', bars: 8, chords: ['IV', 'I', 'V', 'vi', 'IV', 'I', 'V', 'I'], layers: ['keys', 'pad', 'bass', 'lead', 'shaker'] },
    { name: 'A2', type: 'verse', bars: 8, chords: ['I', 'V', 'vi', 'IV'], layers: ['keys', 'pad', 'bell'] },
    { name: 'Outro', type: 'outro', bars: 4, chords: ['IV', 'V', 'I', 'I'], layers: ['keys', 'pad'] },
  ],
};
