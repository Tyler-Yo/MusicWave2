/**
 * One lyric line. Word fill is driven imperatively by useLyricsSync through the
 * `--p` CSS variable on each `.lyric-word`; this component only re-renders when
 * the line's state (past / active / next / future) or search highlight changes.
 */
import { memo, type ReactNode } from 'react';
import type { LyricLine as Line } from '@/types/lyrics';
import { formatTime } from '@/utils/format';

export type LineState = 'past' | 'active' | 'next' | 'future';

/** Groups segments into words (syllable segments without trailing spaces stay together). */
function renderWords(line: Line): ReactNode[] {
  const out: ReactNode[] = [];
  let group: ReactNode[] = [];
  let inParens = false;
  line.words.forEach((w, i) => {
    const opens = w.text.startsWith('(');
    if (opens) inParens = true;
    const bg = inParens;
    if (w.text.endsWith(')')) inParens = false;
    group.push(
      <span key={i} className={bg ? 'lyric-word lyric-bg' : 'lyric-word'}>
        {w.text}
      </span>,
    );
    if (w.trailingSpace || i === line.words.length - 1) {
      out.push(
        <span key={`g${i}`} className="whitespace-nowrap">
          {group}
        </span>,
      );
      if (i < line.words.length - 1) out.push(' ');
      group = [];
    }
  });
  return out;
}

export const LyricLine = memo(function LyricLine({
  line,
  itemIndex,
  state,
  match,
  onSeek,
}: {
  line: Line;
  itemIndex: number;
  state: LineState;
  match: boolean;
  onSeek: (line: Line) => void;
}) {
  return (
    <button
      type="button"
      data-item-index={itemIndex}
      data-state={state}
      aria-current={state === 'active' ? 'true' : undefined}
      aria-label={`${line.text} — jump to ${formatTime(line.start)}`}
      onClick={() => onSeek(line)}
      className={`lyric-line rounded-lg py-[0.08em] outline-offset-8 ${match ? 'lyric-match' : ''}`}
    >
      {renderWords(line)}
    </button>
  );
});

export const Interlude = memo(function Interlude({ itemIndex, active, karaoke }: { itemIndex: number; active: boolean; karaoke: boolean }) {
  return (
    <div
      data-item-index={itemIndex}
      aria-hidden="true"
      className={`lyric-interlude flex items-center gap-[0.38em] transition-all duration-500 ease-out-expo ${
        karaoke ? 'justify-center' : ''
      } ${active ? 'h-[1.3em] opacity-100' : 'h-0 opacity-0'}`}
    >
      <span className="dot" />
      <span className="dot" />
      <span className="dot" />
      {karaoke && <span data-countdown className="ml-[0.5em] min-w-[1ch] text-[0.7em] font-black tabular-nums text-primary" />}
    </div>
  );
});
