import { MediaCard } from '@/components/cards/MediaCard';
import { playCollection } from '@/components/collection/playCollection';
import { albumCover, getArtist } from '@/services/catalog';
import { newReleases } from '@/services/recommendations';
import { formatDate } from '@/utils/format';

export default function NewReleasesPage() {
  const albums = newReleases();
  return (
    <div>
      <h1 className="text-4xl font-black tracking-tight">New Releases</h1>
      <p className="mt-2 text-muted">Fresh albums, EPs and singles from MusicWave artists.</p>
      <div role="list" className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-5 gap-y-8 [&>div]:w-auto">
        {albums.map((a) => (
          <MediaCard
            key={a.id}
            href={`/album/${a.id}`}
            cover={albumCover(a)}
            title={a.title}
            subtitle={`${getArtist(a.artistId)?.name} · ${formatDate(a.releaseDate)}`}
            onPlay={() => playCollection(a.trackIds, { type: 'album', id: a.id, name: a.title, href: `/album/${a.id}` })}
          />
        ))}
      </div>
    </div>
  );
}
