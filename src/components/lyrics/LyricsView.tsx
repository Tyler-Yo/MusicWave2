/**
 * The synchronized lyrics experience.
 *
 *  - Active line highlighted, past lines dimmed, upcoming lines previewed.
 *  - Word-by-word fill (enhanced LRC) or interpolated sweep (line-level LRC).
 *  - Spring-smoothed auto-scroll keeps the active line centered; manual scrolling
 *    pauses it (with a "Back to live lyrics" button) and it resumes after 5 s idle.
 *  - Click any line to jump the audio to it (accounting for the sync offset).
 *  - Karaoke mode: bigger centered text, bouncing ball over each word, interlude countdown.
 *  - In-song search with match highlighting and navigation.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { LocateFixed, Music2, PenLine } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useLyricsSync } from '@/hooks/useLyricsSync';
import { useIsCurrent, useSettings } from '@/hooks/usePlayer';
import { buildTimeline } from '@/services/lrc/timing';
import { normalize } from '@/services/search';
import { player } from '@/state/playerStore';
import { lyricShift } from '@/state/settingsStore';
import type { LyricLine as Line, LyricsSourceKind, ParsedLyrics } from '@/types/lyrics';
import type { Track } from '@/types/music';
import { cn } from '@/utils/cn';
import { Interlude, LyricLine, type LineState } from './LyricLine';
import { LyricsToolbar } from './LyricsToolbar';

export type LyricsVariant = 'immersive' | 'panel';

interface Props {
  track: Track;
  lyrics: ParsedLyrics | null;
  source: LyricsSourceKind | null;
  variant?: LyricsVariant;
  showToolbar?: boolean;
  className?: string;
}

const RESUME_AFTER_MS = 5000;

export function LyricsView({ track, lyrics, source, variant = 'immersive', showToolbar = true, className }: Props) {
  const { current } = useIsCurrent(track.id);
  const karaoke = useSettings((s) => s.karaoke);
  const scale = useSettings((s) => s.lyricsScale);
  const shift = useSettings((s) => lyricShift(track.id, s));
  const reduced = useReducedMotion();

  const timeline = useMemo(() => buildTimeline(lyrics), [lyrics]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLSpanElement>(null);

  // ---- karaoke ball & countdown (per-frame, imperative) --------------------------------------
  const ballCache = useRef<{ idx: number; at: number; xs: number[]; ys: number[] } | null>(null);
  const onFrame = useCallback(
    (t: number, idx: number) => {
      const ball = ballRef.current;
      const content = contentRef.current;
      if (!content) return;
      const item = idx >= 0 ? timeline.items[idx] : undefined;
      if (karaoke && item?.type === 'interlude') {
        const el = content.querySelector<HTMLElement>(`[data-item-index="${idx}"] [data-countdown]`);
        if (el) {
          const left = item.end - t;
          const text = left <= 3.05 && left > 0 ? String(Math.ceil(left - 0.05)) : '';
          if (el.textContent !== text) el.textContent = text;
        }
      }
      if (!ball) return;
      if (!karaoke || item?.type !== 'line' || t > item.line.end + 0.3) {
        ball.style.opacity = '0';
        return;
      }
      const now = performance.now();
      const cache = ballCache.current;
      // Re-measure while the line is still animating into its active size.
      if (!cache || cache.idx !== idx || now - cache.at < 700) {
        const lineEl = content.querySelector<HTMLElement>(`[data-item-index="${idx}"]`);
        const words = lineEl ? Array.from(lineEl.querySelectorAll<HTMLElement>('.lyric-word')) : [];
        if (!lineEl || words.length === 0) return;
        const base = content.getBoundingClientRect();
        const rects = words.map((w) => w.getBoundingClientRect());
        ballCache.current = {
          idx,
          at: cache && cache.idx === idx ? cache.at : now,
          xs: rects.map((r) => r.left - base.left + r.width / 2),
          ys: rects.map((r) => r.top - base.top),
        };
      }
      const { xs, ys } = ballCache.current!;
      const ws = item.line.words;
      let j = 0;
      while (j + 1 < ws.length && t >= ws[j + 1].start) j++;
      let x: number;
      let y: number;
      let hop: number;
      if (t < ws[0].start) {
        // Lead-in: drop in from the left of the first word.
        const p = Math.max(0, 1 - (ws[0].start - t) / 0.45);
        x = xs[0] - (1 - p) * 40;
        y = ys[0];
        hop = Math.sin(Math.PI * (0.5 + p / 2));
      } else if (j + 1 < ws.length) {
        const p = (t - ws[j].start) / Math.max(0.05, ws[j + 1].start - ws[j].start);
        x = xs[j] + (xs[j + 1] - xs[j]) * p;
        y = ys[j] + (ys[j + 1] - ys[j]) * p;
        hop = Math.sin(Math.PI * Math.min(1, p));
      } else {
        x = xs[j];
        y = ys[j];
        hop = 0;
      }
      const em = parseFloat(getComputedStyle(content).fontSize) || 32;
      ball.style.opacity = '1';
      ball.style.transform = `translate3d(${x - em * 0.16}px, ${y - em * 0.42 - hop * em * 0.55}px, 0)`;
    },
    [karaoke, timeline],
  );

  const { activeIndex, finished } = useLyricsSync({ timeline, shift, rootRef: contentRef, enabled: current, onFrame });
  const effectiveActive = current ? activeIndex : -1;

  useEffect(() => {
    ballCache.current = null;
  }, [karaoke, scale, effectiveActive]);

  // ---- search ------------------------------------------------------------------------------
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const matches = useMemo(() => {
    const q = normalize(search);
    if (!q || !lyrics) return [] as number[];
    return timeline.items.flatMap((it, i) => (it.type === 'line' && normalize(it.line.text).includes(q) ? [i] : []));
  }, [search, lyrics, timeline]);
  const matchSet = useMemo(() => new Set(matches), [matches]);
  useEffect(() => setMatchIndex(0), [search]);

  // ---- auto-scroll ---------------------------------------------------------------------------
  const [following, setFollowing] = useState(true);
  const userUntil = useRef(0);
  const anim = useRef<number>(0);
  const resumeTimer = useRef<ReturnType<typeof setTimeout>>();

  const scrollToItem = useCallback(
    (index: number, instant = false) => {
      const scroller = scrollerRef.current;
      const el = contentRef.current?.querySelector<HTMLElement>(`[data-item-index="${index}"]`);
      if (!scroller || !el) return;
      const target = Math.max(0, el.offsetTop + el.offsetHeight / 2 - scroller.clientHeight / 2);
      cancelAnimationFrame(anim.current);
      if (instant || reduced) {
        scroller.scrollTop = target;
        return;
      }
      let cur = scroller.scrollTop;
      if (Math.abs(target - cur) > scroller.clientHeight * 1.5) cur = target - Math.sign(target - cur) * scroller.clientHeight * 0.6;
      let last = performance.now();
      const step = (now: number) => {
        const dt = Math.min(64, now - last);
        last = now;
        cur += (target - cur) * (1 - Math.exp(-dt / 110));
        if (Math.abs(target - cur) < 0.5) cur = target;
        scroller.scrollTop = cur;
        if (cur !== target) anim.current = requestAnimationFrame(step);
      };
      anim.current = requestAnimationFrame(step);
    },
    [reduced],
  );

  const markUserScroll = useCallback(() => {
    userUntil.current = performance.now() + RESUME_AFTER_MS;
    cancelAnimationFrame(anim.current);
    setFollowing(false);
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setFollowing(true), RESUME_AFTER_MS);
  }, []);

  const resume = useCallback(() => {
    userUntil.current = 0;
    clearTimeout(resumeTimer.current);
    setFollowing(true);
  }, []);

  useEffect(() => () => {
    cancelAnimationFrame(anim.current);
    clearTimeout(resumeTimer.current);
  }, []);

  // Follow the active line.
  useEffect(() => {
    if (!following || effectiveActive < 0) return;
    scrollToItem(effectiveActive);
  }, [effectiveActive, following, scrollToItem, karaoke, scale]);

  // Start at the top for a new song.
  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
    resume();
  }, [timeline, resume]);

  // Re-center after layout changes.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const ro = new ResizeObserver(() => {
      ballCache.current = null;
      if (following && effectiveActive >= 0) scrollToItem(effectiveActive, true);
    });
    ro.observe(scroller);
    return () => ro.disconnect();
  }, [following, effectiveActive, scrollToItem]);

  const navMatch = (dir: 1 | -1) => {
    if (!matches.length) return;
    const next = (matchIndex + dir + matches.length) % matches.length;
    setMatchIndex(next);
    markUserScroll();
    scrollToItem(matches[next]);
  };

  const seekToLine = useCallback(
    (line: Line) => {
      const target = Math.max(0, line.start - lyricShift(track.id));
      if (!current) {
        player.playTrack(track.id);
      }
      player.seek(target);
      resume();
    },
    [current, track.id, resume],
  );

  // ---- rendering -----------------------------------------------------------------------------
  const immersive = variant === 'immersive';
  const fontSize = karaoke
    ? `calc(clamp(1.9rem, 1.2rem + 2.6vw, 3.4rem) * ${scale})`
    : immersive
      ? `calc(clamp(1.55rem, 1rem + 1.9vw, 2.6rem) * ${scale})`
      : `calc(clamp(1.2rem, 1rem + 0.8vw, 1.6rem) * ${scale})`;

  const toneVars = (immersive ? { '--lyric-on': '255 255 255', '--lyric-off': '255 255 255' } : {}) as CSSProperties;

  if (!lyrics) {
    return (
      <div className={cn('flex h-full flex-col items-center justify-center gap-4 px-6 text-center', className)} style={toneVars}>
        <div className={cn('flex h-16 items-end gap-1.5', immersive ? 'text-white' : 'text-primary')} aria-hidden="true">
          {[0.5, 0.9, 0.6, 1, 0.7, 0.4].map((h, i) => (
            <span key={i} className="w-2 rounded-full bg-current opacity-80 eq-bar" style={{ height: `${h * 100}%`, animationDelay: `-${i * 130}ms` }} />
          ))}
        </div>
        <div>
          <p className={cn('text-2xl font-extrabold', immersive && 'text-white')}>Instrumental</p>
          <p className={cn('mt-1 text-sm', immersive ? 'text-white/70' : 'text-muted')}>No lyrics for this track — just enjoy the music.</p>
        </div>
        <Link
          to={`/studio?track=${encodeURIComponent(track.id)}`}
          className={cn('inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold', immersive ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-fg/10 hover:bg-fg/15')}
        >
          <PenLine className="h-4 w-4" /> Write & sync lyrics in Studio
        </Link>
      </div>
    );
  }

  if (lyrics.kind === 'plain') {
    return (
      <div className={cn('flex h-full flex-col', className)} style={toneVars}>
        <div className={cn('mx-auto mb-4 flex max-w-xl items-center gap-3 rounded-2xl px-4 py-3 text-sm', immersive ? 'bg-white/10 text-white' : 'bg-fg/[0.06]')}>
          <Music2 className="h-4 w-4 shrink-0" />
          <span className="flex-1">These lyrics aren’t time-synced yet.</span>
          <Link to={`/studio?track=${encodeURIComponent(track.id)}`} className="font-semibold text-primary">
            Sync now
          </Link>
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto px-2">
          {lyrics.lines.map((l) => (
            <p key={l.id} className={cn('py-1 font-bold leading-snug', immersive ? 'text-white/85' : 'text-fg/85')} style={{ fontSize }}>
              {l.text}
            </p>
          ))}
        </div>
      </div>
    );
  }

  const stateOf = (i: number): LineState => {
    if (effectiveActive < 0) return 'future';
    if (i < effectiveActive || (finished && i === effectiveActive)) return 'past';
    if (i === effectiveActive) return 'active';
    if (i === effectiveActive + 1) return 'next';
    return 'future';
  };

  return (
    <div className={cn('relative flex h-full min-h-0 flex-col', className)} style={toneVars}>
      {showToolbar && (
        <div className={cn('z-10 mb-2 shrink-0', karaoke && 'flex justify-center')}>
          <LyricsToolbar
            trackId={track.id}
            kind={lyrics.kind}
            source={source}
            search={search}
            onSearchChange={setSearch}
            searchOpen={searchOpen}
            onSearchOpen={(o) => {
              setSearchOpen(o);
              if (!o) setSearch('');
            }}
            matchCount={matches.length}
            matchIndex={matchIndex}
            onMatchNav={navMatch}
            onMatchSeek={() => {
              const it = timeline.items[matches[matchIndex]];
              if (it?.type === 'line') seekToLine(it.line);
            }}
            tone={immersive ? 'immersive' : 'panel'}
          />
        </div>
      )}

      <div
        ref={scrollerRef}
        className="lyrics-scroller no-scrollbar relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
        onWheel={markUserScroll}
        onTouchMove={markUserScroll}
        onKeyDown={(e) => {
          if (['PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) markUserScroll();
        }}
        role="region"
        aria-label={`Synchronized lyrics for ${track.title}`}
      >
        <div
          ref={contentRef}
          className={cn('relative px-6 sm:px-8', karaoke && 'karaoke')}
          style={{ fontSize, paddingTop: '42%', paddingBottom: '55%' }}
        >
          <div className={cn('flex flex-col', karaoke ? 'items-center gap-[0.75em]' : 'gap-[0.62em]')}>
            {timeline.items.map((item, i) =>
              item.type === 'line' ? (
                <LyricLine key={item.key} line={item.line} itemIndex={i} state={stateOf(i)} match={matchSet.has(i)} onSeek={seekToLine} />
              ) : (
                <Interlude key={item.key} itemIndex={i} active={i === effectiveActive && !finished} karaoke={karaoke} />
              ),
            )}
          </div>
          {karaoke && <span ref={ballRef} className="karaoke-ball left-0 top-0 opacity-0 transition-opacity" aria-hidden="true" />}
          {lyrics.metadata.by && (
            <p className={cn('mt-[2.5em] text-[0.45em] font-semibold', immersive ? 'text-white/45' : 'text-subtle')}>
              Lyrics: {lyrics.metadata.author ?? lyrics.metadata.artist ?? 'Unknown'} · Synced by {lyrics.metadata.by}
            </p>
          )}
        </div>
      </div>

      {!following && current && (
        <button
          onClick={() => {
            resume();
            if (effectiveActive >= 0) scrollToItem(effectiveActive);
          }}
          className="absolute bottom-4 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary shadow-glow animate-fade-up"
        >
          <LocateFixed className="h-4 w-4" /> Back to live lyrics
        </button>
      )}
    </div>
  );
}
