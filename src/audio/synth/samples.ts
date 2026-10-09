/**
 * One-shot instrument samples synthesized directly into Float32Arrays.
 *
 * Percussion, pianos, plucked strings (Karplus–Strong) and bells are rendered
 * once per pitch and then triggered as AudioBufferSourceNodes, which keeps the
 * Web Audio graph small and the render fast. Everything is seeded, so output is
 * bit-for-bit deterministic.
 */
import { mulberry32 } from '@/utils/random';
import { midiToFreq } from './theory';

const TABLE_SIZE = 4096;
const SINE = new Float32Array(TABLE_SIZE + 1);
for (let i = 0; i <= TABLE_SIZE; i++) SINE[i] = Math.sin((2 * Math.PI * i) / TABLE_SIZE);

/** Fast sine of a phase measured in cycles. */
function sinCycles(phase: number): number {
  const p = phase - Math.floor(phase);
  const x = p * TABLE_SIZE;
  const i = x | 0;
  const f = x - i;
  return SINE[i] + (SINE[i + 1] - SINE[i]) * f;
}

function noiseSource(seed: number): () => number {
  const r = mulberry32(seed);
  return () => r() * 2 - 1;
}

/** One-pole high-pass (in place). */
function highpass(data: Float32Array, sr: number, cutoff: number): Float32Array {
  const rc = 1 / (2 * Math.PI * cutoff);
  const a = rc / (rc + 1 / sr);
  let prevX = 0;
  let prevY = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    const y = a * (prevY + x - prevX);
    data[i] = y;
    prevX = x;
    prevY = y;
  }
  return data;
}

/** One-pole low-pass (in place). */
function lowpass(data: Float32Array, sr: number, cutoff: number): Float32Array {
  const a = Math.exp((-2 * Math.PI * cutoff) / sr);
  let y = 0;
  for (let i = 0; i < data.length; i++) {
    y = (1 - a) * data[i] + a * y;
    data[i] = y;
  }
  return data;
}

/** RBJ biquad band-pass (constant 0 dB peak gain), in place. */
function bandpass(data: Float32Array, sr: number, freq: number, q: number): Float32Array {
  const w0 = (2 * Math.PI * freq) / sr;
  const alpha = Math.sin(w0) / (2 * q);
  const b0 = alpha;
  const b2 = -alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * Math.cos(w0);
  const a2 = 1 - alpha;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    data[i] = y;
  }
  return data;
}

const metallicRatios = [1, 1.483, 1.932, 2.546, 2.63, 3.897];

function metallic(t: number, base: number): number {
  let s = 0;
  for (const r of metallicRatios) s += sinCycles(t * base * r) > 0 ? 1 : -1;
  return s / metallicRatios.length;
}

export type DrumKind = 'kick' | 'snare' | 'clap' | 'hat' | 'openhat' | 'shaker' | 'rim' | 'crash';

