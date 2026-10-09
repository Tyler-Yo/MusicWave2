/**
 * One shared requestAnimationFrame loop that samples the playback clock once per
 * frame and fans the time out to subscribers (seek bars, lyrics, visuals).
 * The loop only runs while something is subscribed.
 */
import { getAudioEngine } from './audioEngine';

type Listener = (time: number) => void;

const listeners = new Set<Listener>();
let raf = 0;
let lastTime = -1;
let force = false;

function frame() {
  raf = requestAnimationFrame(frame);
  const engine = getAudioEngine();
  const t = engine.clock.now();
  if (t === lastTime && !force && engine.paused) return;
  lastTime = t;
  force = false;
  listeners.forEach((l) => l(t));
}

export function subscribePlaybackTime(listener: Listener): () => void {
  listeners.add(listener);
  force = true;
  if (!raf) raf = requestAnimationFrame(frame);
  // Deliver the current value immediately.
  listener(getAudioEngine().clock.now());
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}

/** Forces the next frame to notify (e.g. after a seek while paused). */
export function invalidatePlaybackTime(): void {
  force = true;
}

export function currentPlaybackTime(): number {
  return getAudioEngine().clock.now();
}
