/**
 * MusicWave's procedural audio engine: Composition → stereo PCM.
 *
 * Pure JavaScript DSP (no DOM), so it runs inside a Web Worker in the browser
 * and in Node for tests. Signal flow:
 *
 *   one-shot samples (drums, keys, plucks, arps, bells) ─┐
 *   pads · bass · lead · guide vocal (live voices) ──────┼─→ dry L/R ─┐
 *                                    reverb send ─→ FDN reverb ───────┼─→ master → limiter → PCM
 *                                    delay send ─→ ping-pong delay ───┘
 *
 * Voices are only computed while they sound, which keeps a three-minute song to
 * a couple of seconds of CPU time.
 */
import { compileArrangement } from './arrangement';
import { fdnReverb, Osc, panGains, pingPongDelay, sinCycles, SVF, type Wave } from './dsp';
import { BUS_PAN, DELAY_SEND, DRUM_LEVEL, DRUM_PAN, INST_BUS, PUMPED_BUSES, REVERB_SEND, type Bus } from './mix';
import * as S from './samples';
import { STYLES, type StylePreset } from './styles';
import { midiToFreq } from './theory';
import type { Arrangement, Composition, NoteEvent, VocalNote } from './types';
import type { Vowel } from '@/services/lrc/syllables';

/** Sample rate of synthesized demo audio (same bandwidth as a typical 128 kbps stream). */
export const SYNTH_SAMPLE_RATE = 32000;

interface Mix {
  sr: number;
  length: number;
  L: Float32Array;
  R: Float32Array;
  rev: Float32Array;
  dly: Float32Array;
  /** Control-rate (hop 64) sidechain gain, or null. */
  pump: Float32Array | null;
  style: StylePreset;
  only?: Bus[];
}

export interface EngineOptions {
  sampleRate?: number;
  /** Render only these buses (QA / tests). Effects still apply. */
  only?: Bus[];
  onProgress?: (fraction: number) => void;
  /** Skip loudness normalization and limiting (QA: compare stem levels). */
  raw?: boolean;
}

export interface RenderedSong {
  sampleRate: number;
  duration: number;
  left: Float32Array;
  right: Float32Array;
}

const HOP_SHIFT = 6; // pump curve hop = 64 samples

function enabled(m: Mix, bus: Bus): boolean {
  return !m.only || m.only.includes(bus);
}

/** Adds a mono voice buffer to the mix with bus gain, pan and sends. */
function addVoice(m: Mix, bus: Bus, start: number, buf: Float32Array, n: number, extraGain = 1): void {
  const gain = m.style.mix[bus] * extraGain;
  const [pl, pr] = panGains(BUS_PAN[bus]);
  const gl = gain * pl;
  const gr = gain * pr;
  const gRev = gain * REVERB_SEND[bus];
  const gDly = gain * DELAY_SEND[bus];
  const pump = m.style.pump && PUMPED_BUSES.includes(bus) ? m.pump : null;
  const { L, R, rev, dly } = m;
  const end = Math.min(n, m.length - start);
  for (let i = Math.max(0, -start); i < end; i++) {
    const o = start + i;
    const v = pump === null ? buf[i] : buf[i] * pump[o >> HOP_SHIFT];
    L[o] += v * gl;
    R[o] += v * gr;
    rev[o] += v * gRev;
    dly[o] += v * gDly;
  }
}

// ---------------------------------------------------------------------------------------------
// One-shot instruments
// ---------------------------------------------------------------------------------------------

/** Hold phase (envelope 1) then exponential release; small and monomorphic for V8. */
function accumulate(
  data: Float32Array,
  start: number,
  limit: number,
  hold: number,
  decay: number,
  pump: Float32Array | null,
  m: Mix,
  gl: number,
  gr: number,
  gRev: number,
  gDly: number,
): void {
  const { L, R, rev, dly } = m;
  const h = Math.min(limit, hold);
  for (let i = 0; i < h; i++) {
    const o = start + i;
    const v = pump === null ? data[i] : data[i] * pump[o >> HOP_SHIFT];
    L[o] += v * gl;
    R[o] += v * gr;
    rev[o] += v * gRev;
    dly[o] += v * gDly;
  }
  let env = 1;
  for (let i = h; i < limit; i++) {
    env *= decay;
    if (env < 2e-3) break;
    const o = start + i;
    const v = (pump === null ? data[i] : data[i] * pump[o >> HOP_SHIFT]) * env;
    L[o] += v * gl;
    R[o] += v * gr;
    rev[o] += v * gRev;
    dly[o] += v * gDly;
  }
}