export function synthDrum(kind: DrumKind, sr: number, chip = false): Float32Array {
  const noise = noiseSource(0xd00d + kind.length * 977);
  const make = (seconds: number) => new Float32Array(Math.ceil(seconds * sr));

  if (chip) {
    // 8-bit style: stepped noise and pulse waves.
    const len = kind === 'kick' ? 0.25 : kind === 'snare' ? 0.2 : 0.06;
    const out = make(len);
    let held = 0;
    const hold = kind === 'hat' ? 2 : 8;
    let phase = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / sr;
      if (i % hold === 0) held = noise();
      if (kind === 'kick') {
        const f = 40 + 220 * Math.exp(-t * 30);
        phase += f / sr;
        out[i] = (phase % 1 < 0.5 ? 0.8 : -0.8) * Math.exp(-t * 14);
      } else if (kind === 'snare') {
        out[i] = held * 0.7 * Math.exp(-t * 16);
      } else {
        out[i] = held * 0.45 * Math.exp(-t * 60);
      }
    }
    return out;
  }

  switch (kind) {
    case 'kick': {
      const out = make(0.55);
      let phase = 0;
      for (let i = 0; i < out.length; i++) {
        const t = i / sr;
        const f = 46 + 120 * Math.exp(-t * 26) + 40 * Math.exp(-t * 120);
        phase += f / sr;
        const body = sinCycles(phase) * Math.exp(-t * 6.5);
        const click = t < 0.006 ? noise() * (1 - t / 0.006) * 0.35 : 0;
        out[i] = Math.tanh((body + click) * 1.6) * 0.95;
      }
      return out;
    }
    case 'snare': {
      const out = make(0.4);
      const n = make(0.4);
      for (let i = 0; i < n.length; i++) n[i] = noise();
      highpass(n, sr, 1400);
      let phase = 0;
      for (let i = 0; i < out.length; i++) {
        const t = i / sr;
        phase += (180 + 60 * Math.exp(-t * 40)) / sr;
        const tone = sinCycles(phase) * Math.exp(-t * 24) * 0.55;
        out[i] = tone + n[i] * Math.exp(-t * 15) * 0.85;
      }
      return out;
    }
    case 'clap': {
      const out = make(0.45);
      for (let i = 0; i < out.length; i++) out[i] = noise();
      bandpass(out, sr, 1250, 1.2);
      for (let i = 0; i < out.length; i++) {
        const t = i / sr;
        let env = 0;
        for (const o of [0, 0.011, 0.022]) if (t >= o) env = Math.max(env, Math.exp(-(t - o) * 260));
        if (t >= 0.03) env = Math.max(env, 0.55 * Math.exp(-(t - 0.03) * 16));
        out[i] *= env * 2.4;
      }
      return out;
    }
    case 'hat':
    case 'openhat': {
      const out = make(kind === 'hat' ? 0.12 : 0.65);
      const decay = kind === 'hat' ? 55 : 6.5;
      for (let i = 0; i < out.length; i++) {
        const t = i / sr;
        out[i] = (metallic(t, 410) * 0.6 + noise() * 0.4) * Math.exp(-t * decay);
      }
      highpass(out, sr, 7000);
      highpass(out, sr, 6000);
      for (let i = 0; i < out.length; i++) out[i] *= 1.8;
      return out;
    }
    case 'shaker': {
      const out = make(0.16);
      for (let i = 0; i < out.length; i++) out[i] = noise();
      bandpass(out, sr, 6200, 1.4);
      for (let i = 0; i < out.length; i++) {
        const t = i / sr;
        const env = t < 0.012 ? t / 0.012 : Math.exp(-(t - 0.012) * 32);
        out[i] *= env * 1.6;
      }
      return out;
    }
    case 'rim': {
      const out = make(0.09);
      for (let i = 0; i < out.length; i++) {
        const t = i / sr;
        out[i] =
          (sinCycles(t * 1720) * 0.6 + sinCycles(t * 830) * 0.4 + noise() * 0.25) * Math.exp(-t * 85);
      }
      return out;
    }
    case 'crash': {
      const out = make(2.6);
      for (let i = 0; i < out.length; i++) {
        const t = i / sr;
        out[i] = (metallic(t, 330) * 0.5 + noise() * 0.5) * Math.exp(-t * 1.7) * (t < 0.003 ? t / 0.003 : 1);
      }
      highpass(out, sr, 4200);
      return out;
    }
  }
}

export function synthTom(midi: number, sr: number): Float32Array {
  const out = new Float32Array(Math.ceil(0.8 * sr));
  const f0 = midiToFreq(midi);
  const noise = noiseSource(midi * 31);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    phase += (f0 * (1 + 0.55 * Math.exp(-t * 18))) / sr;
    out[i] = (sinCycles(phase) * Math.exp(-t * 5.5) + noise() * 0.15 * Math.exp(-t * 40)) * 0.9;
  }
  return out;
}

export type KeysKind = 'piano' | 'epiano' | 'organ' | 'chip';

