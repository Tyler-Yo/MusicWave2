/** The persistent mini player. Click the artwork/title (or swipe up on mobile) to expand. */
import { Link } from 'react-router-dom';
import { ChevronUp, Heart, ListMusic, Mic2, SkipForward } from 'lucide-react';
import { IconButton } from '@/components/common/Button';
import { CoverImage } from '@/components/common/CoverImage';
import { MiniLyrics } from '@/components/lyrics/MiniLyrics';
import { useLyrics } from '@/hooks/useLyrics';
import { useCurrentTrack, useIsLiked, useSettings, useUI } from '@/hooks/usePlayer';
import { usePlaybackTime } from '@/hooks/usePlaybackTime';
import { artistHref, artistNameOf, trackCover, trackFallbackCover } from '@/services/catalog';
import { libraryActions } from '@/state/libraryStore';
import { isCurrentLoaded, pendingPosition, player } from '@/state/playerStore';
import { ui } from '@/state/uiStore';
import type { Track } from '@/types/music';
import { cn } from '@/utils/cn';
import { PlayButton, TransportControls } from './Controls';
import { QualityMenu } from './QualityMenu';
import { SeekBar } from './SeekBar';
import { SpeedMenu } from './SpeedMenu';
import { VolumeControl } from './VolumeControl';

function MobileProgress({ track }: { track: Track }) {
  const t = usePlaybackTime(4);
  const time = isCurrentLoaded() ? t : pendingPosition();
  const p = track.duration ? Math.min(1, time / track.duration) : 0;
  return (
    <div className="absolute inset-x-3 bottom-0 h-[2px] overflow-hidden rounded-full bg-fg/10" aria-hidden="true">
      <div className="h-full origin-left bg-primary transition-transform duration-300" style={{ transform: `scaleX(${p})` }} />
    </div>
  );
}

export function PlayerBar() {
  const track = useCurrentTrack();
  const liked = useIsLiked(track?.id ?? '');
  const miniLyrics = useSettings((s) => s.miniLyrics);
  const queueOpen = useUI((s) => s.queueDrawerOpen);
  // Also starts the automatic lyrics lookup for online tracks as soon as they play.
  const { lyrics: parsed, status } = useLyrics(track);

  if (!track) return null;
  const lyrics = Boolean(parsed);
  const lyricsButton = lyrics || (track.source.kind === 'remote' && status !== 'instrumental');
  const artistLink = artistHref(track);

  return (
    <section
      aria-label="Player"
      className="glass fixed inset-x-2 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 rounded-2xl border border-line/50 shadow-player md:inset-x-0 md:bottom-0 md:rounded-none md:border-x-0 md:border-b-0"
    >
      {/* Mobile */}
      <div className="relative flex items-center gap-3 p-2 md:hidden">
        <button onClick={() => ui.openNowPlaying(null)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Open player: ${track.title} by ${artistNameOf(track)}`}>
          <CoverImage src={trackCover(track)} fallback={trackFallbackCover(track)} alt="" rounded="rounded-lg" className="h-11 w-11 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{track.title}</span>
            <span className="block truncate text-xs text-muted">{artistNameOf(track)}</span>
          </span>
        </button>
        {lyricsButton && (
          <IconButton label="Lyrics" size="sm" onClick={() => ui.openNowPlaying('lyrics')}>
            <Mic2 className="h-4 w-4" />
          </IconButton>
        )}
        <PlayButton trackId={track.id} />
        <IconButton label="Next" size="sm" onClick={() => player.next()}>
          <SkipForward className="h-5 w-5" fill="currentColor" />
        </IconButton>
        <MobileProgress track={track} />
      </div>

      {/* Desktop */}
      <div className="hidden h-[5.5rem] grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] items-center gap-4 px-4 md:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => ui.openNowPlaying()} className="group relative shrink-0 rounded-lg" aria-label="Expand player">
            <CoverImage src={trackCover(track)} fallback={trackFallbackCover(track)} alt="" rounded="rounded-lg" className="h-14 w-14 shadow-card" />
            <span className="absolute inset-0 grid place-items-center rounded-lg bg-black/50 opacity-0 transition group-hover:opacity-100">
              <ChevronUp className="h-5 w-5 text-white" />
            </span>
          </button>
          <div className="min-w-0">
            <button onClick={() => ui.openNowPlaying()} className="block max-w-full truncate text-left text-sm font-bold hover:underline">
              {track.title}
            </button>
            {artistLink ? (
              <Link to={artistLink} className="block truncate text-xs text-muted hover:text-fg hover:underline">
                {artistNameOf(track)}
              </Link>
            ) : (
              <span className="block truncate text-xs text-muted">{artistNameOf(track)}</span>
            )}
          </div>
          <IconButton label={liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'} aria-pressed={liked} size="sm" onClick={() => libraryActions.toggleLike(track.id)} className={liked ? '!text-ember' : ''}>
            <Heart className="h-4 w-4" fill={liked ? 'currentColor' : 'none'} />
          </IconButton>
        </div>

        <div className="flex min-w-0 flex-col items-center gap-0.5">
          <TransportControls trackId={track.id} />
          <SeekBar track={track} className="max-w-xl" />
        </div>

        <div className="hidden min-w-0 justify-center xl:flex">{miniLyrics && lyrics && <MiniLyrics track={track} />}</div>

        <div className="flex items-center justify-end gap-1">
          <span className="hidden lg:inline-flex">
            <QualityMenu track={track} tone="default" compact />
          </span>
          <SpeedMenu />
          <IconButton label="Lyrics" active={false} onClick={() => ui.openNowPlaying('lyrics')} disabled={!lyricsButton} size="sm">
            <Mic2 className="h-[18px] w-[18px]" />
          </IconButton>
          <IconButton label="Queue" aria-pressed={queueOpen} active={queueOpen} onClick={() => ui.toggleQueueDrawer()} size="sm">
            <ListMusic className="h-[18px] w-[18px]" />
          </IconButton>
          <VolumeControl className={cn('hidden lg:flex')} />
        </div>
      </div>
    </section>
  );
}
