/** AudioBuffer → 16-bit PCM WAV, plus lightweight analysis for waveforms and visuals. */

export function encodeWav(buffer: AudioBuffer): Blob {
  const channels = Math.min(2, buffer.numberOfChannels);
  const frames = buffer.length;
  const bytesPerSample = 2;
  const dataBytes = frames * channels * bytesPerSample;
  const out = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(out);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);

  const pcm = new Int16Array(out, 44, frames * channels);
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let k = 0;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      pcm[k++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
  }
  return new Blob([out], { type: 'audio/wav' });
}

export interface AudioAnalysis {
  /** Normalized peak per bin (for the waveform seek bar). */
  peaks: number[];
  /** Normalized RMS energy at `frameRate` frames per second (for visuals). */
  energy: number[];
  frameRate: number;
}

export function analyzeBuffer(buffer: AudioBuffer, bins = 480, frameRate = 30): AudioAnalysis {
  const ch0 = buffer.getChannelData(0);
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;
  const n = buffer.length;
  const peaks: number[] = new Array(bins).fill(0);
  const per = n / bins;
  for (let b = 0; b < bins; b++) {
    const start = Math.floor(b * per);
    const end = Math.min(n, Math.floor((b + 1) * per));
    let max = 0;
    for (let i = start; i < end; i += 8) {
      const v = Math.abs(ch0[i]) + Math.abs(ch1[i]);
      if (v > max) max = v;
    }
    peaks[b] = max / 2;
  }
  const frameLen = Math.floor(buffer.sampleRate / frameRate);
  const frames = Math.ceil(n / frameLen);
  const energy: number[] = new Array(frames).fill(0);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    let cnt = 0;
    for (let i = f * frameLen; i < Math.min(n, (f + 1) * frameLen); i += 4) {
      const v = (ch0[i] + ch1[i]) / 2;
      sum += v * v;
      cnt++;
    }
    energy[f] = Math.sqrt(sum / Math.max(1, cnt));
  }
  const maxPeak = Math.max(1e-6, ...peaks);
  const maxEnergy = Math.max(1e-6, ...energy);
  return {
    peaks: peaks.map((p) => Math.round((p / maxPeak) * 1000) / 1000),
    energy: energy.map((e) => Math.round((e / maxEnergy) * 1000) / 1000),
    frameRate,
  };
}
