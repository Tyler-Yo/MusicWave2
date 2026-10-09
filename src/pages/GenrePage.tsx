import { useParams } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { ArtistCard } from '@/components/cards/ArtistCard';
import { MediaCard } from '@/components/cards/MediaCard';
import { Shelf } from '@/components/cards/Shelf';
import { TrackList } from '@/components/cards/TrackList';
import { CollectionHeader } from '@/components/collection/CollectionHeader';
import { PlayActions } from '@/components/collection/PlayActions';
import { playCollection } from '@/components/collection/playCollection';
import { EmptyState } from '@/components/common/EmptyState';
import { ALBUMS, ARTISTS, PLAYLISTS, TRACKS } from '@/data/catalog';
import { albumCover, genreCover, getArtist, getGenre, playlistCover } from '@/services/catalog';

export default function GenrePage() {
  const { id = '' } = useParams();
  const genre = getGenre(id);
  if (!genre) return <EmptyState icon={<Compass className="h-7 w-7" />} title="Genre not found" />;
  const tracks = TRACKS.filter((t) => t.genreId === genre.id).sort((a, b) => b.plays - a.plays);
  const albums = ALBUMS.filter((a) => a.genreId === genre.id);
  const artists = ARTISTS.filter((a) => a.genreIds.includes(genre.id));
  const playlists = PLAYLISTS.filter((p) => p.trackIds.some((tid) => tracks.some((t) => t.id === tid)));
  const context = { type: 'genre' as const, id: genre.id, name: genre.name, href: `/genre/${genre.id}` };
  return (
    <div className="space-y-10">
      <CollectionHeader
        cover={genreCover(genre)}
        kind="Genre"
        title={genre.name}
        description={genre.tagline}
        palette={genre.palette}
        meta={<span>{tracks.length} songs · {artists.length} artists</span>}
        actions={<PlayActions trackIds={tracks.map((t) => t.id)} context={context} />}
      />
      <section>
        <h2 className="mb-3 text-xl font-extrabold">Top songs</h2>
        <TrackList tracks={tracks} context={context} header={false} />
      </section>
      {albums.length > 0 && (
        <Shelf title="Albums & singles">
          {albums.map((a) => (
            <MediaCard key={a.id} href={`/album/${a.id}`} cover={albumCover(a)} title={a.title} subtitle={getArtist(a.artistId)?.name} onPlay={() => playCollection(a.trackIds, { type: 'album', id: a.id, name: a.title, href: `/album/${a.id}` })} />
          ))}
        </Shelf>
      )}
      {playlists.length > 0 && (
        <Shelf title="Playlists featuring this sound">
          {playlists.map((p) => (
            <MediaCard key={p.id} href={`/playlist/${p.id}`} cover={playlistCover(p)} title={p.title} subtitle={p.description} onPlay={() => playCollection(p.trackIds, { type: 'playlist', id: p.id, name: p.title, href: `/playlist/${p.id}` })} />
          ))}
        </Shelf>
      )}
      {artists.length > 0 && (
        <Shelf title="Artists">
          {artists.map((a) => (
            <ArtistCard key={a.id} artist={a} />
          ))}
        </Shelf>
      )}
    </div>
  );
}