function renderOneShots(m: Mix, comp: Composition, arr: Arrangement): void {
  const { sr, style } = m;
  const chip = Boolean(style.chipDrums);
  const cache = new Map<string, Float32Array>();
  const sample = (key: string, make: () => Float32Array) => {
    let s = cache.get(key);
    if (!s) {
      s = make();
      cache.set(key, s);
    }
    return s;
  };

  const RELEASE: Partial<Record<string, number>> = { keys: 0.2, pluck: 0.08, arp: 0.05, bell: 0.6 };
  const keyOf = (e: NoteEvent): string | null => {
    switch (e.inst) {
      case 'keys':
        return `keys:${style.keys?.patch ?? 'piano'}:${e.midi}`;
      case 'pluck':
        return `pluck:${e.midi}`;
      case 'arp':
        return `arp:${style.arp?.patch ?? 'saw'}:${e.midi}`;
      case 'bell':
        return `bell:${e.midi}`;
      default:
        return null;
    }
  };
  // Each pitched sample only needs to be as long as the longest note using it.
  const needed = new Map<string, number>();
  for (const e of arr.events) {
    const k = keyOf(e);
    if (k) needed.set(k, Math.max(needed.get(k) ?? 0, e.dur + 0.05 + (RELEASE[e.inst] ?? 0.1) * 6.5));
  }
  const len = (key: string, max: number) => Math.min(max, needed.get(key) ?? max);

  for (const e of arr.events) {
    const bus = INST_BUS[e.inst];
    if (bus === 'pad' || bus === 'bass' || bus === 'lead' || !enabled(m, bus)) continue;
    let data: Float32Array;
    let level: number;
    let dur = Infinity;
    let release = 0;
    switch (e.inst) {
      case 'kick':
      case 'snare':
      case 'clap':
      case 'hat':
      case 'openhat':
      case 'shaker':
      case 'rim':
      case 'crash': {
        const kind = e.inst;
        data = sample(`drum:${kind}`, () => S.synthDrum(kind, sr, chip && kind !== 'crash'));
        level = DRUM_LEVEL[kind] ?? 0.5;
        break;
      }
      case 'tom':
        data = sample(`tom:${e.midi}`, () => S.synthTom(e.midi, sr));
        level = DRUM_LEVEL.tom ?? 0.6;
        break;
      case 'keys': {
        const kind = style.keys?.patch ?? 'piano';
        const key = keyOf(e) as string;
        data = sample(key, () => S.synthKeys(kind, e.midi, sr, len(key, 4)));
        level = 0.42;
        dur = e.dur;
        release = kind === 'organ' || kind === 'chip' ? 0.04 : 0.2;
        break;
      }
      case 'pluck': {
        const key = keyOf(e) as string;
        data = sample(key, () => S.synthPluck(e.midi, sr, len(key, 3)));
        level = 0.42;
        dur = e.dur;
        release = 0.08;
        break;
      }
      case 'arp': {
        const kind = style.arp?.patch ?? 'saw';
        const key = keyOf(e) as string;
        data = sample(key, () => S.synthArp(kind, e.midi, sr, len(key, 1.6)));
        level = 0.45;
        dur = e.dur + 0.05;
        release = 0.05;
        break;
      }
      case 'bell': {
        const key = keyOf(e) as string;
        data = sample(key, () => S.synthBell(e.midi, sr, len(key, 4)));
        level = 0.5;
        dur = e.dur;
        release = 0.6;
        break;
      }
      default:
        continue;
    }
    const gain = e.vel * level * style.mix[bus];
    const pan = bus === 'drums' ? (DRUM_PAN[e.inst] ?? 0) : BUS_PAN[bus];
    const [pl, pr] = panGains(pan);
    const start = Math.max(0, Math.round(e.time * sr));
    const limit = Math.min(data.length, m.length - start);
    const hold = Number.isFinite(dur) ? Math.round(dur * sr) : limit;
    const decay = release > 0 ? Math.exp(-1 / (release * sr)) : 0;
    const pumped = Boolean(style.pump) && PUMPED_BUSES.includes(bus);
    accumulate(
      data,
      start,
      limit,
      hold,
      decay,
      pumped ? m.pump : null,
      m,
      gain * pl,
      gain * pr,
      gain * REVERB_SEND[bus],
      gain * DELAY_SEND[bus],
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Pads
// ---------------------------------------------------------------------------------------------

interface Layer {
  wave: Wave;
  cents: number;
  mult: number;
  gain: number;
}

function padLayers(patch: StylePreset['pad']['patch']): Layer[] {
  switch (patch) {
    case 'glass':
      return [
        { wave: 'triangle', cents: 0, mult: 1, gain: 1 },
        { wave: 'sine', cents: 4, mult: 2, gain: 0.35 },
      ];
    case 'organ':
      return [
        { wave: 'square', cents: 0, mult: 1, gain: 0.5 },
        { wave: 'sine', cents: 0, mult: 2, gain: 0.4 },
      ];
    default:
      return [
        { wave: 'saw', cents: -9, mult: 1, gain: 0.6 },
        { wave: 'saw', cents: 0, mult: 1, gain: 0.6 },
        { wave: 'saw', cents: 10, mult: 1, gain: 0.6 },
      ];
  }
}

function renderPads(m: Mix, arr: Arrangement, scratch: Float32Array): void {
  const { sr, style } = m;
  const pads = arr.events.filter((e) => e.inst === 'pad');
  const groups: Array<{ time: number; dur: number; notes: number[] }> = [];
  for (const e of pads) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.time - e.time) < 1e-6) last.notes.push(e.midi);
    else groups.push({ time: e.time, dur: e.dur, notes: [e.midi] });
  }
  const patch = style.pad.patch;
  const layers = padLayers(patch);
  const attack = { warm: 0.5, glass: 0.9, strings: 0.35, choir: 0.4, organ: 0.04 }[patch];
  const release = patch === 'organ' ? 0.15 : 1.1;
  const atkCoef = 1 - Math.exp(-1 / ((attack / 3) * sr));
  const relCoef = 1 - Math.exp(-1 / ((release / 3) * sr));
  const filter = new SVF(sr);

  groups.forEach((gr, gi) => {
    const holdN = Math.round(gr.dur * sr);
    const n = Math.min(scratch.length, holdN + Math.round(release * 2.2 * sr));
    const level = 0.2 / Math.sqrt(Math.max(1, gr.notes.length));
    const oscs: Array<{ osc: Osc; dt: number; gain: number }> = [];
    gr.notes.forEach((midi, vi) => {
      for (const l of layers) {
        const osc = new Osc(l.wave);
        osc.phase = ((gi * 7 + vi * 3 + oscs.length) * 0.137) % 1;
        const f = midiToFreq(midi) * l.mult * Math.pow(2, (l.cents + (vi - 1.5) * 1.5) / 1200);
        oscs.push({ osc, dt: f / sr, gain: l.gain });
      }
    });
    filter.reset();
    const rampN = Math.max(1, Math.round(Math.min(gr.dur, 2.5) * sr));
    let env = 0;
    for (let i = 0; i < n; i++) {
      if ((i & 63) === 0) {
        const p = Math.min(1, i / rampN);
        filter.set(style.pad.cutoff * (0.65 + 0.35 * p), 0.8);
      }
      let s = 0;
      for (let k = 0; k < oscs.length; k++) s += oscs[k].osc.next(oscs[k].dt) * oscs[k].gain;
      filter.process(s);
      env += ((i < holdN ? level : 0) - env) * (i < holdN ? atkCoef : relCoef);
      scratch[i] = filter.low * env;
    }
    addVoice(m, 'pad', Math.round(gr.time * sr), scratch, n);
  });
}

