import { useParams } from 'react-router-dom';
import { BadgeCheck, UserRound } from 'lucide-react';
import { ArtistCard } from '@/components/cards/ArtistCard';
import { MediaCard } from '@/components/cards/MediaCard';
import { Shelf } from '@/components/cards/Shelf';
import { TrackList } from '@/components/cards/TrackList';
import { CollectionHeader } from '@/components/collection/CollectionHeader';
import { PlayActions } from '@/components/collection/PlayActions';
import { playCollection } from '@/components/collection/playCollection';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { ARTISTS } from '@/data/catalog';
import { useLibrary } from '@/hooks/usePlayer';
import { albumCover, albumsByArtist, artistImage, getArtist, getGenre, tracksByArtist } from '@/services/catalog';
import { libraryActions } from '@/state/libraryStore';
import { compactNumber } from '@/utils/format';

export default function ArtistPage() {
  const { id = '' } = useParams();
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
