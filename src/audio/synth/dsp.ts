/**
 * Small, allocation-free DSP building blocks for the JS synth engine.
 * Everything here runs per sample inside a Web Worker (or Node, in tests).
 */

const TABLE_SIZE = 4096;
const SINE = new Float32Array(TABLE_SIZE + 1);
for (let i = 0; i <= TABLE_SIZE; i++) SINE[i] = Math.sin((2 * Math.PI * i) / TABLE_SIZE);

/** Fast sine of a phase measured in cycles. */
export function sinCycles(phase: number): number {
  const p = phase - Math.floor(phase);
  const x = p * TABLE_SIZE;
  const i = x | 0;
  return SINE[i] + (SINE[i + 1] - SINE[i]) * (x - i);
}

/** PolyBLEP residual — smooths the discontinuity of naive saw/square waves. */
export function polyBlep(t: number, dt: number): number {
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

export type Wave = 'saw' | 'square' | 'triangle' | 'sine';

/** One band-limited oscillator sample; returns the new phase via the `state` object. */
export class Osc {
  phase = 0;
  constructor(public wave: Wave) {}
  /** `dt` = frequency / sampleRate. */
  next(dt: number): number {
    const p = this.phase;
    let v: number;
    switch (this.wave) {
      case 'saw':
        v = 2 * p - 1 - polyBlep(p, dt);
        break;
      case 'square':
        v = (p < 0.5 ? 1 : -1) + polyBlep(p, dt) - polyBlep((p + 0.5) % 1, dt);
        break;
      case 'triangle':
        v = p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
        break;
      default:
        v = sinCycles(p);
    }
    let np = p + dt;
    if (np >= 1) np -= 1;
    this.phase = np;
    return v;
  }
}

/**
 * Zero-delay-feedback state-variable filter (Zavalishin TPT form).
 * `low` and `band` outputs are updated by `process`. `band` is normalized to unity peak gain.
 */
export class SVF {
  private ic1 = 0;
  private ic2 = 0;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  private k = 1;
  low = 0;
  band = 0;
  constructor(private sr: number) {}
  set(cutoff: number, q: number): void {
    const g = Math.tan((Math.PI * Math.min(cutoff, this.sr * 0.48)) / this.sr);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }
  process(v0: number): void {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.low = v2;
    this.band = v1 * this.k;
  }
  reset(): void {
    this.ic1 = 0;
    this.ic2 = 0;
  }
}

/**
 * Feedback-delay-network reverb (8 lines, Householder feedback, damped),
 * processed at half the sample rate for speed and added back to L/R.
 */
export function fdnReverb(
  send: Float32Array,
  outL: Float32Array,
  outR: Float32Array,
  sr: number,
  rt60: number,
  wet: number,
): void {
  const hr = sr / 2;
  const n = Math.floor(send.length / 2);
  const delaysMs = [29.7, 37.1, 41.1, 43.7, 53.3, 59.9, 67.1, 73.3];
  const lines = delaysMs.map((ms) => new Float32Array(Math.max(8, Math.round((ms / 1000) * hr))));
  const pos = new Int32Array(8);
  const gains = lines.map((l) => Math.pow(10, (-3 * l.length) / (rt60 * hr)));
  const lp = new Float32Array(8);
  const damp = 0.42;
  // Input diffusion: two allpasses + predelay.
  const pre = new Float32Array(Math.round(0.012 * hr));
  let prePos = 0;
  const ap1 = new Float32Array(Math.round(0.0051 * hr));
  const ap2 = new Float32Array(Math.round(0.0077 * hr));
  let ap1Pos = 0;
  let ap2Pos = 0;
  const apG = 0.6;
  const half = new Float32Array(n * 2);
  const outs = new Float32Array(8);
  let inLp = 0;

  for (let i = 0; i < n; i++) {
    // Decimate with a simple low-pass.
    const x0 = (send[2 * i] + send[2 * i + 1]) * 0.5;
    inLp += 0.6 * (x0 - inLp);
    let x = pre[prePos];
    pre[prePos] = inLp;
    if (++prePos >= pre.length) prePos = 0;
    // Allpass diffusers.
    let d = ap1[ap1Pos];
    let y = -apG * x + d;
    ap1[ap1Pos] = x + apG * y;
    if (++ap1Pos >= ap1.length) ap1Pos = 0;
    x = y;
    d = ap2[ap2Pos];
    y = -apG * x + d;
    ap2[ap2Pos] = x + apG * y;
    if (++ap2Pos >= ap2.length) ap2Pos = 0;
    x = y;

    let sum = 0;
    for (let k = 0; k < 8; k++) {
      const v = lines[k][pos[k]];
      outs[k] = v;
      sum += v;
    }
    const s = sum * 0.25; // Householder: y - (2/N)·Σy
    let l = 0;
    let r = 0;
    for (let k = 0; k < 8; k++) {
      const fb = (outs[k] - s) * gains[k];
      lp[k] += damp * (fb - lp[k]);
      const line = lines[k];
      line[pos[k]] = lp[k] + (k % 2 === 0 ? x : -x);
      if (++pos[k] >= line.length) pos[k] = 0;
      if (k % 2 === 0) l += outs[k];
      else r += outs[k];
    }
    half[2 * i] = l * 0.35;
    half[2 * i + 1] = r * 0.35;
  }
  // Upsample (linear) and mix.
  for (let i = 0; i < n - 1; i++) {
    const l0 = half[2 * i];
    const r0 = half[2 * i + 1];
    const l1 = half[2 * i + 2];
    const r1 = half[2 * i + 3];
    outL[2 * i] += l0 * wet;
    outR[2 * i] += r0 * wet;
    outL[2 * i + 1] += (l0 + l1) * 0.5 * wet;
    outR[2 * i + 1] += (r0 + r1) * 0.5 * wet;
  }
}

/** Stereo ping-pong delay with damping in the feedback path. */
export function pingPongDelay(
  send: Float32Array,
  outL: Float32Array,
  outR: Float32Array,
  sr: number,
  seconds: number,
  feedback: number,
  wet: number,
): void {
  const len = Math.max(1, Math.round(seconds * sr));
  const bufL = new Float32Array(len);
  const bufR = new Float32Array(len);
  let p = 0;
  let lpL = 0;
  let lpR = 0;
  const damp = 1 - Math.exp((-2 * Math.PI * 3200) / sr);
  for (let i = 0; i < send.length; i++) {
    const dl = bufL[p];
    const dr = bufR[p];
    lpL += damp * (dl - lpL);
    lpR += damp * (dr - lpR);
    bufL[p] = send[i] + lpR * feedback;
    bufR[p] = lpL * feedback;
    outL[i] += lpL * wet;
    outR[i] += lpR * wet;
    if (++p >= len) p = 0;
  }
}

/** Equal-power pan law: [left, right] gains for pan in [-1, 1] (unity at center). */
export function panGains(pan: number): [number, number] {
  const a = ((pan + 1) / 2) * (Math.PI / 2);
  return [Math.cos(a) * Math.SQRT2, Math.sin(a) * Math.SQRT2];
}
