/**
 * Arrangement compiler: Composition → timed note events, guide-vocal notes and
 * timed lyric lines. Pure and deterministic — it runs in the browser (for audio
 * rendering) and in Node (to generate the demo .lrc files and in tests), so the
 * audio and the lyrics are derived from exactly the same numbers.
 */
import { createRng } from '@/utils/random';
import { hasNoisyOnset, splitSyllables, stripSyllableMarks, syllableVowel } from '@/services/lrc/syllables';
import { STYLES, type StylePreset } from './styles';
import { bassNote, nearest, NOTE_INDEX, parseChord, scaleNotes, voiceChord, type Chord } from './theory';
import type {
  Arrangement,
  ComposedLine,
  ComposedWord,
  Composition,
  DrumLayer,
  Instrument,
  LyricLineSpec,
  NoteEvent,
  SectionSpec,
  SectionTiming,
  VocalNote,
} from './types';

/** Seconds of silence/reverb tail rendered after the last bar. */
export const TAIL_SECONDS = 2.5;

const DRUM_VELOCITY: Record<string, number> = { X: 1, x: 0.78, o: 0.52, g: 0.3 };
const DRUM_LAYERS: DrumLayer[] = ['kick', 'snare', 'clap', 'hats', 'openhat', 'shaker', 'rim', 'toms'];

interface TimedChord {
  chord: Chord;
  start: number;
  end: number;
}

interface BarInfo {
  sectionIndex: number;
  barInSection: number;
  start: number;
  chords: TimedChord[];
}

export function totalBars(comp: Composition): number {
  return comp.sections.reduce((n, s) => n + s.bars, 0);
}

/** Exact rendered duration of a composition in seconds. */
export function compositionDuration(comp: Composition): number {
  return totalBars(comp) * 4 * (60 / comp.bpm) + TAIL_SECONDS;
}

function fillPattern(layer: DrumLayer, pattern: string): string {
  switch (layer) {
    case 'snare':
      return pattern.slice(0, 8) + 'o.x.xxXX';
    case 'toms':
      return pattern.slice(0, 8) + '..x.x.XX';
    case 'hats':
    case 'openhat':
    case 'shaker':
      return pattern.slice(0, 12) + '....';
    case 'kick':
      return pattern.slice(0, 12) + 'X...';
    default:
      return pattern;
  }
}

const DRUM_INSTRUMENT: Record<DrumLayer, Instrument> = {
  kick: 'kick',
  snare: 'snare',
  clap: 'clap',
  hats: 'hat',
  openhat: 'openhat',
  shaker: 'shaker',
  rim: 'rim',
  toms: 'tom',
};

function ties(pattern: string, i: number): number {
  let n = 0;
  while (pattern[i + 1 + n] === '-') n++;
  return n;
}

function chordTonesInRange(chord: Chord, lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let n = lo; n <= hi; n++) if (chord.pitchClasses.includes(((n % 12) + 12) % 12)) out.push(n);
  return out;
}

function guitarVoicing(chord: Chord, center: number): number[] {
  const root = center - 7 + ((((chord.root - (center - 7)) % 12) + 12) % 12);
  const third = chord.pitchClasses[1] ?? chord.root;
  const fifth = chord.pitchClasses[2] ?? (chord.root + 7) % 12;
  const at = (pc: number, above: number) => above + ((((pc - above) % 12) + 12) % 12);
  const v1 = root;
  const v2 = at(fifth, v1 + 1);
  const v3 = at(chord.root, v2 + 1);
  const v4 = at(third, v3 + 1);
  const v5 = at(fifth, v4 + 1);
  const v6 = at(chord.root, v5 + 1);
  return [v1, v2, v3, v4, v5, v6];
}

