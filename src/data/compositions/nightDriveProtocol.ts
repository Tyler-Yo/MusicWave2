import type { Composition } from '@/audio/synth/types';

/**
 * "Night Drive Protocol" — Neon Cartographer. Synthwave (104 BPM).
 * Lyric test case: long INTRO (~18 s) and a 16-bar INSTRUMENTAL BREAK (~37 s guitar-synth solo).
 * Original lyrics © MusicWave demo content (written for this project).
 */
const chorus = [
  'Initiate the night drive protocol',
  'no destination, no control',
  'chrome and starlight, the engine sings',
  "we're riding out on electric wings",
];

export const nightDriveProtocol: Composition = {
  id: 'night-drive-protocol',
  bpm: 104,
  key: 'A',
  mode: 'minor',
  style: 'synthwave',
  vocal: { range: [57, 72], grid: 0.5, delivery: 'sung' },
  lrcFormat: 'enhanced',
  sections: [
    { name: 'Intro', type: 'intro', bars: 8, chords: ['i', 'VI', 'III', 'VII'], layers: ['pad', 'arp', 'bass', 'riser'], fill: true },
    {
      name: 'Verse 1',
      type: 'verse',
      bars: 8,
      chords: ['i', 'VI', 'III', 'VII'],
      layers: ['kick', 'snare', 'hats', 'bass', 'pad', 'vocal'],
      lines: [
        'Headlights cutting through the violet rain',
        'neon letters spelling out your name',
        "the city's running on a midnight code",
        "and I'm the only signal on the road",
      ],
      fill: true,
    },
    {
      name: 'Chorus 1',
      type: 'chorus',
      bars: 8,
      chords: ['VI', 'VII', 'i', 'i', 'VI', 'VII', 'III', 'III'],
      layers: ['kick', 'snare', 'hats', 'openhat', 'bass', 'pad', 'arp', 'vocal'],
      lines: chorus,
      fill: true,
    },
    {
      name: 'Solo',
      type: 'solo',
      bars: 16,
      chords: ['i', 'VI', 'III', 'VII'],
      layers: ['kick', 'snare', 'hats', 'toms', 'bass', 'pad', 'arp', 'lead'],
      fill: true,
    },
    {
      name: 'Verse 2',
      type: 'verse',
      bars: 8,
      chords: ['i', 'VI', 'III', 'VII'],
      layers: ['kick', 'snare', 'hats', 'bass', 'pad', 'arp', 'vocal'],
      lines: [
        'Rearview mirror full of fading lights',
        'a hundred billboards burning through the night',
        'the radio is whispering in code',
        'and every mile is a story left untold',
      ],
      fill: true,
    },
    {
      name: 'Chorus 2',
      type: 'chorus',
      bars: 8,
      chords: ['VI', 'VII', 'i', 'i', 'VI', 'VII', 'III', 'III'],
      layers: ['kick', 'snare', 'hats', 'openhat', 'bass', 'pad', 'arp', 'bell', 'vocal'],
      lines: chorus,
    },
    { name: 'Outro', type: 'outro', bars: 8, chords: ['i', 'VI', 'III', 'VII'], layers: ['pad', 'arp', 'lead'] },
  ],
};