// ---------------------------------------------------------------------------------------------
// Bass
// ---------------------------------------------------------------------------------------------

function renderBass(m: Mix, arr: Arrangement, scratch: Float32Array): void {
  const { sr, style } = m;
  const patch = style.bass.patch;
  const specs: Layer[] =
    patch === 'sub'
      ? [
          { wave: 'sine', cents: 0, mult: 1, gain: 1 },
          { wave: 'triangle', cents: 0, mult: 1, gain: 0.25 },
        ]
      : patch === 'reese'
        ? [
            { wave: 'saw', cents: -14, mult: 1, gain: 0.5 },
            { wave: 'saw', cents: 14, mult: 1, gain: 0.5 },
          ]
        : patch === 'square'
          ? [{ wave: 'square', cents: 0, mult: 1, gain: 0.6 }]
          : patch === 'triangle'
            ? [{ wave: 'triangle', cents: 0, mult: 1, gain: 1 }]
            : [{ wave: 'saw', cents: 0, mult: 1, gain: 0.6 }];
  const level = patch === 'sub' || patch === 'triangle' ? 0.72 : 0.62;
  const peak = patch === 'pluck' ? 5 : patch === 'sub' || patch === 'triangle' ? 1 : 2.2;
  const q = patch === 'pluck' ? 4 : 1.2;
  const filterTau = patch === 'pluck' ? 0.07 : 0.12;
  const filter = new SVF(sr);
  const oscs = specs.map((s) => ({ osc: new Osc(s.wave), spec: s }));
  const atk = 1 - Math.exp(-1 / (0.004 * sr));
  const rel = 1 - Math.exp(-1 / (0.025 * sr));

  for (const note of arr.events) {
    if (note.inst !== 'bass') continue;
    const holdN = Math.round(note.dur * sr);
    const n = Math.min(scratch.length, holdN + Math.round(0.15 * sr));
    const f = midiToFreq(note.midi);
    const dts = oscs.map((o) => (f * Math.pow(2, o.spec.cents / 1200)) / sr);
    filter.reset();
    let env = 0;
    for (let i = 0; i < n; i++) {
      if ((i & 31) === 0) {
        const t = i / sr;
        filter.set(style.bass.cutoff * (1 + (peak - 1) * Math.exp(-t / filterTau)), q);
      }
      let s = 0;
      for (let k = 0; k < oscs.length; k++) s += oscs[k].osc.next(dts[k]) * oscs[k].spec.gain;
      filter.process(s);
      const target = i < holdN ? note.vel * level : 0;
      env += (target - env) * (i < holdN ? atk : rel);
      scratch[i] = filter.low * env;
    }
    addVoice(m, 'bass', Math.round(note.time * sr), scratch, n);
  }
}