export function compileArrangement(comp: Composition): Arrangement {
  const style: StylePreset = STYLES[comp.style];
  const spb = 60 / comp.bpm;
  const step = spb / 4;
  const tonic = NOTE_INDEX[comp.key];
  if (tonic === undefined) throw new Error(`Unknown key ${comp.key}`);
  const swing = comp.swing ?? 0;
  const rng = createRng(`arr:${comp.id}`);
  const events: NoteEvent[] = [];
  const human = () => (style.humanize ? (rng.next() * 2 - 1) * style.humanize : 0);
  const stepTime = (barStart: number, i: number) => barStart + i * step + (i % 2 === 1 ? swing * step : 0);

  // ---- 1. Bar grid and chord timeline -------------------------------------------------------
  const bars: BarInfo[] = [];
  const sections: SectionTiming[] = [];
  let t = 0;
  comp.sections.forEach((section, sectionIndex) => {
    const start = t;
    for (let b = 0; b < section.bars; b++) {
      const symbols = section.chords[b % section.chords.length].trim().split(/\s+/);
      const len = (4 * spb) / symbols.length;
      bars.push({
        sectionIndex,
        barInSection: b,
        start: t,
        chords: symbols.map((sym, k) => ({
          chord: parseChord(sym, tonic, comp.mode),
          start: t + k * len,
          end: t + (k + 1) * len,
        })),
      });
      t += 4 * spb;
    }
    sections.push({ name: section.name, type: section.type, start, end: t, layers: section.layers });
  });
  const musicEnd = t;
  const allChords = bars.flatMap((b) => b.chords);
  const chordAt = (time: number): Chord => {
    let lo = 0;
    let hi = allChords.length - 1;
    let found = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (allChords[mid].start <= time + 1e-6) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return allChords[found].chord;
  };

  // ---- 2. Bar-by-bar accompaniment ----------------------------------------------------------
  bars.forEach((bar, barIndex) => {
    const section = comp.sections[bar.sectionIndex];
    const layers = new Set(section.layers);
    const isLastBar = bar.barInSection === section.bars - 1;
    const fill = Boolean(section.fill && isLastBar);
    const nextBar = bars[barIndex + 1];

    // Drums
    for (const layer of DRUM_LAYERS) {
      if (!layers.has(layer)) continue;
      const patterns = style.drums[layer];
      if (!patterns) continue;
      let pattern = patterns[bar.barInSection % patterns.length];
      if (fill) pattern = fillPattern(layer, pattern);
      for (let i = 0; i < 16; i++) {
        const vel = DRUM_VELOCITY[pattern[i]];
        if (!vel) continue;
        const inst = DRUM_INSTRUMENT[layer];
        const midi = inst === 'tom' ? (fill ? 50 - Math.max(0, i - 8) * 2 : i < 8 ? 45 : 41) : 0;
        events.push({ inst, time: stepTime(bar.start, i) + human(), dur: step, midi, vel: vel * (0.94 + rng.next() * 0.12) });
      }
    }
    const hasDrums = DRUM_LAYERS.some((l) => layers.has(l) && style.drums[l]);
    if (
      hasDrums &&
      bar.barInSection === 0 &&
      bar.sectionIndex > 0 &&
      ['chorus', 'drop', 'solo', 'outro'].includes(section.type) &&
      !style.chipDrums
    ) {
      events.push({ inst: 'crash', time: bar.start, dur: 2, midi: 0, vel: 0.7 });
    }

    // Bass
    if (layers.has('bass')) {
      const pattern = style.bass.pattern[bar.barInSection % style.bass.pattern.length];
      for (let i = 0; i < 16; i++) {
        const c = pattern[i];
        if (!'R53ON'.includes(c)) continue;
        const time = stepTime(bar.start, i);
        const chord = chordAt(time);
        const root = bassNote(chord, style.bass.low);
        let midi = root;
        if (c === '5') midi = root + 7;
        else if (c === '3') midi = root + ((((chord.pitchClasses[1] ?? chord.root) - chord.root) % 12) + 12) % 12;
        else if (c === 'O') midi = root + 12;
        else if (c === 'N') {
          const next = nextBar ? bassNote(nextBar.chords[0].chord, style.bass.low) : root;
          midi = next - 1 === root ? next + 2 : next - 1;
        }
        const len = (1 + ties(pattern, i)) * step;
        events.push({ inst: 'bass', time: time + human() * 0.5, dur: len * 0.9, midi, vel: i % 4 === 0 ? 0.95 : 0.8 });
      }
    }

    // Keys
    if (layers.has('keys') && style.keys) {
      const k = style.keys;
      const pattern = k.pattern[bar.barInSection % k.pattern.length];
      let hit = 0;
      for (let i = 0; i < 16; i++) {
        const c = pattern[i];
        if (c !== 'X' && c !== 'x') continue;
        const time = stepTime(bar.start, i) + human();
        const chord = chordAt(time);
        const vel = c === 'X' ? 0.8 : 0.62;
        if (k.mode === 'block') {
          const len = (1 + ties(pattern, i)) * step;
          for (const midi of voiceChord(chord, k.center, k.voices ?? 4)) {
            events.push({ inst: 'keys', time: time + rng.next() * 0.008, dur: len, midi, vel: vel * 0.85 });
          }
        } else {
          const voicing = voiceChord(chord, k.center, 4);
          const low = bassNote(chord, k.center - 19);
          const seq = [low, ...voicing, ...voicing.slice(1, -1).reverse()];
          const midi = seq[hit % seq.length];
          events.push({ inst: 'keys', time, dur: 6 * step, midi, vel: hit % seq.length === 0 ? vel : vel * 0.8 });
        }
        hit++;
      }
    }

    // Strummed plucked strings (Karplus–Strong guitar)
    if (layers.has('pluck') && style.pluck) {
      const pattern = style.pluck.pattern[bar.barInSection % style.pluck.pattern.length];
      for (let i = 0; i < 16; i++) {
        const c = pattern[i];
        if (c !== 'D' && c !== 'U') continue;
        const time = stepTime(bar.start, i) + human();
        const notes = guitarVoicing(chordAt(time), style.pluck.center);
        const strings = c === 'D' ? notes : notes.slice(2).reverse();
        const gap = c === 'D' ? 0.014 : 0.01;
        let next = i + 1;
        while (next < 16 && pattern[next] !== 'D' && pattern[next] !== 'U') next++;
        const dur = Math.max(2, next - i) * step + 0.15;
        strings.forEach((midi, s) => {
          events.push({ inst: 'pluck', time: time + s * gap, dur, midi, vel: (c === 'D' ? 0.85 : 0.6) * (1 - s * 0.04) });
        });
      }
    }

    // Arpeggiator
    if (layers.has('arp') && style.arp) {
      const a = style.arp;
      const perBar = Math.round(4 / a.rate);
      for (let i = 0; i < perBar; i++) {
        const time = bar.start + i * a.rate * spb + (a.rate === 0.25 && i % 2 === 1 ? swing * step : 0);
        const chord = chordAt(time);
        const base = voiceChord(chord, a.center, 3);
        const pool: number[] = [];
        for (let o = 0; o < a.octaves; o++) pool.push(...base.map((n) => n + o * 12));
        let idx: number;
        if (a.order === 'up') idx = i % pool.length;
        else if (a.order === 'down') idx = pool.length - 1 - (i % pool.length);
        else if (a.order === 'updown') {
          const cycle = Math.max(1, pool.length * 2 - 2);
          const p = i % cycle;
          idx = p < pool.length ? p : cycle - p;
        } else idx = Math.floor(rng.next() * pool.length);
        events.push({
          inst: 'arp',
          time,
          dur: a.rate * spb * 0.85,
          midi: pool[idx],
          vel: i % 4 === 0 ? 0.85 : 0.6,
        });
      }
    }

    // Bell sprinkles
    if (layers.has('bell') && style.bell) {
      for (let i = 0; i < 8; i++) {
        const onBeat = i % 2 === 0;
        if (!rng.chance(style.bell.density * (onBeat ? 1 : 0.45))) continue;
        const time = bar.start + i * 0.5 * spb;
        const tones = chordTonesInRange(chordAt(time), style.bell.center - 5, style.bell.center + 7);
        events.push({ inst: 'bell', time, dur: 2 * spb, midi: rng.pick(tones), vel: 0.4 + rng.next() * 0.35 });
      }
    }
  });

  // Pads: one sustained voicing per run of identical chords inside a section.
  comp.sections.forEach((section, si) => {
    if (!section.layers.includes('pad')) return;
    const runs: TimedChord[] = [];
    for (const bar of bars.filter((b) => b.sectionIndex === si)) {
      for (const c of bar.chords) {
        const last = runs[runs.length - 1];
        if (last && last.chord.symbol === c.chord.symbol && Math.abs(last.end - c.start) < 1e-6) last.end = c.end;
        else runs.push({ ...c });
      }
    }
    for (const run of runs) {
      for (const midi of voiceChord(run.chord, style.pad.center, 4)) {
        events.push({ inst: 'pad', time: run.start, dur: run.end - run.start + 0.08, midi, vel: 0.6 });
      }
    }
  });

  // ---- 3. Lead melodies (instrumental hooks & solos) ----------------------------------------
  sections.forEach((st, si) => {
    const section = comp.sections[si];
    if (!section.layers.includes('lead')) return;
    events.push(...composeLead(comp, section, st.start, style, tonic, spb, chordAt));
  });

  // ---- 4. Guide vocal + timed lyrics ---------------------------------------------------------
  const { vocal, lines } = composeVocal(comp, sections, tonic, spb, chordAt);

  for (const e of events) e.time = Math.max(0, e.time);
  events.sort((a, b) => a.time - b.time);
  return {
    musicEnd,
    duration: musicEnd + TAIL_SECONDS,
    secondsPerBeat: spb,
    events,
    vocal,
    lines,
    sections,
    risers: sections.filter((s) => s.layers.includes('riser')).map((s) => [s.start, s.end] as [number, number]),
    kicks: events.filter((e) => e.inst === 'kick').map((e) => e.time),
  };
}

