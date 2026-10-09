/** Current + next lyric line for the mini player (shown when there is room). */
import { useMemo, useRef } from 'react';
import { useLyrics } from '@/hooks/useLyrics';
import { useLyricsSync } from '@/hooks/useLyricsSync';
import { useSettings } from '@/hooks/usePlayer';
import { buildTimeline } from '@/services/lrc/timing';
import { ui } from '@/state/uiStore';
import { lyricShift } from '@/state/settingsStore';
import type { Track } from '@/types/music';

export function MiniLyrics({ track }: { track: Track }) {
  const { lyrics } = useLyrics(track);
  const shift = useSettings((s) => lyricShift(track.id, s));
  const timeline = useMemo(() => buildTimeline(lyrics), [lyrics]);
  const rootRef = useRef<HTMLButtonElement>(null);
  const { activeIndex, finished } = useLyricsSync({ timeline, shift, rootRef });

  if (!lyrics || lyrics.kind === 'plain' || timeline.items.length === 0) return null;
  const item = activeIndex >= 0 && !finished ? timeline.items[activeIndex] : undefined;
  const nextLine = timeline.items.slice(Math.max(0, activeIndex + 1)).find((it) => it.type === 'line');

  return (
    <button
      ref={rootRef}
      onClick={() => ui.openNowPlaying('lyrics')}
      className="group flex min-w-0 max-w-full flex-col items-start rounded-lg px-2 py-1 text-left [--lyric-off:var(--c-fg)] [--lyric-on:var(--c-fg)] hover:bg-fg/5"
      aria-label="Open lyrics"
    >
      <span className="block w-full truncate text-[13px] font-bold leading-tight" key={activeIndex}>
        {item?.type === 'line' ? (
          <span data-item-index={activeIndex} className="lyric-line !cursor-pointer !opacity-100 ![transform:none] before:!hidden" data-state="active">
            {item.line.words.map((w, i) => (
              <span key={i}>
                <span className="lyric-word">{w.text}</span>
                {w.trailingSpace ? ' ' : ''}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-muted">♪ ♪ ♪</span>
        )}
      </span>
      {nextLine?.type === 'line' && <span className="block w-full truncate text-xs text-subtle">{nextLine.line.text}</span>}
    </button>
  );
}