// ---------------------------------------------------------------------------------------------
// Monophonic phrases (lead + guide vocal)
// ---------------------------------------------------------------------------------------------

/** Splits notes into phrases separated by rests longer than `gap` seconds. */
function phrases<T extends { time: number; dur: number }>(notes: T[], gap: number): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let lastEnd = -Infinity;
  for (const n of notes) {
    if (cur.length && n.time - lastEnd > gap) {
      out.push(cur);
      cur = [];
    }
    cur.push(n);
    lastEnd = n.time + n.dur;
  }
  if (cur.length) out.push(cur);
  return out;
}

function renderLead(m: Mix, arr: Arrangement, scratch: Float32Array): void {
  const { sr, style } = m;
  const notes = arr.events.filter((e) => e.inst === 'lead');
  const patch = style.lead.patch;
  const specs: Layer[] =
    patch === 'saw'
      ? [
          { wave: 'saw', cents: -7, mult: 1, gain: 0.45 },
          { wave: 'saw', cents: 7, mult: 1, gain: 0.45 },
        ]
      : patch === 'square'
        ? [{ wave: 'square', cents: 0, mult: 1, gain: 0.5 }]
        : patch === 'flute'
          ? [
              { wave: 'sine', cents: 0, mult: 1, gain: 0.8 },
              { wave: 'triangle', cents: 0, mult: 1, gain: 0.35 },
            ]
          : [{ wave: 'sine', cents: 0, mult: 1, gain: 0.9 }];
  const filter = new SVF(sr);
  filter.set(patch === 'saw' ? 2800 : patch === 'square' ? 3400 : 6000, 1.4);
  const breath = new SVF(sr);
  breath.set(2200, 0.8);
  const noise = S.whiteNoise(1, sr, 5);
  const atk = 1 - Math.exp(-1 / (0.012 * sr));
  const rel = 1 - Math.exp(-1 / (0.05 * sr));
  const glide = 1 - Math.exp(-1 / (0.018 * sr));

  for (const phrase of phrases(notes, 0.25)) {
    const t0 = phrase[0].time;
    const last = phrase[phrase.length - 1];
    const n = Math.min(scratch.length, Math.round((last.time + last.dur + 0.35 - t0) * sr));
    const oscs = specs.map((s) => ({ osc: new Osc(s.wave), spec: s, ratio: Math.pow(2, s.cents / 1200) }));
    filter.reset();
    let idx = -1;
    let freq = midiToFreq(phrase[0].midi);
    let target = freq;
    let env = 0;
    let vib = 1;
    let prevEnd = -Infinity;
    for (let i = 0; i < n; i++) {
      const t = t0 + i / sr;
      while (idx + 1 < phrase.length && t >= phrase[idx + 1].time) {
        idx++;
        const nn = phrase[idx];
        target = midiToFreq(nn.midi);
        if (nn.time - prevEnd >= 0.03) freq = target;
        prevEnd = nn.time + nn.dur;
      }
      const cur = phrase[Math.max(0, idx)];
      const active = idx >= 0 && t < cur.time + cur.dur;
      env += ((active ? cur.vel * 0.55 : 0) - env) * (active ? atk : rel);
      freq += (target - freq) * glide;
      if ((i & 31) === 0) {
        const since = t - cur.time;
        const depth = cur.dur > 0.3 ? Math.min(1, since / Math.min(0.55, cur.dur * 0.7)) * 16 : 0;
        vib = Math.pow(2, (depth * sinCycles(t * 5.6)) / 1200);
      }
      let s = 0;
      const dt = (freq * vib) / sr;
      for (let k = 0; k < oscs.length; k++) s += oscs[k].osc.next(dt * oscs[k].ratio) * oscs[k].spec.gain;
      if (patch === 'flute') {
        breath.process(noise[i % noise.length]);
        s += breath.band * 0.12;
      }
      filter.process(s);
      scratch[i] = filter.low * env;
    }
    addVoice(m, 'lead', Math.round(t0 * sr), scratch, n);
  }
}