// ---------------------------------------------------------------------------------------------
// Lead melody
// ---------------------------------------------------------------------------------------------

interface PhraseNote {
  beat: number;
  len: number;
  degree: number;
  strong: boolean;
}

function makePhrase(seed: string, grid: number, density: number, span: number): PhraseNote[] {
  const r = createRng(seed);
  const steps = Math.round(8 / grid);
  const onsets: number[] = [];
  for (let i = 0; i < steps; i++) {
    const beat = i * grid;
    const strong = Math.abs(beat % 1) < 1e-9;
    const p = (strong ? density + 0.2 : density - 0.15) * (beat >= 7 ? 0.3 : 1);
    if (i === 0 || r.chance(p)) onsets.push(beat);
  }
  let degree = r.int(1, 3);
  return onsets.map((beat, i) => {
    const nextBeat = onsets[i + 1] ?? 8;
    degree = Math.max(-1, Math.min(span, degree + r.weighted([-2, -1, 0, 1, 2], [1, 3, 1.2, 3, 1])));
    return { beat, len: nextBeat - beat, degree, strong: Math.abs(beat % 1) < 1e-9 };
  });
}

function composeLead(
  comp: Composition,
  section: SectionSpec,
  start: number,
  style: StylePreset,
  tonic: number,
  spb: number,
  chordAt: (t: number) => Chord,
): NoteEvent[] {
  const { range, grid, density } = style.lead;
  const scale = scaleNotes(tonic, comp.mode, range[0], range[1]);
  const base = Math.floor(scale.length * 0.3);
  const span = Math.min(7, scale.length - base - 1);
  const seedBase = `lead:${comp.id}:${section.type}`;
  const solo = section.type === 'solo';
  const phraseA = makePhrase(`${seedBase}:A`, solo ? Math.min(grid, 0.5) : grid, solo ? density + 0.15 : density, span);
  const phraseB = makePhrase(`${seedBase}:B`, solo ? Math.min(grid, 0.5) : grid, solo ? density + 0.2 : density, span);
  const phraseA2 = phraseA.map((n, i) => (i >= phraseA.length - 2 ? { ...n, degree: Math.max(0, n.degree - 2) } : n));
  const out: NoteEvent[] = [];
  const chunks = Math.floor(section.bars / 2);
  for (let c = 0; c < chunks; c++) {
    const phrase = [phraseA, phraseA, phraseA2, phraseB][c % 4];
    const chunkStart = start + c * 8 * spb;
    for (const n of phrase) {
      const time = chunkStart + n.beat * spb;
      let midi = scale[Math.max(0, Math.min(scale.length - 1, base + n.degree))];
      if (n.strong) {
        const tones = chordTonesInRange(chordAt(time), range[0], range[1]);
        if (tones.length) midi = nearest(tones, midi);
      }
      out.push({ inst: 'lead', time, dur: Math.max(grid, n.len) * spb * 0.92, midi, vel: n.strong ? 0.85 : 0.7 });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Guide vocal & lyrics
// ---------------------------------------------------------------------------------------------

interface Syllable {
  text: string;
  wordIndex: number;
  wordFinal: boolean;
  pauseAfter: boolean;
}

function composeVocal(
  comp: Composition,
  sections: SectionTiming[],
  tonic: number,
  spb: number,
  chordAt: (t: number) => Chord,
): { vocal: VocalNote[]; lines: ComposedLine[] } {
  const vocal: VocalNote[] = [];
  const lines: ComposedLine[] = [];
  const spec = comp.vocal;
  if (!spec) return { vocal, lines };
  const swing = comp.swing ?? 0;
  const scale = scaleNotes(tonic, comp.mode, spec.range[0], spec.range[1]);

  comp.sections.forEach((section, si) => {
    if (!section.lines || !section.layers.includes('vocal')) return;
    const sectionStart = sections[si].start;
    const lineBars = section.lineBars ?? 2;
    const rap = (section.delivery ?? spec.delivery) === 'rap';

    section.lines.forEach((raw, li) => {
      const ls: LyricLineSpec = typeof raw === 'string' ? { text: raw } : raw;
      const barsLen = ls.bars ?? lineBars;
      const beatOffset = (ls.bar ?? li * lineBars) * 4 + (ls.beat ?? section.lineBeat ?? 0);
      const words = ls.text.split(/\s+/).filter(Boolean);

      const syllables: Syllable[] = words.flatMap((w, wordIndex) => {
        const parts = splitSyllables(w.replace(/[^\p{L}\p{N}'|]/gu, '') || w);
        return parts.map((text, k) => ({
          text,
          wordIndex,
          wordFinal: k === parts.length - 1,
          pauseAfter: k === parts.length - 1 && /[,;:.!?—]$/.test(w),
        }));
      });
      const S = syllables.length;

      // -- rhythm ------------------------------------------------------------------------
      const breath = rap ? 0.5 : 1;
      let grid = section.grid ?? spec.grid;
      const slotSteps = Math.floor((barsLen * 4 - breath) / grid + 1e-9);
      if (S > slotSteps) grid = (barsLen * 4 - breath) / S;
      let extra = Math.max(0, Math.floor((barsLen * 4 - breath) / grid + 1e-9) - S);
      const steps = new Array<number>(S).fill(1);
      const hold = rap ? Math.min(extra, 1) : Math.min(extra, Math.max(1, Math.round(extra * 0.45)));
      steps[S - 1] += hold;
      extra -= hold;
      const rr = createRng(`rhythm:${comp.id}:${ls.text}`);
      const candidates = syllables
        .map((s, i) => ({ s, i }))
        .filter(({ s, i }) => s.wordFinal && i < S - 1)
        .sort((a, b) => Number(b.s.pauseAfter) - Number(a.s.pauseAfter) || rr.next() - 0.5);
      for (let round = 0; round < 2 && extra > 0; round++) {
        for (const { s, i } of candidates) {
          if (extra <= 0) break;
          if (round === 1 && !s.pauseAfter && !rr.chance(0.5)) continue;
          steps[i] += 1;
          extra -= 1;
        }
      }

      // -- melody ------------------------------------------------------------------------
      const vr = createRng(`melody:${comp.id}:${section.type}:${li % 4}`);
      const chorus = section.type === 'chorus';
      const mid = Math.floor(scale.length * (chorus ? 0.5 : section.type === 'bridge' ? 0.42 : 0.32));
      const span = rap ? 1 : chorus ? 4 : 3;
      const shape = vr.pick(['arch', 'rise', 'fall', 'wave'] as const);

      let beat = beatOffset;
      const notes: VocalNote[] = [];
      syllables.forEach((syl, k) => {
        const x = S > 1 ? k / (S - 1) : 0;
        const shapeVal =
          shape === 'arch' ? Math.sin(Math.PI * x) : shape === 'rise' ? x : shape === 'fall' ? 1 - x : 0.5 + 0.5 * Math.sin(2 * Math.PI * x);
        const jitter = rap ? (vr.chance(0.25) ? vr.int(-1, 1) : 0) : vr.int(-1, 1);
        const idx = Math.max(0, Math.min(scale.length - 1, Math.round(mid + shapeVal * span + jitter)));
        const beatInBar = ((beat % 4) + 4) % 4;
        const sixteenth = Math.round(beatInBar / 0.25);
        const swung = Math.abs(beatInBar / 0.25 - sixteenth) < 1e-6 && sixteenth % 2 === 1 ? swing * 0.25 : 0;
        const time = sectionStart + (beat + swung) * spb;
        let midi = scale[idx];
        const onBeat = Math.abs(beatInBar - Math.round(beatInBar)) < 1e-6;
        if (!rap && (onBeat || k === S - 1)) {
          const tones = chordTonesInRange(chordAt(time), spec.range[0], spec.range[1]);
          if (tones.length) midi = nearest(tones, midi);
        }
        const len = steps[k] * grid;
        const dur = rap ? Math.min(len, grid * 1.6) * 0.82 : k === S - 1 ? len * spb : len * spb * 0.94;
        notes.push({
          time,
          dur: rap ? dur * spb : dur,
          midi,
          vel: (syl.wordIndex === 0 || onBeat ? 0.95 : 0.8) * (rap ? 1 : 0.92),
          vowel: syllableVowel(syl.text),
          noisyOnset: hasNoisyOnset(syl.text),
        });
        beat += len;
      });
      vocal.push(...notes);

      const composedWords: ComposedWord[] = words.map((w, wi) => {
        const idxs = syllables.map((s, i) => (s.wordIndex === wi ? i : -1)).filter((i) => i >= 0);
        const first = notes[idxs[0]];
        const last = notes[idxs[idxs.length - 1]];
        return {
          text: stripSyllableMarks(w),
          start: first.time,
          end: last.time + last.dur,
          trailingSpace: wi < words.length - 1,
        };
      });
      lines.push({
        text: composedWords.map((w) => w.text).join(' '),
        start: composedWords[0].start,
        end: composedWords[composedWords.length - 1].end,
        words: composedWords,
        section: section.name,
      });
    });
  });

  lines.sort((a, b) => a.start - b.start);
  vocal.sort((a, b) => a.time - b.time);
  return { vocal, lines };
}
