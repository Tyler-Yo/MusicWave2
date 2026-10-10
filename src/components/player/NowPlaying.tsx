/**
 * Full-screen Now Playing: ambient palette background that breathes with the
 * music's energy, spinning vinyl artwork, waveform seek bar, transport, and a
 * lyrics / queue panel (side-by-side on desktop, swappable views on mobile).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, Heart, ListMusic, Mic2, MoreHorizontal, Sparkles } from 'lucide-react';
import { Menu } from '@/components/common/Menu';
import { LyricsView } from '@/components/lyrics/LyricsView';
import { trackMenuItems } from '@/components/cards/trackActions';
import { useLyrics } from '@/hooks/useLyrics';
import { usePlaybackFrame } from '@/hooks/usePlaybackTime';
import { useCurrentTrack, useIsLiked, usePlayer, useSettings, useUI } from '@/hooks/usePlayer';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { analysisStore } from '@/services/audioSources';
import { artistHref, artistNameOf, paletteOf, trackCover, trackFallbackCover, albumTitleOf } from '@/services/catalog';
import { libraryActions } from '@/state/libraryStore';
import { settingsActions } from '@/state/settingsStore';
import { ui } from '@/state/uiStore';
import type { Track } from '@/types/music';
import { cn } from '@/utils/cn';
import { rgba } from '@/utils/color';
import { TransportControls } from './Controls';
import { QualityMenu } from './QualityMenu';
import { QueuePanel } from './QueuePanel';
import { SeekBar } from './SeekBar';
import { SpeedMenu } from './SpeedMenu';
import { VolumeControl } from './VolumeControl';

/** Writes the music's current loudness (0..1) to `--energy` on `target` every frame. */
function useEnergy(track: Track | undefined, target: React.RefObject<HTMLElement | null>) {
  const smooth = useRef(0);
  usePlaybackFrame((t) => {
    const el = target.current;
    if (!el || !track) return;
    const a = analysisStore.get().byTrack[track.id];
    let e = 0.35;
    if (a) {
      const i = Math.floor(t * a.frameRate);
      e = a.energy[Math.max(0, Math.min(a.energy.length - 1, i))] ?? 0;
    }
    smooth.current += (e - smooth.current) * 0.18;
    el.style.setProperty('--energy', smooth.current.toFixed(3));
  });
}

function Ambient({ track }: { track: Track | undefined }) {
  const p = paletteOf(track);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" style={{ background: p.base }}>
      <div
        className="absolute -left-[20%] -top-[30%] h-[80vmax] w-[80vmax] rounded-full opacity-70 blur-[90px] animate-drift"
        style={{ background: `radial-gradient(circle, ${rgba(p.a, 0.9)}, transparent 65%)`, transform: 'scale(calc(1 + var(--energy, 0.3) * 0.25))' }}
      />
      <div
        className="absolute -bottom-[35%] -right-[15%] h-[75vmax] w-[75vmax] rounded-full opacity-60 blur-[100px] animate-drift"
        style={{ background: `radial-gradient(circle, ${rgba(p.b, 0.85)}, transparent 65%)`, animationDelay: '-8s', animationDuration: '28s' }}
      />
      <div
        className="absolute left-[30%] top-[20%] h-[50vmax] w-[50vmax] rounded-full opacity-40 blur-[110px] animate-drift"
        style={{ background: `radial-gradient(circle, ${rgba(p.c, 0.8)}, transparent 60%)`, animationDelay: '-15s', animationDuration: '34s' }}
      />
      <div className="absolute inset-0 bg-black/45" />
    </div>
  );
}

/** Cover URL that falls back to generated art if the online image can't load. */
function useCover(track: Track): [string, () => void] {
  const src = trackCover(track);
  const [failed, setFailed] = useState<string | null>(null);
  return [failed === src ? trackFallbackCover(track) : src, () => setFailed(src)];
}