/** Vowel formants (F1, F2, F3) in Hz — a neutral, mid-range voice. */
const FORMANTS: Record<Vowel, [number, number, number]> = {
  a: [780, 1180, 2800],
  e: [520, 1800, 2550],
  i: [320, 2250, 2950],
  o: [480, 820, 2700],
  u: [340, 720, 2450],
};
const FORMANT_GAIN = [1.35, 0.75, 0.38];
const FORMANT_Q = [7, 11, 13];

/**
 * The guide vocal: two detuned saws + a sine "body" through three vowel formant
 * filters, with consonant noise bursts, scoops, legato glides and delayed vibrato.
 * Every syllable starts exactly at its lyric timestamp.
 */
function renderVocal(m: Mix, notes: VocalNote[], scratch: Float32Array): void {
  const { sr } = m;
  const oscA = new Osc('saw');
  const oscB = new Osc('saw');
  const body = new Osc('sine');
  const formants = [new SVF(sr), new SVF(sr), new SVF(sr)];
  const presence = new SVF(sr);
  presence.set(3000, 0.9);
  const hiss = new SVF(sr);
  hiss.set(4200, 0.9);
  const noise = S.whiteNoise(1, sr, 11);
  const atk = 1 - Math.exp(-1 / (0.012 * sr));
  const rel = 1 - Math.exp(-1 / (0.035 * sr));
  const legatoGlide = 1 - Math.exp(-1 / (0.02 * sr));
  const scoopGlide = 1 - Math.exp(-1 / (0.03 * sr));
  const formantGlide = 1 - Math.exp(-32 / (0.025 * sr)); // per 32-sample control block
  const detuneB = Math.pow(2, 6 / 1200);

  for (const phrase of phrases(notes, 0.12)) {
    const t0 = Math.max(0, phrase[0].time - 0.05);
    const last = phrase[phrase.length - 1];
    const n = Math.min(scratch.length, Math.round((last.time + last.dur + 0.3 - t0) * sr));
    for (const f of formants) f.reset();
    const fc = [...FORMANTS[phrase[0].vowel]];
    const fTarget = [...fc];
    let idx = -1;
    let freq = midiToFreq(phrase[0].midi);
    let target = freq;
    let glide = scoopGlide;
    let env = 0;
    let noiseEnv = 0;
    let vib = 1;
    let prevEnd = -Infinity;
    for (let i = 0; i < n; i++) {
      const t = t0 + i / sr;
      // Advance to the next syllable (a consonant burst leads each noisy onset by 35 ms).
      while (idx + 1 < phrase.length && t >= phrase[idx + 1].time) {
        idx++;
        const nn = phrase[idx];
        target = midiToFreq(nn.midi);
        const legato = nn.time - prevEnd < 0.04;
        if (!legato) freq = target * 0.97;
        glide = legato ? legatoGlide : scoopGlide;
        const v = FORMANTS[nn.vowel];
        fTarget[0] = v[0];
        fTarget[1] = v[1];
        fTarget[2] = v[2];
        prevEnd = nn.time + nn.dur;
      }
      const cur = idx >= 0 ? phrase[idx] : phrase[0];
      const next = phrase[idx + 1];
      const active = idx >= 0 && t < cur.time + Math.max(0.02, cur.dur - 0.015);
      const legatoOut = next ? next.time - (cur.time + cur.dur) < 0.04 : false;
      const on = active || (idx >= 0 && legatoOut && t < next.time);
      env += ((on ? cur.vel : 0) - env) * (on ? atk : rel);
      freq += (target - freq) * glide;

      let nTarget = on ? 0.015 : 0;
      if (next && next.noisyOnset && t >= next.time - 0.035) nTarget = 0.32 * next.vel;
      else if (idx >= 0 && cur.noisyOnset && t < cur.time + 0.005) nTarget = 0.32 * cur.vel;
      noiseEnv += (nTarget - noiseEnv) * 0.02;

      if ((i & 31) === 0) {
        for (let k = 0; k < 3; k++) {
          fc[k] += (fTarget[k] - fc[k]) * formantGlide;
          formants[k].set(fc[k], FORMANT_Q[k]);
        }
        const since = t - cur.time;
        const depth = cur.dur > 0.4 ? Math.min(1, since / Math.min(0.55, cur.dur * 0.6)) * 20 : 0;
        vib = Math.pow(2, (depth * sinCycles(t * 5.3)) / 1200);
      }
      const dt = (freq * vib) / sr;
      const src = (oscA.next(dt) + oscB.next(dt * detuneB)) * 0.5;
      let voiced = 0;
      for (let k = 0; k < 3; k++) {
        formants[k].process(src);
        voiced += formants[k].band * FORMANT_GAIN[k] * 2.2;
      }
      voiced += body.next(dt) * 0.32;
      voiced *= env;
      presence.process(voiced);
      hiss.process(noise[i % noise.length]);
      scratch[i] = voiced + presence.band * 0.4 + hiss.band * noiseEnv;
    }
    addVoice(m, 'vocal', Math.round(t0 * sr), scratch, n);
  }
}

