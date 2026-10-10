/** Lyrics controls: sync offset, karaoke mode, text size, in-song search, Studio link. */
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AArrowDown, AArrowUp, ChevronDown, ChevronUp, Minus, PenLine, Plus, RotateCcw, Search, Sparkles, X } from 'lucide-react';
import { useSettings } from '@/hooks/usePlayer';
import { OFFSET_STEP, settingsActions } from '@/state/settingsStore';
import type { LyricsKind, LyricsSourceKind } from '@/types/lyrics';
import { cn } from '@/utils/cn';
import { formatOffset } from '@/utils/format';

const pill = 'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition';

export function LyricsToolbar({
  trackId,
  kind,
  source,
  search,
  onSearchChange,
  searchOpen,
  onSearchOpen,
  matchCount,
  matchIndex,
  onMatchNav,
  onMatchSeek,
  tone = 'immersive',
}: {
  trackId: string;
  kind: LyricsKind;
  source: LyricsSourceKind | null;
  search: string;
  onSearchChange: (q: string) => void;
  searchOpen: boolean;
  onSearchOpen: (open: boolean) => void;
  matchCount: number;
  matchIndex: number;
  onMatchNav: (dir: 1 | -1) => void;
  onMatchSeek: () => void;
  tone?: 'immersive' | 'panel';
}) {
  const offset = useSettings((s) => s.lyricsOffsets[trackId] ?? 0);
  const karaoke = useSettings((s) => s.karaoke);
  const scale = useSettings((s) => s.lyricsScale);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const surface = tone === 'immersive' ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-fg/[0.07] text-fg hover:bg-fg/[0.12]';
  const iconBtn = cn('grid h-8 w-8 place-items-center rounded-full transition', surface);

  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Lyrics controls">
      <span
        className={cn(pill, 'cursor-default', tone === 'immersive' ? 'bg-white/10 text-white/80' : 'bg-fg/[0.07] text-muted')}
        title={kind === 'enhanced' ? 'Word-by-word timing from the LRC file' : 'Line timing; word progress is interpolated'}
      >
        {kind === 'enhanced' ? 'Word-synced' : 'Line-synced'}
        {source === 'custom' && <span className="rounded-full bg-primary/25 px-1.5 text-[10px] text-primary">Custom</span>}
        {source === 'lrclib' && <span className={cn('rounded-full px-1.5 text-[10px]', tone === 'immersive' ? 'bg-white/15' : 'bg-fg/10')}>LRCLIB</span>}
      </span>

      <div className={cn('flex items-center rounded-full', tone === 'immersive' ? 'bg-white/10' : 'bg-fg/[0.07]')} role="group" aria-label="Lyrics timing offset">
        <button
          className={cn(iconBtn, 'bg-transparent')}
          onClick={() => settingsActions.nudgeOffset(trackId, -OFFSET_STEP)}
          aria-label={`Show lyrics later by ${OFFSET_STEP} seconds`}
          title="Lyrics too early? Delay them (−0.25 s)  ["
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          className={cn('min-w-[4.5rem] px-1 text-center text-xs font-bold tabular-nums', tone === 'immersive' ? 'text-white' : 'text-fg')}
          onClick={() => settingsActions.resetOffset(trackId)}
          aria-label={`Lyrics offset ${formatOffset(offset)}. Activate to reset.`}
          title="Sync offset (click to reset)"
        >
          {offset === 0 ? (
            'Sync 0.00s'
          ) : (
            <span className="inline-flex items-center gap-1">
              {formatOffset(offset)} <RotateCcw className="h-3 w-3 opacity-70" />
            </span>
          )}
        </button>
        <button
          className={cn(iconBtn, 'bg-transparent')}
          onClick={() => settingsActions.nudgeOffset(trackId, OFFSET_STEP)}
          aria-label={`Show lyrics earlier by ${OFFSET_STEP} seconds`}
          title="Lyrics too late? Advance them (+0.25 s)  ]"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <button
        className={cn(pill, karaoke ? 'bg-primary text-on-primary' : surface)}
        onClick={() => settingsActions.toggleKaraoke()}
        aria-pressed={karaoke}
        title="Karaoke mode (K)"
      >
        <Sparkles className="h-3.5 w-3.5" /> Karaoke
      </button>

      <div className="flex items-center gap-1">
        <button className={iconBtn} onClick={() => settingsActions.set('lyricsScale', Math.max(0.8, +(scale - 0.1).toFixed(2)))} aria-label="Smaller lyrics">
          <AArrowDown className="h-4 w-4" />
        </button>
        <button className={iconBtn} onClick={() => settingsActions.set('lyricsScale', Math.min(1.5, +(scale + 0.1).toFixed(2)))} aria-label="Larger lyrics">
          <AArrowUp className="h-4 w-4" />
        </button>
      </div>

      {searchOpen ? (
        <div className={cn('flex h-8 items-center gap-1 rounded-full pl-3 pr-1', tone === 'immersive' ? 'bg-white/15 text-white' : 'bg-fg/[0.08] text-fg')}>
          <Search className="h-3.5 w-3.5 opacity-70" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) onMatchNav(-1);
                else onMatchSeek();
              } else if (e.key === 'Escape') {
                e.stopPropagation();
                onSearchOpen(false);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                onMatchNav(1);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                onMatchNav(-1);
              }
            }}
            placeholder="Find in lyrics"
            aria-label="Search these lyrics"
            className="w-28 bg-transparent text-xs font-medium outline-none placeholder:opacity-60 sm:w-36"
          />
          <span className="min-w-[3rem] text-center text-[11px] tabular-nums opacity-75" aria-live="polite">
            {search.trim() ? (matchCount ? `${matchIndex + 1}/${matchCount}` : 'No match') : ''}
          </span>
          <button className="grid h-6 w-6 place-items-center rounded-full hover:bg-white/10" onClick={() => onMatchNav(-1)} aria-label="Previous match" disabled={!matchCount}>
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button className="grid h-6 w-6 place-items-center rounded-full hover:bg-white/10" onClick={() => onMatchNav(1)} aria-label="Next match" disabled={!matchCount}>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button className="grid h-6 w-6 place-items-center rounded-full hover:bg-white/10" onClick={() => onSearchOpen(false)} aria-label="Close lyrics search">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button className={iconBtn} onClick={() => onSearchOpen(true)} aria-label="Search lyrics" title="Search lyrics">
          <Search className="h-4 w-4" />
        </button>
      )}

      <Link to={`/studio?track=${encodeURIComponent(trackId)}`} className={cn(pill, surface)} title="Edit or re-sync these lyrics">
        <PenLine className="h-3.5 w-3.5" /> Edit
      </Link>
    </div>
  );
}