function Artwork({ track, playing, vinyl }: { track: Track; playing: boolean; vinyl: boolean }) {
  const reduced = useReducedMotion();
  const [cover, onCoverError] = useCover(track);
  return (
    // Square that fills the height left over by the controls (capped), so it never overlaps the title on short screens.
    <div className="relative mx-auto aspect-square h-full max-h-[min(26rem,40vh)] max-w-[88%] md:max-h-[min(30rem,46vh)] md:max-w-full">
      {vinyl && (
        <div
          className={cn(
            'vinyl absolute inset-[3%] rounded-full shadow-2xl transition-transform duration-700 ease-out-expo',
            playing ? 'translate-x-[14%] md:translate-x-[24%]' : 'translate-x-[4%] md:translate-x-[6%]',
          )}
          aria-hidden="true"
        >
          <div
            className="absolute inset-0 rounded-full animate-spin-slow"
            style={{ animationPlayState: playing && !reduced ? 'running' : 'paused' }}
          >
            <img src={cover} alt="" onError={onCoverError} referrerPolicy="no-referrer" className="absolute left-1/2 top-1/2 h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full object-cover" />
            <span className="absolute left-1/2 top-1/2 h-[3%] w-[3%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black" />
            <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_30deg,transparent_0deg,rgba(255,255,255,0.09)_40deg,transparent_80deg,transparent_180deg,rgba(255,255,255,0.07)_220deg,transparent_260deg)]" />
          </div>
        </div>
      )}
      <img
        src={cover}
        onError={onCoverError}
        referrerPolicy="no-referrer"
        alt={`Artwork for ${albumTitleOf(track) || track.title}`}
        className={cn(
          'relative aspect-square w-full rounded-[1.6rem] object-cover shadow-[0_30px_80px_-20px_rgba(0,0,0,0.75)] transition-transform duration-700 ease-out-expo',
          !vinyl && playing && !reduced && 'scale-[calc(1+var(--energy,0)*0.035)]',
          vinyl && (playing ? '-translate-x-[2%] md:-translate-x-[6%]' : 'translate-x-0'),
        )}
        style={{ transitionDuration: !vinyl ? '120ms' : undefined } as CSSProperties}
      />
    </div>
  );
}