// ---------------------------------------------------------------------------------------------
// Textures, effects and mastering
// ---------------------------------------------------------------------------------------------

function renderTextures(m: Mix, arr: Arrangement): void {
  const { sr, style, L, R, rev } = m;
  if (style.lofi) {
    const crackle = S.vinylCrackle(6, sr);
    for (let i = 0; i < m.length; i++) {
      const v = crackle[i % crackle.length] * 0.5;
      L[i] += v;
      R[i] += v;
    }
  }
  const noise = S.whiteNoise(2, sr, 3);
  const bp = new SVF(sr);
  for (const [start, end] of arr.risers) {
    const a = Math.round(start * sr);
    const b = Math.min(m.length, Math.round(end * sr));
    bp.reset();
    for (let o = a; o < b; o++) {
      const p = (o - a) / Math.max(1, b - a);
      if (((o - a) & 63) === 0) bp.set(350 * Math.pow(Math.min(8000, sr * 0.4) / 350, p), 2.2);
      bp.process(noise[o % noise.length]);
      const v = bp.band * 0.16 * p;
      L[o] += v;
      R[o] += v;
      rev[o] += v;
    }
  }
}

function pumpCurve(kicks: number[], depth: number, length: number, sr: number): Float32Array {
  const hop = 1 << HOP_SHIFT;
  const out = new Float32Array((length >> HOP_SHIFT) + 2).fill(1);
  if (!depth) return out;
  for (const k of kicks) {
    const start = Math.floor((k * sr) / hop);
    for (let j = start; j < out.length; j++) {
      const t = ((j - start) * hop) / sr;
      if (t > 0.45) break;
      const duck = t < 0.03 ? 1 - depth * Math.min(1, t / 0.004) : 1 - depth * Math.exp(-(t - 0.03) / 0.085);
      out[j] = Math.min(out[j], duck);
    }
  }
  return out;
}

