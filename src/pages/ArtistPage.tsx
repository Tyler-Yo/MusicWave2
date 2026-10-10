import { useParams } from 'react-router-dom';
import { BadgeCheck, ExternalLink, UserRound } from 'lucide-react';
import { ArtistCard } from '@/components/cards/ArtistCard';
import { CollectionCard, RemoteNotice } from '@/components/cards/RemoteCards';
import { PROVIDER_LABEL } from '@/components/cards/remoteHelpers';
import { MediaCard } from '@/components/cards/MediaCard';
import { Shelf } from '@/components/cards/Shelf';
import { TrackList } from '@/components/cards/TrackList';
import { CollectionHeader } from '@/components/collection/CollectionHeader';
import { PlayActions } from '@/components/collection/PlayActions';
import { playCollection } from '@/components/collection/playCollection';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { RowSkeleton, ShelfSkeleton, Skeleton } from '@/components/common/Skeleton';
import { ARTISTS, PALETTES } from '@/data/catalog';
import { useLibrary } from '@/hooks/usePlayer';
import { useRemote } from '@/hooks/useRemote';
import { albumCover, albumsByArtist, artistImage, getArtist, getGenre, remoteArtistImage, tracksByArtist } from '@/services/catalog';
import { onlineCatalog, type ArtistData } from '@/services/onlineCatalog';
import { libraryActions } from '@/state/libraryStore';
import { getRemoteArtist, isRemoteId } from '@/state/remoteCatalog';
import { compactNumber } from '@/utils/format';
import { hashString } from '@/utils/random';

const palettes = Object.values(PALETTES);