export function NowPlaying() {
  const open = useUI((s) => s.nowPlayingOpen);
  const panel = useUI((s) => s.nowPlayingPanel);
  const track = useCurrentTrack();
  const playing = usePlayer((s) => s.isPlaying);
  const context = usePlayer((s) => s.context);
  const vinyl = useSettings((s) => s.vinylArt);
  const karaoke = useSettings((s) => s.karaoke);
  const liked = useIsLiked(track?.id ?? '');
  const lyricsInfo = useLyrics(track);
  const { lyrics, kind } = lyricsInfo;
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useEnergy(open ? track : undefined, rootRef);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    rootRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open]);

  if (!open || !track) return null;

  const showLyrics = panel === 'lyrics';
  const showQueue = panel === 'queue';
  const panelOpen = showLyrics || showQueue;
  const immersiveKaraoke = karaoke && showLyrics;

  const meta = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="truncate text-2xl font-extrabold text-white sm:text-3xl">{track.title}</h2>
        {artistHref(track) ? (
          <Link to={artistHref(track)!} onClick={() => ui.closeNowPlaying()} className="block truncate text-lg text-white/70 hover:text-white hover:underline">
            {artistNameOf(track)}
          </Link>
        ) : (
          <p className="truncate text-lg text-white/70">{artistNameOf(track)}</p>
        )}
        <div className="-ml-1 mt-1 min-h-[1.75rem]">
          <QualityMenu track={track} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          aria-label={liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
          aria-pressed={liked}
          onClick={() => libraryActions.toggleLike(track.id)}
          className={cn('grid h-10 w-10 place-items-center rounded-full transition hover:bg-white/10', liked ? 'text-ember' : 'text-white/80')}
        >
          <Heart className="h-5 w-5" fill={liked ? 'currentColor' : 'none'} />
        </button>
        <Menu
          label={`More options for ${track.title}`}
          items={trackMenuItems(track, (to) => {
            ui.closeNowPlaying();
            navigate(to as string);
          })}
          trigger={(props) => (
            <button {...props} aria-label="More options" className="grid h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/10">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          )}
        />
      </div>
    </div>
  );

  const toggles = (
    <div className="flex items-center gap-1">
      <button
        onClick={() => ui.togglePanel('lyrics')}
        aria-pressed={showLyrics}
        aria-label="Lyrics"
        className={cn('inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold transition', showLyrics ? 'bg-white text-black' : 'text-white/80 hover:bg-white/10')}
      >
        <Mic2 className="h-4 w-4" /> <span className="hidden sm:inline">Lyrics</span>
      </button>
      <button
        onClick={() => ui.togglePanel('queue')}
        aria-pressed={showQueue}
        aria-label="Up next"
        className={cn('inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold transition', showQueue ? 'bg-white text-black' : 'text-white/80 hover:bg-white/10')}
      >
        <ListMusic className="h-4 w-4" /> <span className="hidden sm:inline">Up next</span>
      </button>
      {showLyrics && lyrics && (
        <button
          onClick={() => settingsActions.toggleKaraoke()}
          aria-pressed={karaoke}
          aria-label="Karaoke mode"
          className={cn('inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold transition md:hidden', karaoke ? 'bg-primary text-on-primary' : 'text-white/80 hover:bg-white/10')}
        >
          <Sparkles className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Now playing: ${track.title} by ${artistNameOf(track)}`}
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden text-white animate-slide-up"
    >
      <Ambient track={track} />

      <header className="relative z-10 flex items-center justify-between gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
        <button data-autofocus onClick={() => ui.closeNowPlaying()} aria-label="Collapse player" className="grid h-10 w-10 place-items-center rounded-full text-white/85 hover:bg-white/10">
          <ChevronDown className="h-6 w-6" />
        </button>
        <div className="min-w-0 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">Playing from</p>
          {context?.href ? (
            <Link to={context.href} onClick={() => ui.closeNowPlaying()} className="block truncate text-sm font-bold hover:underline">
              {context.name}
            </Link>
          ) : (
            <p className="truncate text-sm font-bold">{context?.name ?? 'Your queue'}</p>
          )}
        </div>
        <div className="hidden md:block">{toggles}</div>
        <div className="w-10 md:hidden" />
      </header>

      <div
        className={cn(
          'relative z-10 mx-auto grid min-h-0 w-full max-w-[1500px] flex-1 grid-cols-1 gap-6 px-4 pb-4 sm:px-8 md:gap-10',
          panelOpen ? 'md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : 'md:grid-cols-1',
          immersiveKaraoke && 'md:grid-cols-[minmax(0,0.55fr)_minmax(0,1.45fr)]',
        )}
      >
        {/* Left / main column */}
        <section className={cn('no-scrollbar min-h-0 min-w-0 flex-col justify-center gap-6 overflow-y-auto', panelOpen ? 'hidden md:flex' : 'flex', 'md:mx-auto md:w-full md:max-w-[34rem]')}>
          <div className={cn('flex min-h-[9rem] flex-1 items-center justify-center', immersiveKaraoke && 'md:scale-90')}>
            <Artwork track={track} playing={playing} vinyl={vinyl} />
          </div>
          <div className="space-y-5">
            {meta}
            <div className="pt-6">
              <SeekBar track={track} variant="waveform" />
            </div>
            <div className="flex justify-center">
              <TransportControls size="lg" tone="light" trackId={track.id} />
            </div>
            <div className="flex items-center justify-between">
              <VolumeControl tone="light" />
              <SpeedMenu tone="light" />
            </div>
          </div>
        </section>

        {/* Lyrics / queue panel */}
        {panelOpen && (
          <section className="flex min-h-0 flex-col animate-fade-in" aria-label={showLyrics ? 'Lyrics' : 'Queue'}>
            <div className="mb-3 flex items-center gap-3 md:hidden">
              <img src={trackCover(track)} alt="" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.src = trackFallbackCover(track))} className="h-12 w-12 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{track.title}</p>
                <p className="truncate text-sm text-white/70">{artistNameOf(track)}</p>
              </div>
            </div>
            {showLyrics ? (
              <LyricsView track={track} lyrics={lyrics} source={kind} status={lyricsInfo.status} remote={lyricsInfo.remote} onRetry={lyricsInfo.retry} variant="immersive" className="min-h-0 flex-1" />
            ) : (
              <QueuePanel tone="immersive" className="min-h-0 flex-1" />
            )}
            {/* Compact controls under the panel on mobile */}
            <div className="mt-3 space-y-2 md:hidden">
              <SeekBar track={track} variant="light" />
              <div className="flex justify-center">
                <TransportControls tone="light" trackId={track.id} />
              </div>
            </div>
          </section>
        )}
      </div>

      <footer className="relative z-10 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">{toggles}</footer>
    </div>
  );
}