/** Pitched, decaying keyboard tones. `seconds` trims the sample to what the song needs. */
export function synthKeys(kind: KeysKind, midi: number, sr: number, seconds = 4): Float32Array {
  const f = midiToFreq(midi);
  const out = new Float32Array(Math.ceil(seconds * sr));
  const nyquist = sr / 2;
  const attackLen = Math.max(1, Math.floor(0.004 * sr));

  if (kind === 'piano') {
    const B = 0.00035;
    const freqs: number[] = [];
    const amps: number[] = [];
    const mults: number[] = [];
    for (let n = 1; n <= 7; n++) {
      const fn = n * f * Math.sqrt(1 + B * n * n);
      if (fn > nyquist * 0.9) break;
      freqs.push(fn / sr);
      amps.push(1 / Math.pow(n, 1.25));
      mults.push(Math.exp(-(0.55 + 0.42 * n + f / 900) / sr));
    }
    const norm = 1.4 / amps.reduce((a, b) => a + b, 0);
    const env = amps.map((a) => a * norm);
    const phase = new Float64Array(freqs.length);
    const K = freqs.length;
    for (let i = 0; i < out.length; i++) {
      let s = 0;
      for (let k = 0; k < K; k++) {
        s += env[k] * sinCycles(phase[k]);
        phase[k] += freqs[k];
        env[k] *= mults[k];
      }
      out[i] = i < attackLen ? (s * i) / attackLen : s;
    }
    return out;
  }

  if (kind === 'epiano') {
    const inc = f / sr;
    const tineInc = (f * 7) / sr;
    const useTine = f * 7 < nyquist;
    let idx = 1.6;
    const idxMul = Math.exp(-3 / sr);
    let e1 = 0.65;
    const e1Mul = Math.exp(-1.3 / sr);
    let e2 = 0.35;
    const e2Mul = Math.exp(-0.45 / sr);
    let tine = 0.1;
    const tineMul = Math.exp(-14 / sr);
    let p = 0;
    let pt = 0;
    for (let i = 0; i < out.length; i++) {
      const mod = sinCycles(p) * (idx + 0.25);
      const carrier = sinCycles(p + mod / (2 * Math.PI));
      const t = useTine ? tine * sinCycles(pt) : 0;
      const a = i < attackLen ? i / attackLen : 1;
      out[i] = (carrier + t) * (e1 + e2) * a * 0.9;
      p += inc;
      pt += tineInc;
      idx *= idxMul;
      e1 *= e1Mul;
      e2 *= e2Mul;
      tine *= tineMul;
    }
    return out;
  }

  if (kind === 'organ') {
    const bars: Array<[number, number]> = [
      [1, 1],
      [2, 0.55],
      [3, 0.35],
      [4, 0.22],
      [6, 0.12],
    ].filter(([h]) => h * f < nyquist * 0.9) as Array<[number, number]>;
    const inc = f / sr;
    let p = 0;
    const clickLen = Math.floor(0.008 * sr);
    for (let i = 0; i < out.length; i++) {
      let s = 0;
      for (const [h, a] of bars) s += a * sinCycles(h * p);
      out[i] = s * 0.45 * (i < clickLen ? i / clickLen : 1);
      p += inc;
    }
    return out;
  }

  // chip: 25% pulse with a gentle decay
  let phase = 0;
  let env = 0.4;
  const mul = Math.exp(-3 / sr);
  for (let i = 0; i < out.length; i++) {
    phase += f / sr;
    if (phase >= 1) phase -= 1;
    out[i] = (phase < 0.25 ? 0.5 : -0.5) * (0.6 + env);
    env *= mul;
  }
  return out;
}

/** Karplus–Strong plucked string (nylon/steel guitar). */
export function synthPluck(midi: number, sr: number, seconds = 3): Float32Array {
  const f = midiToFreq(midi);
  const out = new Float32Array(Math.ceil(seconds * sr));
  const period = sr / f;
  const N = Math.max(2, Math.floor(period));
  const frac = period - N;
  const noise = noiseSource(midi * 7919 + 13);
  const buf = new Float32Array(N + 1);
  // Pre-filtered excitation = softer pick.
  let prev = 0;
  for (let i = 0; i <= N; i++) {
    const x = noise();
    prev = prev * 0.5 + x * 0.5;
    buf[i] = prev;
  }
  const decay = 0.9965 - Math.min(0.006, f / 200000);
  let idx = 0;
  for (let i = 0; i < out.length; i++) {
    const cur = buf[idx];
    const nextIdx = idx + 1 > N ? 0 : idx + 1;
    // Linear-interpolated averaging filter (approximate fractional delay).
    const avg = (cur * (1 - frac * 0.5) + buf[nextIdx] * (1 + frac * 0.5)) * 0.5;
    buf[idx] = avg * decay;
    out[i] = cur;
    idx = nextIdx;
  }
  lowpass(out, sr, 4200);
  const fade = Math.floor(0.05 * sr);
  for (let i = 0; i < out.length; i++) {
    const left = out.length - i;
    out[i] *= 1.25 * (left < fade ? left / fade : 1);
  }
  return out;
}

