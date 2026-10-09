import type { Composition } from '@/audio/synth/types';

/**
 * "Paper Lanterns" — Lumen Vale. A slow piano ballad (70 BPM).
 * Lyric test case: SLOW song, long held notes, three identical choruses.
 * Original lyrics © MusicWave demo content (written for this project).
 */
const chorus = [
  'Paper lanterns, carry me home',
  'over the water, under the stars',
  'if I get lost in the long and the low',
  'follow the light to wherever you are',
];

export const paperLanterns: Composition = {
  id: 'paper-lanterns',
  bpm: 70,
  key: 'F',
  mode: 'major',
  style: 'ballad',
  vocal: { range: [60, 74], grid: 0.5, delivery: 'sung' },
  lrcFormat: 'enhanced',
  sections: [
    { name: 'Intro', type: 'intro', bars: 4, chords: ['I', 'V', 'vi', 'IV'], layers: ['keys', 'pad'] },
    {
      name: 'Verse 1',
      type: 'verse',
      bars: 8,
      chords: ['I', 'V', 'vi', 'IV'],
      layers: ['keys', 'bass', 'vocal'],
      lines: [
        'We folded wishes out of paper',
        'and set them drifting on the tide',
        'each little flame a quiet promise',
        'that we would find the other side',
      ],
    },
    {
      name: 'Chorus 1',
      type: 'chorus',
      bars: 8,
      chords: ['IV', 'I', 'V', 'vi', 'IV', 'I', 'V', 'I'],
      layers: ['keys', 'pad', 'bass', 'kick', 'rim', 'shaker', 'bell', 'vocal'],
      lines: chorus,
      fill: true,
    },
    { name: 'Interlude', type: 'break', bars: 2, chords: ['I', 'V'], layers: ['keys', 'pad', 'bell'] },
    {
      name: 'Verse 2',
      type: 'verse',
      bars: 8,
      chords: ['I', 'V', 'vi', 'IV'],
      layers: ['keys', 'bass', 'rim', 'shaker', 'vocal'],
      lines: [
        'The city hums a lullaby now',
        'the bridges hold their breath for two',
        'I count the lights along the river',
        'and every one of them is you',
      ],
    },
    {
      name: 'Chorus 2',
      type: 'chorus',
      bars: 8,
      chords: ['IV', 'I', 'V', 'vi', 'IV', 'I', 'V', 'I'],
      layers: ['keys', 'pad', 'bass', 'kick', 'rim', 'shaker', 'bell', 'vocal'],
      lines: chorus,
      fill: true,
    },
    {
      name: 'Bridge',
      type: 'bridge',
      bars: 8,
      chords: ['vi', 'IV', 'I', 'V', 'vi', 'IV', 'ii7', 'V'],
      layers: ['keys', 'pad', 'bass', 'toms', 'vocal'],
      lines: [
        'And if the wind should blow them out',
        "I'll light them one by one again",
        'a hundred tiny suns of paper',
        'to keep us going till the end',
      ],
      fill: true,
    },
    {
      name: 'Chorus 3',
      type: 'chorus',
      bars: 8,
      chords: ['IV', 'I', 'V', 'vi', 'IV', 'I', 'V', 'I'],
      layers: ['keys', 'pad', 'bass', 'kick', 'snare', 'shaker', 'bell', 'vocal'],
      lines: chorus,
    },
    {
      name: 'Outro',
      type: 'outro',
      bars: 4,
      chords: ['IV', 'V', 'I', 'I'],
      layers: ['keys', 'pad', 'vocal'],
      lines: ['carry me, carry me home'],
    },
  ],
};
