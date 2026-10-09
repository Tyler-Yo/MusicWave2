import type { Composition } from '@/audio/synth/types';

/**
 * "Harbor Lights" — Wren & the Lowlands. Acoustic folk (86 BPM).
 * Lyric test case: STANDARD (line-level) LRC with compressed repeated choruses
 * (`[t1][t2][t3]line`) and an 8-bar instrumental break — exercises interpolated word progress.
 * Original lyrics © MusicWave demo content (written for this project).
 */
const chorus = [
  'So leave the harbor lights on',
  'leave them burning through the night',
  "no matter how far I've gone",
  "I'll be steering by your light",
];

export const harborLights: Composition = {
  id: 'harbor-lights',
  bpm: 86,
  key: 'G',
  mode: 'major',
  style: 'folk',
  vocal: { range: [57, 71], grid: 0.5, delivery: 'sung' },
  lrcFormat: 'standard',
  sections: [
    { name: 'Intro', type: 'intro', bars: 4, chords: ['I', 'IV', 'I', 'V'], layers: ['pluck'] },
    {
      name: 'Verse 1',
      type: 'verse',
      bars: 8,
      chords: ['I', 'IV', 'I', 'V', 'I', 'IV', 'V', 'I'],
      layers: ['pluck', 'bass', 'vocal'],
      lines: [
        'My father built a boat of pine',
        'he sanded every board by hand',
        'he said the sea will keep its time',
        'but you will always know the land',
      ],
    },
    {
      name: 'Chorus 1',
      type: 'chorus',
      bars: 8,
      chords: ['IV', 'I', 'V', 'vi', 'IV', 'I', 'V', 'I'],
      layers: ['pluck', 'bass', 'kick', 'clap', 'shaker', 'vocal'],
      lines: chorus,
    },
    {
      name: 'Verse 2',
      type: 'verse',
      bars: 8,
      chords: ['I', 'IV', 'I', 'V', 'I', 'IV', 'V', 'I'],
      layers: ['pluck', 'bass', 'shaker', 'vocal'],
      lines: [
        'I sailed beyond the northern bay',
        'where all the maps run out of names',
        'the stars were strangers on the way',
        'but every lighthouse looked the same',
      ],
    },
    {
      name: 'Chorus 2',
      type: 'chorus',
      bars: 8,
      chords: ['IV', 'I', 'V', 'vi', 'IV', 'I', 'V', 'I'],
      layers: ['pluck', 'bass', 'kick', 'clap', 'shaker', 'pad', 'vocal'],
      lines: chorus,
      fill: true,
    },
    {
      name: 'Instrumental',
      type: 'solo',
      bars: 8,
      chords: ['I', 'IV', 'I', 'V', 'vi', 'IV', 'V', 'I'],
      layers: ['pluck', 'bass', 'kick', 'shaker', 'toms', 'lead', 'bell'],
    },
    {
      name: 'Verse 3',
      type: 'verse',
      bars: 8,
      chords: ['I', 'IV', 'I', 'V', 'I', 'IV', 'V', 'I'],
      layers: ['pluck', 'bass', 'pad', 'vocal'],
      lines: [
        'Now my own hair is turning gray',
        'I sand the boards the way he showed',
        "and when you're ready, sail away",
        "I'll keep the light on down the road",
      ],
    },
    {
      name: 'Chorus 3',
      type: 'chorus',
      bars: 8,
      chords: ['IV', 'I', 'V', 'vi', 'IV', 'I', 'V', 'I'],
      layers: ['pluck', 'bass', 'kick', 'clap', 'shaker', 'pad', 'bell', 'vocal'],
      lines: chorus,
    },
    { name: 'Outro', type: 'outro', bars: 4, chords: ['IV', 'I', 'V', 'I'], layers: ['pluck', 'pad'] },
  ],
};