/** An artist from an online catalog (Audius user or Internet Archive creator). */
function RemoteArtistPage({ id }: { id: string }) {
  const result = useRemote<ArtistData | null>(`artist:${id}`, (signal) => onlineCatalog.artist(id, signal));
  const following = useLibrary((s) => Boolean(s.followedArtists[id]));
  const known = getRemoteArtist(id);
  const artist = result.data?.artist ?? known;
  if (!artist) {
    if (result.loading)
      return (
        <div aria-busy="true" aria-label="Loading">
          <div className="mb-8 flex items-end gap-6">
            <Skeleton className="h-56 w-56 rounded-full" />
            <Skeleton className="h-10 w-1/3" />
          </div>
          {Array.from({ length: 5 }, (_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      );
    if (result.offline || result.error) return <RemoteNotice offline={result.offline} error={result.error} onRetry={result.retry} />;
    return <EmptyState icon={<UserRound className="h-7 w-7" />} title="Artist not found" />;
  }
  const tracks = result.data?.tracks ?? [];
  const collections = result.data?.collections ?? [];
  const href = `/artist/${encodeURIComponent(id)}`;
  const context = { type: 'artist' as const, id, name: artist.name, href };
  return (
    <div className="space-y-10">
      <CollectionHeader
        cover={remoteArtistImage(artist)}
        round
        kind={`${artist.verified ? 'Verified artist' : 'Artist'} · ${PROVIDER_LABEL[artist.provider]}`}
        title={artist.name}
        description={artist.bio ? <span className="line-clamp-3 whitespace-pre-line">{artist.bio}</span> : undefined}
        palette={palettes[hashString(id) % palettes.length]}
        meta={
          <>
            {artist.verified && <BadgeCheck className="h-4 w-4 text-primary" aria-hidden="true" />}
            {artist.followerCount !== undefined && <span>{compactNumber(artist.followerCount)} followers</span>}
            {artist.trackCount !== undefined && <span>· {compactNumber(artist.trackCount)} tracks</span>}
            {artist.pageUrl && (
              <a href={artist.pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold hover:text-fg">
                · {PROVIDER_LABEL[artist.provider]} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </>
        }
        actions={
          <>
            {tracks.length > 0 && <PlayActions trackIds={tracks.map((t) => t.id)} context={context} />}
            <Button size="lg" variant={following ? 'secondary' : 'ghost'} aria-pressed={following} onClick={() => libraryActions.toggleFollow(id)}>
              {following ? 'Following' : 'Follow'}
            </Button>
          </>
        }
      />
      {result.error && <RemoteNotice error={result.error} onRetry={result.retry} compact />}
      {result.loading && !result.data && (
        <>
          {Array.from({ length: 5 }, (_, i) => (
            <RowSkeleton key={i} />
          ))}
          <ShelfSkeleton />
        </>
      )}
      {tracks.length > 0 && (
        <section aria-labelledby="popular">
          <h2 id="popular" className="mb-3 text-xl font-extrabold">
            Popular
          </h2>
          <TrackList tracks={tracks} context={context} header={false} showArtist={false} />
        </section>
      )}
      {collections.length > 0 && (
        <Shelf title={artist.provider === 'archive' ? 'Recordings' : 'Albums'}>
          {collections.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
        </Shelf>
      )}
      {result.data && !tracks.length && !collections.length && (
        <EmptyState icon={<UserRound className="h-7 w-7" />} title="Nothing to play yet">
          This artist has no public tracks.
        </EmptyState>
      )}
    </div>
  );
}

export default function ArtistPage() {
  const { id: rawParam = '' } = useParams();
  const id = decodeURIComponent(rawParam);
  if (isRemoteId(id)) return <RemoteArtistPage key={id} id={id} />;
  return <LocalArtistPage id={id} />;
}

function LocalArtistPage({ id }: { id: string }) {
  const artist = getArtist(id);
  const following = useLibrary((s) => Boolean(s.followedArtists[id]));
  if (!artist) return <EmptyState icon={<UserRound className="h-7 w-7" />} title="Artist not found" />;
  const tracks = tracksByArtist(artist.id);
  const albums = albumsByArtist(artist.id);
  const context = { type: 'artist' as const, id: artist.id, name: artist.name, href: `/artist/${artist.id}` };
  const related = ARTISTS.filter((a) => a.id !== artist.id && a.genreIds.some((g) => artist.genreIds.includes(g) || ['lofi', 'ambient', 'synthwave', 'electronic'].includes(g)));

  return (
    <div className="space-y-10">
      <CollectionHeader
        cover={artistImage(artist)}
        round
        kind={artist.verified ? 'Verified artist' : 'Artist'}
        title={artist.name}
        description={artist.bio}
        palette={artist.palette}
        meta={
          <>
            {artist.verified && <BadgeCheck className="h-4 w-4 text-primary" aria-hidden="true" />}
            <span>{compactNumber(artist.monthlyListeners)} monthly listeners</span>
            <span>· {artist.genreIds.map((g) => getGenre(g)?.name).filter(Boolean).join(', ')}</span>
          </>
        }
        actions={
          <>
            <PlayActions trackIds={tracks.map((t) => t.id)} context={context} />
            <Button size="lg" variant={following ? 'secondary' : 'ghost'} aria-pressed={following} onClick={() => libraryActions.toggleFollow(artist.id)}>
              {following ? 'Following' : 'Follow'}
            </Button>
          </>
        }
      />
      <section aria-labelledby="popular">
        <h2 id="popular" className="mb-3 text-xl font-extrabold">
          Popular
        </h2>
        <TrackList tracks={tracks} context={context} header={false} showArtist={false} />
      </section>
      <Shelf title="Discography">
        {albums.map((a) => (
          <MediaCard
            key={a.id}
            href={`/album/${a.id}`}
            cover={albumCover(a)}
            title={a.title}
            subtitle={`${new Date(a.releaseDate).getFullYear()} · ${a.type === 'ep' ? 'EP' : a.type === 'single' ? 'Single' : 'Album'}`}
            onPlay={() => playCollection(a.trackIds, { type: 'album', id: a.id, name: a.title, href: `/album/${a.id}` })}
          />
        ))}
      </Shelf>
      <Shelf title="Fans also like">
        {related.slice(0, 8).map((a) => (
          <ArtistCard key={a.id} artist={a} />
        ))}
      </Shelf>
    </div>
  );
}
