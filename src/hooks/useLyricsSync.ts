/**
 * Frame-accurate lyric synchronization.
 *
 * Each animation frame (via the shared playback clock):
 *   lyricTime = mediaTime + shift
 *   active    = binary search over the timeline's activation times
 *   word fill = (lyricTime − word.start) / (word.end − word.start), written as a CSS
 *               variable directly on the word's <span> — no React re-render per frame.
 *
 * React state changes only when the active item changes (a few times per line), so
 * the cost per frame is a binary search plus a handful of style writes. Seeking,
 * pausing, rate changes and track switches need no special handling: every frame
 * is computed from the current time alone.
 */
import { useEffect, useRef, useState } from 'react';
import { findActiveIndex, segmentProgress } from '@/services/lrc/timing';
import type { LyricsTimeline } from '@/types/lyrics';
import { usePlaybackFrame } from './usePlaybackTime';

export interface LyricsSyncOptions {
  timeline: LyricsTimeline;
  /** Seconds added to media time (per-track offset + latency compensation). */
  shift: number;
  /** Root element containing `[data-item-index]` children. */
  rootRef: React.RefObject<HTMLElement | null>;
  enabled?: boolean;
  /** Called every frame with the lyric time and active index (karaoke ball, countdowns…). */
  onFrame?: (lyricTime: number, activeIndex: number) => void;
}

export interface LyricsSyncState {
  activeIndex: number;
  finished: boolean;
}

export function useLyricsSync({ timeline, shift, rootRef, enabled = true, onFrame }: LyricsSyncOptions): LyricsSyncState {
  const [state, setState] = useState<LyricsSyncState>({ activeIndex: -1, finished: false });
  const activeRef = useRef(-1);
  const finishedRef = useRef(false);
  const wordsRef = useRef<HTMLElement[]>([]);
  const lastP = useRef<number[]>([]);
  const itemElRef = useRef<HTMLElement | null>(null);

  // Reset when the lyrics change (track switch / edits).
  useEffect(() => {
    activeRef.current = -1;
    finishedRef.current = false;
    wordsRef.current = [];
    itemElRef.current = null;
    setState({ activeIndex: -1, finished: false });
  }, [timeline]);

  const clearActive = () => {
    for (const w of wordsRef.current) {
      w.style.removeProperty('--p');
      w.removeAttribute('data-sung');
    }
    itemElRef.current?.style.removeProperty('--lp');
    itemElRef.current?.style.removeProperty('--p');
    wordsRef.current = [];
    lastP.current = [];
    itemElRef.current = null;
  };

  usePlaybackFrame((mediaTime) => {
    const t = mediaTime + shift;
    const idx = findActiveIndex(timeline, t);
    const finished = t >= timeline.finishedAt;

    if (idx !== activeRef.current || finished !== finishedRef.current) {
      clearActive();
      activeRef.current = idx;
      finishedRef.current = finished;
      setState({ activeIndex: idx, finished });
    }

    const item = idx >= 0 ? timeline.items[idx] : undefined;
    if (item && !finished) {
      if (!itemElRef.current) {
        itemElRef.current = rootRef.current?.querySelector<HTMLElement>(`[data-item-index="${idx}"]`) ?? null;
        wordsRef.current = itemElRef.current ? Array.from(itemElRef.current.querySelectorAll<HTMLElement>('.lyric-word')) : [];
      }
      const el = itemElRef.current;
      if (el && item.type === 'line') {
        const words = item.line.words;
        const els = wordsRef.current;
        for (let i = 0; i < words.length && i < els.length; i++) {
          const p = segmentProgress(words[i], t);
          if (Math.abs((lastP.current[i] ?? -1) - p) > 0.002) {
            lastP.current[i] = p;
            els[i].style.setProperty('--p', p.toFixed(4));
            const sung = p > 0 && p < 1 ? '1' : '0';
            if (els[i].dataset.sung !== sung) els[i].dataset.sung = sung;
          }
        }
        const lp = segmentProgress(item.line, t);
        el.style.setProperty('--lp', lp.toFixed(4));
      } else if (el && item.type === 'interlude') {
        el.style.setProperty('--p', segmentProgress(item, t).toFixed(4));
      }
    }
    onFrame?.(t, idx);
  }, enabled && timeline.items.length > 0);

  return state;
}