let reverbNorm: number | null = null;
/** Energy normalization so `wet` means roughly the same thing as a normalized convolution reverb. */
function reverbGain(sr: number): number {
  if (reverbNorm !== null) return reverbNorm;
  const len = sr * 2;
  const imp = new Float32Array(len);
  imp[0] = 1;
  const l = new Float32Array(len);
  const r = new Float32Array(len);
  fdnReverb(imp, l, r, sr, 2, 1);
  let e = 0;
  for (let i = 0; i < len; i++) e += l[i] * l[i] + r[i] * r[i];
  reverbNorm = 1 / Math.sqrt(Math.max(1e-9, e / 2));
  return reverbNorm;
}

function master(m: Mix, musicEnd: number): void {
  const { L, R, sr, style } = m;
  if (style.lofi) {
    const a = Math.exp((-2 * Math.PI * 7200) / sr);
    let yl = 0;
    let yr = 0;
    for (let i = 0; i < m.length; i++) {
      yl = (1 - a) * L[i] + a * yl;
      yr = (1 - a) * R[i] + a * yr;
      L[i] = yl;
      R[i] = yr;
    }
  }
  let sum = 0;
  let count = 0;
  for (let i = 0; i < m.length; i += 4) {
    sum += L[i] * L[i] + R[i] * R[i];
    count += 2;
  }
  const rms = Math.sqrt(sum / Math.max(1, count));
  const gain = rms > 1e-5 ? Math.min(8, Math.max(0.2, 0.16 / rms)) : 1;
  const knee = 0.85;
  const fadeStart = Math.floor((musicEnd + 0.4) * sr);
  const fadeLen = Math.max(1, m.length - fadeStart);
  const fadeIn = Math.floor(0.004 * sr);
  for (const ch of [L, R]) {
    for (let i = 0; i < m.length; i++) {
      let x = ch[i] * gain;
      const ax = Math.abs(x);
      if (ax > knee) x = Math.sign(x) * (knee + (1 - knee) * Math.tanh((ax - knee) / (1 - knee)));
      if (i < fadeIn) x *= i / fadeIn;
      if (i > fadeStart) x *= Math.max(0, 1 - (i - fadeStart) / fadeLen);
      ch[i] = x * 0.98;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------------------------

export function renderSong(comp: Composition, options: EngineOptions = {}): RenderedSong {
  const sr = options.sampleRate ?? SYNTH_SAMPLE_RATE;
  const progress = options.onProgress ?? (() => undefined);
  const arr = compileArrangement(comp);
  const style = STYLES[comp.style];
  const length = Math.ceil(arr.duration * sr);
  const m: Mix = {
    sr,
    length,
    L: new Float32Array(length),
    R: new Float32Array(length),
    rev: new Float32Array(length),
    dly: new Float32Array(length),
    pump: style.pump ? pumpCurve(arr.kicks, style.pump, length, sr) : null,
    style,
    only: options.only,
  };
  // Scratch buffer for one voice/phrase (longest pad run or phrase, plus tails).
  const scratch = new Float32Array(Math.ceil(Math.min(arr.duration, 60) * sr));

  progress(0.05);
  renderOneShots(m, comp, arr);
  progress(0.35);
  if (enabled(m, 'pad')) renderPads(m, arr, scratch);
  progress(0.5);
  if (enabled(m, 'bass')) renderBass(m, arr, scratch);
  if (enabled(m, 'lead')) renderLead(m, arr, scratch);
  progress(0.62);
  if (enabled(m, 'vocal')) renderVocal(m, arr.vocal, scratch);
  progress(0.78);
  if (!options.only) renderTextures(m, arr);

  fdnReverb(m.rev, m.L, m.R, sr, style.reverb.seconds, style.reverb.wet * 1.1 * reverbGain(sr));
  progress(0.88);
  pingPongDelay(m.dly, m.L, m.R, sr, Math.min(3.9, style.delay.beats * arr.secondsPerBeat), style.delay.feedback, style.delay.wet * 2);
  if (!options.raw) master(m, arr.musicEnd);
  progress(0.95);
  return { sampleRate: sr, duration: arr.duration, left: m.L, right: m.R };
}

/** Interleaved 16-bit PCM WAV file bytes. */
export function encodeWavPcm16(left: Float32Array, right: Float32Array, sampleRate: number): ArrayBuffer {
  const frames = left.length;
  const dataBytes = frames * 4;
  const out = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(out);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, dataBytes, true);
  const pcm = new Int16Array(out, 44, frames * 2);
  for (let i = 0, k = 0; i < frames; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    pcm[k++] = l < 0 ? l * 0x8000 : l * 0x7fff;
    pcm[k++] = r < 0 ? r * 0x8000 : r * 0x7fff;
  }
  return out;
}

export interface AudioAnalysis {
  /** Normalized peak per bin (waveform seek bar). */
  peaks: number[];
  /** Normalized RMS energy at `frameRate` fps (visuals). */
  energy: number[];
  frameRate: number;
}

export function analyzePcm(left: Float32Array, right: Float32Array, sampleRate: number, bins = 480, frameRate = 30): AudioAnalysis {
  const n = left.length;
  const peaks: number[] = new Array(bins).fill(0);
  const per = n / bins;
  for (let b = 0; b < bins; b++) {
    const start = Math.floor(b * per);
    const end = Math.min(n, Math.floor((b + 1) * per));
    let max = 0;
    for (let i = start; i < end; i += 4) {
      const v = (Math.abs(left[i]) + Math.abs(right[i])) / 2;
      if (v > max) max = v;
    }
    peaks[b] = max;
  }
  const frameLen = Math.floor(sampleRate / frameRate);
  const frames = Math.ceil(n / frameLen);
  const energy: number[] = new Array(frames).fill(0);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    let cnt = 0;
    for (let i = f * frameLen; i < Math.min(n, (f + 1) * frameLen); i += 4) {
      const v = (left[i] + right[i]) / 2;
      sum += v * v;
      cnt++;
    }
    energy[f] = Math.sqrt(sum / Math.max(1, cnt));
  }
  const maxPeak = Math.max(1e-6, ...peaks);
  let maxEnergy = 1e-6;
  for (const e of energy) if (e > maxEnergy) maxEnergy = e;
  return {
    peaks: peaks.map((p) => Math.round((p / maxPeak) * 1000) / 1000),
    energy: energy.map((e) => Math.round((e / maxEnergy) * 1000) / 1000),
    frameRate,
  };
}

/** Render → WAV bytes + analysis. Used by the synth worker. */
export function renderSongToWav(comp: Composition, options: EngineOptions = {}): { wav: ArrayBuffer; analysis: AudioAnalysis; duration: number } {
  const song = renderSong(comp, options);
  const analysis = analyzePcm(song.left, song.right, song.sampleRate);
  const wav = encodeWavPcm16(song.left, song.right, song.sampleRate);
  options.onProgress?.(1);
  return { wav, analysis, duration: song.duration };
}
