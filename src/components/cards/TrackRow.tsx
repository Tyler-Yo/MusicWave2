/** A single track in a list: number / equalizer, artwork, title, artist, album, duration, like, menu. */
import { memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CloudOff, Heart, Mic2, MoreHorizontal } from 'lucide-react';
import { CoverImage } from '@/components/common/CoverImage';
import { DownloadIndicator } from '@/components/common/DownloadIndicator';
import { Menu } from '@/components/common/Menu';
import { Equalizer, PlayPauseGlyph } from '@/components/common/PlayIcon';
import { QualityBadge } from '@/components/common/QualityBadge';
import { useIsCurrent, useIsLiked, useLibrary, useLyricsState } from '@/hooks/usePlayer';
import { isPlayableOffline } from '@/services/audioSources';
import { albumHref, albumTitleOf, artistNameOf, trackCover, trackFallbackCover } from '@/services/catalog';
import { hasLyrics } from '@/services/lyrics';
import { bestTier } from '@/services/quality';
import { remoteLyricsStore } from '@/services/remoteLyrics';
import { useStore } from '@/state/createStore';
import { libraryActions } from '@/state/libraryStore';
import { useOffline } from '@/state/networkStore';
import type { Track } from '@/types/music';
import { cn } from '@/utils/cn';
import { formatTime } from '@/utils/format';
import { trackMenuItems } from './trackActions';

export interface TrackRowProps {
  track: Track;
  index: number;
  onPlay: () => void;
  showCover?: boolean;
  showAlbum?: boolean;
  showArtist?: boolean;
  rank?: boolean;
  onRemove?: () => void;
  extra?: React.ReactNode;
}

export const TrackRow = memo(function TrackRow({
  track,
  index,
  onPlay,
  showCover = true,
  showAlbum = true,
  showArtist = true,
  rank = false,
  onRemove,
  extra,
}: TrackRowProps) {
  const navigate = useNavigate();
  const { current, playing } = useIsCurrent(track.id);
  const liked = useIsLiked(track.id);
  const download = useLibrary((s) => s.downloads[track.id]);
  const { offline } = useOffline();
  const overrides = useLyricsState((s) => s.overrides);
  useStore(remoteLyricsStore, (s) => s.byTrack[track.id]);
  const unavailable = offline && !isPlayableOffline(track);
  const lyrics = hasLyrics(track, overrides);
  const albumLink = albumHref(track);
  // Downloaded copies are labelled with what was saved; otherwise the best the source offers.
  const tier = download?.tier ?? (track.source.kind === 'remote' ? bestTier(track.source.variants) : undefined);

  return (
    <div
      className={cn(
        'group grid items-center gap-3 rounded-xl px-2 py-1.5 transition-colors sm:px-3',
        'grid-cols-[2rem_minmax(0,1fr)_auto] md:grid-cols-[2rem_minmax(0,1.4fr)_minmax(0,1fr)_auto]',
        !showAlbum && 'md:grid-cols-[2rem_minmax(0,1fr)_auto]',
        current ? 'bg-primary/[0.08]' : 'hover:bg-fg/[0.05] focus-within:bg-fg/[0.05]',
        unavailable && 'opacity-45',
      )}
    >
      <div className="relative grid h-8 w-8 place-items-center text-sm tabular-nums text-subtle">
        <span className={cn('transition-opacity', 'group-hover:opacity-0 group-focus-within:opacity-0', rank && 'text-base font-extrabold text-fg')}>
          {current ? <Equalizer playing={playing} /> : index + 1}
        </span>
        <button
          aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
          onClick={onPlay}
          disabled={unavailable}
          className="absolute inset-0 grid place-items-center rounded-full text-fg opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        >
          <PlayPauseGlyph playing={playing} className="h-4 w-4" />
        </button>
      </div>

      <button onClick={onPlay} disabled={unavailable} className="flex min-w-0 items-center gap-3 rounded-lg text-left" tabIndex={-1} aria-hidden="true">
        {showCover && <CoverImage src={trackCover(track)} fallback={trackFallbackCover(track)} alt="" rounded="rounded-md" className="h-11 w-11 shrink-0" />}
        <span className="min-w-0">
          <span className={cn('flex items-center gap-1.5 truncate text-[15px] font-semibold', current && 'text-primary')}>
            <span className="truncate">{track.title}</span>
            {lyrics && <Mic2 className="h-3.5 w-3.5 shrink-0 text-subtle" aria-label="Has lyrics" />}
            <DownloadIndicator trackId={track.id} downloaded={Boolean(download)} />
            {unavailable && <CloudOff className="h-3.5 w-3.5 shrink-0" aria-label="Not available offline" />}
          </span>
          {showArtist && (
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
              {tier && <QualityBadge tier={tier} />}
              <span className="truncate">{artistNameOf(track)}</span>
            </span>
          )}
        </span>
      </button>

      {showAlbum && (
        <div className="hidden min-w-0 truncate text-[13px] text-muted md:block">
          {albumLink ? (
            <Link to={albumLink} className="hover:text-fg hover:underline">
              {albumTitleOf(track)}
            </Link>
          ) : (
            albumTitleOf(track)
          )}
        </div>
      )}

      <div className="flex items-center gap-1">
        {extra}
        <button
          aria-label={liked ? `Remove ${track.title} from Liked Songs` : `Add ${track.title} to Liked Songs`}
          aria-pressed={liked}
          onClick={() => libraryActions.toggleLike(track.id)}
          className={cn(
            'hidden h-8 w-8 place-items-center rounded-full transition hover:scale-110 sm:grid',
            liked ? 'text-ember' : 'text-subtle opacity-0 hover:text-fg focus-visible:opacity-100 group-hover:opacity-100',
          )}
        >
          <Heart className="h-4 w-4" fill={liked ? 'currentColor' : 'none'} />
        </button>
        <span className="w-11 text-right text-[13px] tabular-nums text-subtle">{track.duration ? formatTime(track.duration) : '–:––'}</span>
        <Menu
          label={`More options for ${track.title}`}
          items={trackMenuItems(track, navigate, { removeFromPlaylist: onRemove })}
          trigger={(props) => (
            <button
              {...props}
              aria-label={`More options for ${track.title}`}
              className="grid h-8 w-8 place-items-center rounded-full text-subtle transition hover:bg-fg/10 hover:text-fg sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100 sm:aria-expanded:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
        />
      </div>
    </div>
  );
});
