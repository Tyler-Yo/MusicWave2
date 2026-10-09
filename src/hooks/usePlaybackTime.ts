/**
 * Subscribes to the shared playback clock.
 *  - `usePlaybackTime(hz)` re-renders at most `hz` times per second (for text/time labels).
 *  - `usePlaybackFrame(cb)` runs a callback every animation frame without re-rendering
 *    (for lyrics and visuals that update the DOM directly).
 */
import { useEffect, useRef, useState } from 'react';
import { subscribePlaybackTime } from '@/services/playbackTicker';

export function usePlaybackTime(hz = 10): number {
  const [time, setTime] = useState(0);
  useEffect(() => {
    let last = 0;
    let lastValue = -1;
    const minGap = 1000 / hz;
    return subscribePlaybackTime((t) => {
      const now = performance.now();
      if (now - last < minGap && Math.abs(t - lastValue) < 1) return;
      last = now;
      if (Math.abs(t - lastValue) < 0.001) return;
      lastValue = t;
      setTime(t);
    });
  }, [hz]);
  return time;
}

export function usePlaybackFrame(callback: (time: number) => void, enabled = true): void {
  const ref = useRef(callback);
  ref.current = callback;
  useEffect(() => {
    if (!enabled) return;
    return subscribePlaybackTime((t) => ref.current(t));
  }, [enabled]);
}