/** FM bell / glockenspiel. */
export function synthBell(midi: number, sr: number, seconds = 4): Float32Array {
  const f = midiToFreq(midi);
  const out = new Float32Array(Math.ceil(seconds * sr));
  const inc = f / sr;
  let p = 0;
  let index = 2.2;
  const indexMul = Math.exp(-2.4 / sr);
  let env = 0.6;
  const envMul = Math.exp(-1.15 / sr);
  let partial = 0.25;
  const partialMul = Math.exp(-3 / sr);
  const attackLen = Math.max(1, Math.floor(0.002 * sr));
  for (let i = 0; i < out.length; i++) {
    const mod = sinCycles(p * 3.5) * index;
    const s = sinCycles(p + mod / (2 * Math.PI)) + partial * sinCycles(p * 2.01);
    out[i] = s * env * (i < attackLen ? i / attackLen : 1);
    p += inc;
    index *= indexMul;
    env *= envMul;
    partial *= partialMul;
  }
  return out;
}

export type ArpKind = 'saw' | 'square' | 'bell' | 'pluck';

/** PolyBLEP residual for band-limited discontinuities. */
function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/** Short synth tones for arpeggios: PolyBLEP oscillator through a decaying low-pass. */
export function synthArp(kind: ArpKind, midi: number, sr: number, seconds = 1.2): Float32Array {
  if (kind === 'bell') return synthBell(midi, sr, seconds);
  if (kind === 'pluck') return synthPluck(midi, sr, seconds);
  const f = midiToFreq(midi);
  const out = new Float32Array(Math.ceil(seconds * sr));
  const dt = f / sr;
  let phase = 0;
  let cutoff = Math.min(9000, f * 14);
  const cutMul = Math.exp(-6 / sr);
  let env = 0.5;
  const envMul = Math.exp(-4.2 / sr);
  let y = 0;
  let a = 0;
  const attackLen = Math.max(1, Math.floor(0.003 * sr));
  for (let i = 0; i < out.length; i++) {
    let v: number;
    if (kind === 'saw') {
      v = 2 * phase - 1 - polyBlep(phase, dt);
    } else {
      v = phase < 0.5 ? 1 : -1;
      v += polyBlep(phase, dt);
      v -= polyBlep((phase + 0.5) % 1, dt);
    }
    phase += dt;
    if (phase >= 1) phase -= 1;
    if ((i & 31) === 0) a = 1 - Math.exp((-2 * Math.PI * Math.max(f * 1.5, cutoff)) / sr);
    y += a * (v - y);
    out[i] = y * env * (i < attackLen ? i / attackLen : 1);
    cutoff *= cutMul;
    env *= envMul;
  }
  return out;
}

/** Looping white noise. */
export function whiteNoise(seconds: number, sr: number, seed = 42): Float32Array {
  const n = noiseSource(seed);
  const out = new Float32Array(Math.ceil(seconds * sr));
  for (let i = 0; i < out.length; i++) out[i] = n();
  return out;
}

/** Vinyl crackle + hiss loop for lo-fi styles. */
export function vinylCrackle(seconds: number, sr: number): Float32Array {
  const r = mulberry32(777);
  const out = new Float32Array(Math.ceil(seconds * sr));
  for (let i = 0; i < out.length; i++) out[i] = (r() * 2 - 1) * 0.02;
  lowpass(out, sr, 3500);
  for (let k = 0; k < seconds * 9; k++) {
    const at = Math.floor(r() * out.length);
    const amp = 0.2 + r() * 0.5;
    const len = Math.floor(sr * (0.0004 + r() * 0.0012));
    for (let j = 0; j < len && at + j < out.length; j++) out[at + j] += (r() * 2 - 1) * amp * (1 - j / len);
  }
  highpass(out, sr, 500);
  return out;
}

/** Stereo convolution reverb impulse with a darkening tail. */
export function reverbImpulse(seconds: number, sr: number): [Float32Array, Float32Array] {
  const length = Math.ceil(seconds * sr);
  const pre = Math.floor(0.012 * sr);
  const channels: [Float32Array, Float32Array] = [new Float32Array(length), new Float32Array(length)];
  channels.forEach((ch, c) => {
    const n = noiseSource(1234 + c * 99);
    let y = 0;
    for (let i = pre; i < length; i++) {
      const t = (i - pre) / sr;
      const progress = i / length;
      const a = 0.1 + 0.82 * progress;
      y = y * a + n() * (1 - a);
      ch[i] = y * Math.exp((-6.9 * t) / seconds) * (1 + progress * 2);
    }
    // A few early reflections.
    for (const [ms, g] of [
      [7, 0.5],
      [13, 0.35],
      [21, 0.25],
      [29, 0.18],
    ]) {
      const at = pre + Math.floor((ms + c * 2.5) * sr * 0.001);
      if (at < length) ch[at] += g;
    }
  });
  return channels;
}
