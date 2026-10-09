/**
 * Main-thread client for the synth worker pool.
 *
 * - Foreground renders (the track the listener just pressed play on) jump the queue;
 *   if every worker is busy with background prefetches, one is terminated and the
 *   prefetch is re-queued so playback starts as fast as possible.
 * - Identical concurrent requests share one render.
 * - Falls back to rendering on the main thread when Workers are unavailable.
 */
import { renderSongToWav, type AudioAnalysis } from './engine';
import type { Composition } from './types';

export interface SynthResult {
  wav: ArrayBuffer;
  analysis: AudioAnalysis;
  duration: number;
}

type Priority = 'foreground' | 'background';

interface Job {
  id: number;
  composition: Composition;
  priority: Priority;
  progressListeners: Set<(p: number) => void>;
  resolve: (r: SynthResult) => void;
  reject: (e: Error) => void;
  promise: Promise<SynthResult>;
}

interface Slot {
  worker: Worker;
  job: Job | null;
}

const MAX_WORKERS =
  typeof navigator !== 'undefined' && navigator.hardwareConcurrency >= 4 ? 2 : 1;

let nextId = 1;
const queue: Job[] = [];
const slots: Slot[] = [];
const inflight = new Map<string, Job>();
let workersSupported = typeof Worker !== 'undefined';

function createWorker(): Worker | null {
  try {
    return new Worker(new URL('./synthWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    workersSupported = false;
    return null;
  }
}

function attach(slot: Slot) {
  slot.worker.onmessage = (e: MessageEvent) => {
    const job = slot.job;
    const data = e.data as { id: number; progress?: number; wav?: ArrayBuffer; analysis?: AudioAnalysis; duration?: number; error?: string };
    if (!job || data.id !== job.id) return;
    if (data.progress !== undefined) {
      job.progressListeners.forEach((l) => l(data.progress as number));
      return;
    }
    slot.job = null;
    inflight.delete(job.composition.id);
    if (data.wav && data.analysis && data.duration !== undefined) {
      job.resolve({ wav: data.wav, analysis: data.analysis, duration: data.duration });
    } else {
      job.reject(new Error(data.error ?? 'Audio render failed'));
    }
    pump();
  };
  slot.worker.onerror = (e) => {
    e.preventDefault();
    const job = slot.job;
    slot.job = null;
    slot.worker.terminate();
    const replacement = createWorker();
    if (replacement) {
      slot.worker = replacement;
      attach(slot);
    } else {
      slots.splice(slots.indexOf(slot), 1);
    }
    if (job) {
      inflight.delete(job.composition.id);
      job.reject(new Error('The audio engine crashed while rendering this track.'));
    }
    pump();
  };
}

function freeSlot(): Slot | null {
  const idle = slots.find((s) => !s.job);
  if (idle) return idle;
  if (slots.length < MAX_WORKERS) {
    const worker = createWorker();
    if (!worker) return null;
    const slot: Slot = { worker, job: null };
    attach(slot);
    slots.push(slot);
    return slot;
  }
  return null;
}

function start(slot: Slot, job: Job) {
  slot.job = job;
  slot.worker.postMessage({ id: job.id, composition: job.composition });
}

function pump() {
  queue.sort((a, b) => (a.priority === b.priority ? a.id - b.id : a.priority === 'foreground' ? -1 : 1));
  while (queue.length) {
    const slot = freeSlot();
    if (!slot) break;
    start(slot, queue.shift() as Job);
  }
  // A waiting foreground job pre-empts a background render.
  const fg = queue.find((j) => j.priority === 'foreground');
  if (fg) {
    const victim = slots.find((s) => s.job?.priority === 'background');
    if (victim && victim.job) {
      const bg = victim.job;
      victim.worker.terminate();
      const worker = createWorker();
      if (!worker) return;
      victim.worker = worker;
      attach(victim);
      victim.job = null;
      queue.push(bg);
      queue.splice(queue.indexOf(fg), 1);
      start(victim, fg);
    }
  }
}

async function renderInline(job: Job) {
  await new Promise((r) => setTimeout(r, 0));
  try {
    const result = renderSongToWav(job.composition, { onProgress: (p) => job.progressListeners.forEach((l) => l(p)) });
    job.resolve(result);
  } catch (err) {
    job.reject(err instanceof Error ? err : new Error(String(err)));
  } finally {
    inflight.delete(job.composition.id);
  }
}

export function renderCompositionAudio(
  composition: Composition,
  options: { priority?: Priority; onProgress?: (p: number) => void } = {},
): Promise<SynthResult> {
  const priority = options.priority ?? 'foreground';
  const existing = inflight.get(composition.id);
  if (existing) {
    if (options.onProgress) existing.progressListeners.add(options.onProgress);
    if (priority === 'foreground' && existing.priority === 'background') {
      existing.priority = 'foreground';
      pump();
    }
    return existing.promise;
  }
  let resolve!: (r: SynthResult) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<SynthResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const job: Job = {
    id: nextId++,
    composition,
    priority,
    progressListeners: new Set(options.onProgress ? [options.onProgress] : []),
    resolve,
    reject,
    promise,
  };
  inflight.set(composition.id, job);
  if (!workersSupported) {
    void renderInline(job);
  } else {
    queue.push(job);
    pump();
    if (!workersSupported && queue.includes(job)) {
      queue.splice(queue.indexOf(job), 1);
      void renderInline(job);
    }
  }
  return promise;
}

/** True while a render for this composition is queued or running. */
export function isRendering(compositionId: string): boolean {
  return inflight.has(compositionId);
}
