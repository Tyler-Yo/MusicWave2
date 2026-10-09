/// <reference lib="webworker" />
/**
 * Synth worker: renders a composition to WAV bytes off the main thread.
 *
 * in:  { id, composition, sampleRate? }
 * out: { id, progress } … then { id, wav, analysis, duration } (wav transferred) or { id, error }
 */
import { renderSongToWav } from './engine';
import type { Composition } from './types';

interface RenderRequest {
  id: number;
  composition: Composition;
  sampleRate?: number;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<RenderRequest>) => {
  const { id, composition, sampleRate } = event.data;
  let lastSent = 0;
  try {
    const result = renderSongToWav(composition, {
      sampleRate,
      onProgress: (p) => {
        if (p - lastSent >= 0.05 || p === 1) {
          lastSent = p;
          ctx.postMessage({ id, progress: p });
        }
      },
    });
    ctx.postMessage({ id, wav: result.wav, analysis: result.analysis, duration: result.duration }, [result.wav]);
  } catch (err) {
    ctx.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
