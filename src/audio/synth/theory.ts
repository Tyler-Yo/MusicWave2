/**
 * Minimal music theory for the procedural composer: keys, modes, roman-numeral
 * chords and smooth voice leading.
 */

export const NOTE_INDEX: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

export const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
} as const;

export type ModeName = keyof typeof MODES;

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export interface Chord {
  symbol: string;
  /** Pitch class of the root (0–11), absolute. */
  root: number;
  /** Absolute pitch classes, root first. */
  pitchClasses: number[];
}

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];

/**
 * Parses a roman-numeral chord relative to a key/mode.
 * Case sets quality (I = major, i = minor); `°`/`dim`, `+` for diminished/augmented;
 * `b`/`#` prefixes alter the root; suffixes: 7, maj7, 9, add9, sus2, sus4, 6.
 * The numeral indexes the *mode's* scale, so in minor `VI` is the flat-six chord.
 */
export function parseChord(symbol: string, tonic: number, mode: ModeName): Chord {
  const m = symbol.match(/^([b#]?)([ivIV]+)(°|dim|\+)?(.*)$/);
  if (!m) throw new Error(`Bad chord symbol: ${symbol}`);
  const [, accidental, numeral, special, suffix] = m;
  const degree = ROMAN.indexOf(numeral.toLowerCase());
  if (degree < 0) throw new Error(`Bad roman numeral: ${symbol}`);
  const scale = MODES[mode];
  const root = (tonic + scale[degree] + (accidental === 'b' ? -1 : accidental === '#' ? 1 : 0) + 12) % 12;
  const isMinor = numeral === numeral.toLowerCase();
  let intervals: number[];
  if (special === '°' || special === 'dim') intervals = [0, 3, 6];
  else if (special === '+') intervals = [0, 4, 8];
  else intervals = isMinor ? [0, 3, 7] : [0, 4, 7];

  if (suffix.includes('sus2')) intervals = [0, 2, 7];
  if (suffix.includes('sus4')) intervals = [0, 5, 7];
  if (suffix.includes('maj7')) intervals.push(11);
  else if (suffix.includes('7')) intervals.push(special === '°' || special === 'dim' ? 9 : 10);
  if (suffix.includes('6')) intervals.push(9);
  if (suffix.includes('9')) {
    if (!suffix.includes('add') && !intervals.includes(10) && !intervals.includes(11)) intervals.push(isMinor ? 10 : 11);
    intervals.push(14);
  }
  return { symbol, root, pitchClasses: intervals.map((i) => (root + i) % 12) };
}

/** Places pitch classes near `center` (MIDI) to produce a smooth, compact voicing. */
export function voiceChord(chord: Chord, center: number, maxNotes = 4): number[] {
  const notes = chord.pitchClasses.slice(0, maxNotes).map((pc) => {
    let n = center - 6 + ((pc - (center - 6)) % 12 + 12) % 12;
    if (n > center + 6) n -= 12;
    return n;
  });
  return [...new Set(notes)].sort((a, b) => a - b);
}

/** Bass note (MIDI) for a chord root in the given octave range. */
export function bassNote(chord: Chord, low = 33): number {
  return low + ((chord.root - (low % 12)) % 12 + 12) % 12;
}

/** All MIDI notes of the scale between lo and hi (inclusive). */
export function scaleNotes(tonic: number, mode: ModeName, lo: number, hi: number): number[] {
  const pcs = new Set(MODES[mode].map((i) => (tonic + i) % 12));
  const out: number[] = [];
  for (let n = lo; n <= hi; n++) if (pcs.has(n % 12)) out.push(n);
  return out;
}

/** Nearest note in `candidates` to `target`. */
export function nearest(candidates: number[], target: number): number {
  let best = candidates[0];
  for (const c of candidates) if (Math.abs(c - target) < Math.abs(best - target)) best = c;
  return best;
}
