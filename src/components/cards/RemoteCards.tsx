/** Cards and shelves for music from the online catalogs (Audius, Internet Archive). */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, CloudOff, RefreshCw, WifiOff } from 'lucide-react';
import { playRemoteCollection } from '@/components/collection/playCollection';
import { CoverImage } from '@/components/common/CoverImage';
import { ShelfSkeleton } from '@/components/common/Skeleton';
import { usePlayer } from '@/hooks/usePlayer';
import type { RemoteResult } from '@/hooks/useRemote';
import { albumHref, artistHref, artistNameOf, collectionCover, remoteArtistImage, trackCover } from '@/services/catalog';
import { player } from '@/state/playerStore';
import type { PlayContext, RemoteArtist, RemoteCollection, Track } from '@/types/music';
import { compactNumber } from '@/utils/format';
import { MediaCard } from './MediaCard';
import { collectionContext, collectionHref, PROVIDER_LABEL } from './remoteHelpers';
import { Shelf } from './Shelf';

function qualityBadge(c: RemoteCollection): string | undefined {
  if (c.bestTier === 'hires') return 'Hi-Res';
  if (c.has24Bit) return '24-bit';
  if (c.bestTier === 'lossless') return 'Lossless';
  return undefined;
}

export function CollectionCard({ collection }: { collection: RemoteCollection }) {
  const ctx = collectionContext(collection);
  const playing = usePlayer((s) => s.isPlaying && s.context?.id === collection.id);
  const kind = collection.kind === 'recording' ? (collection.year ? collection.year : 'Recording') : collection.kind === 'album' ? 'Album' : 'Playlist';
  return (
    <MediaCard
      href={collectionHref(collection)}
      cover={collectionCover(collection)}
      title={collection.title}
      subtitle={`${kind} · ${collection.artistName}`}
      badge={qualityBadge(collection)}
      playing={playing}
      onPlay={() => void playRemoteCollection(collection.id, ctx)}
    />
  );
}

/** A song as a card; playing it queues the whole shelf from that song. */
export function RemoteTrackCard({ track, list, index, context }: { track: Track; list: Track[]; index: number; context: PlayContext }) {
  const playing = usePlayer((s) => s.isPlaying && s.index >= 0 && s.queue[s.index]?.trackId === track.id);
  return (
    <MediaCard
      href={albumHref(track) ?? artistHref(track) ?? '/'}
      cover={trackCover(track)}
      title={track.title}
      subtitle={artistNameOf(track)}
      playing={playing}
      onPlay={() =>
        playing
          ? player.toggle()
          : player.playTracks(
              list.map((t) => t.id),
              index,
              context,
            )
      }
    />
  );
}

export function RemoteArtistCard({ artist }: { artist: RemoteArtist }) {
  return (
    <div role="listitem" className="group w-36 shrink-0 snap-start sm:w-40">
      <Link to={`/artist/${encodeURIComponent(artist.id)}`} className="block rounded-xl text-center outline-offset-4">
        <CoverImage src={remoteArtistImage(artist)} alt="" rounded="rounded-full" className="shadow-card transition duration-500 group-hover:scale-[1.03]" />
        <p className="mt-3 flex items-center justify-center gap-1 truncate text-sm font-bold">
          <span className="truncate">{artist.name}</span>
          {artist.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Verified artist" />}
        </p>
        <p className="mt-0.5 text-[13px] text-muted">
          {artist.followerCount !== undefined ? `${compactNumber(artist.followerCount)} followers` : PROVIDER_LABEL[artist.provider]}
        </p>
      </Link>
    </div>
  );
}

/** Inline notice for a section that couldn't load. */
export function RemoteNotice({ title, error, offline, onRetry, compact = false }: { title?: string; error?: string | null; offline?: boolean; onRetry?: () => void; compact?: boolean }) {
  return (
    <div className={compact ? 'flex flex-wrap items-center gap-3 rounded-2xl bg-fg/[0.04] px-4 py-3 text-sm' : 'flex flex-wrap items-center gap-3 rounded-2xl border border-line/50 bg-fg/[0.03] px-5 py-4 text-sm'}>
      {offline ? <WifiOff className="h-4 w-4 shrink-0 text-muted" /> : <CloudOff className="h-4 w-4 shrink-0 text-muted" />}
      <span className="min-w-0 flex-1 text-muted">
        {title && <strong className="mr-1 text-fg">{title}:</strong>}
        {offline ? 'You’re offline. Your downloads are still available in Downloads.' : `Couldn’t load this right now${error ? ` (${error})` : ''}.`}
      </span>
      {!offline && onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-full bg-fg/10 px-3 py-1.5 text-xs font-bold hover:bg-fg/15">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

/** A shelf whose items come from an online catalog: skeleton → items, or an error/offline notice. */
export function RemoteShelf<T>({
  title,
  subtitle,
  result,
  render,
  seeAllHref,
  hideWhenOffline = false,
}: {
  title: string;
  subtitle?: string;
  result: RemoteResult<T[]>;
  render: (items: T[]) => ReactNode;
  seeAllHref?: string;
  hideWhenOffline?: boolean;
}) {
  if (result.data && result.data.length > 0) {
    return (
      <Shelf title={title} subtitle={subtitle} seeAllHref={seeAllHref}>
        {render(result.data)}
      </Shelf>
    );
  }
  if (result.loading) return <ShelfSkeleton />;
  if (result.offline) {
    if (hideWhenOffline) return null;
    return (
      <section aria-label={title}>
        <h2 className="mb-3 text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h2>
        <RemoteNotice offline compact />
      </section>
    );
  }
  if (result.error) {
    return (
      <section aria-label={title}>
        <h2 className="mb-3 text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h2>
        <RemoteNotice error={result.error} onRetry={result.retry} compact />
      </section>
    );
  }
  return null;
}
