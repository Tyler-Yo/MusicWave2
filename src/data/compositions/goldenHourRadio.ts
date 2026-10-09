import type { Composition } from '@/audio/synth/types';

/**
 * "Golden Hour Radio" — The Paper Comets. Upbeat pop (118 BPM).
 * Lyric test case: REPEATED CHORUSES (four times, including back-to-back finals) and a riser build.
 * Original lyrics © MusicWave demo content (written for this project).
 */
const pre = ['And the static fades into a song', "we've been waiting for all summer long"];
const chorus = [
  'Turn it up, golden hour radio',
  "every song's a place we used to know",
  'hands up high and the windows open wide',
  'golden hour radio tonight',
];
const chorusLayers = ['kick', 'clap', 'hats', 'shaker', 'bass', 'pluck', 'pad', 'arp', 'vocal'] as const;

export const goldenHourRadio: Composition = {
  id: 'golden-hour-radio',
  bpm: 118,
  key: 'D',
  mode: 'major',
  style: 'pop',
  vocal: { range: [62, 76], grid: 0.5, delivery: 'sung' },
  lrcFormat: 'enhanced',
  sections: [
    { name: 'Intro', type: 'intro', bars: 4, chords: ['I', 'V', 'vi', 'IV'], layers: ['pluck', 'pad', 'kick'] },
    {
      name: 'Verse 1',
      type: 'verse',
      bars: 8,
      chords: ['I', 'V', 'vi', 'IV'],
      layers: ['kick', 'hats', 'bass', 'pluck', 'vocal'],
      lines: [
        'Windows down on the coastal road',
        'sun is spilling like a can of gold',
        "you've got your feet up on the dashboard",
        'singing every word you never learned',
      ],
    },
    {
      name: 'Pre-Chorus',
      type: 'pre',
      bars: 4,
      chords: ['ii', 'IV', 'V', 'V'],
      layers: ['kick', 'clap', 'bass', 'pad', 'keys', 'vocal'],
      lines: pre,
      fill: true,
    },
    { name: 'Chorus 1', type: 'chorus', bars: 8, chords: ['IV', 'V', 'iii', 'vi', 'IV', 'V', 'I', 'I'], layers: [...chorusLayers], lines: chorus },
    { name: 'Post-Chorus', type: 'break', bars: 2, chords: ['I', 'V'], layers: ['pluck', 'pad', 'kick', 'bell'] },
    {
      name: 'Verse 2',
      type: 'verse',
      bars: 8,
      chords: ['I', 'V', 'vi', 'IV'],
      layers: ['kick', 'clap', 'hats', 'bass', 'pluck', 'keys', 'vocal'],
      lines: [
        'Gas station coffee and a paper map',
        "we took the long way and we won't turn back",
        "the DJ's talking like an old friend",
        "dedicating this one to the summer's end",
      ],
    },
    {
      name: 'Pre-Chorus',
      type: 'pre',
      bars: 4,
      chords: ['ii', 'IV', 'V', 'V'],
      layers: ['kick', 'clap', 'bass', 'pad', 'keys', 'vocal'],
      lines: pre,
      fill: true,
    },
    { name: 'Chorus 2', type: 'chorus', bars: 8, chords: ['IV', 'V', 'iii', 'vi', 'IV', 'V', 'I', 'I'], layers: [...chorusLayers], lines: chorus },
    {
      name: 'Bridge',
      type: 'bridge',
      bars: 8,
      chords: ['vi', 'IV', 'I', 'V'],
      layers: ['pad', 'keys', 'bass', 'bell', 'vocal'],
      lines: [
        'When the sky goes violet and the speakers hum',
        "I'll remember this, the way we used to run",
        'if the signal fades, if the dial goes dark',
        "I'll still hear it humming in my heart",
      ],
    },
    { name: 'Build', type: 'build', bars: 4, chords: ['IV', 'IV', 'V', 'V'], layers: ['kick', 'snare', 'pad', 'bass', 'riser'], fill: true },
    { name: 'Chorus 3', type: 'chorus', bars: 8, chords: ['IV', 'V', 'iii', 'vi', 'IV', 'V', 'I', 'I'], layers: [...chorusLayers, 'openhat'], lines: chorus },
    { name: 'Chorus 4', type: 'chorus', bars: 8, chords: ['IV', 'V', 'iii', 'vi', 'IV', 'V', 'I', 'I'], layers: [...chorusLayers, 'openhat', 'keys'], lines: chorus },
    { name: 'Outro', type: 'outro', bars: 4, chords: ['I', 'V', 'IV', 'I'], layers: ['pluck', 'pad', 'bell'] },
  ],
};
