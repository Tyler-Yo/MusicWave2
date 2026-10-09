import { useParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { TrackList } from '@/components/cards/TrackList';
import { CollectionHeader } from '@/components/collection/CollectionHeader';
import { PlayActions } from '@/components/collection/PlayActions';
import { EmptyState } from '@/components/common/EmptyState';
import { useLibrary } from '@/hooks/usePlayer';
import { getTracks } from '@/services/catalog';
import { getMix } from '@/services/recommendations';
import { libraryStore } from '@/state/libraryStore';
import { formatTotal, plural } from '@/utils/format';

export default function MixPage() {
  const { id = '' } = useParams();
  useLibrary((s) => s.playCounts);
  const mix = getMix(id, libraryStore.get());
  if (!mix) return <EmptyState icon={<Sparkles className="h-7 w-7" />} title="Mix not found">Mixes refresh as you listen — head back home for today’s picks.</EmptyState>;
  const tracks = getTracks(mix.trackIds);
  const context = { type: 'mix' as const, id: mix.id, name: mix.title, href: `/mix/${mix.id}` };
  return (
    <div className="space-y-8">
      <CollectionHeader
        cover={mix.cover}
        kind="Made for you"
        title={mix.title}
        description={mix.description}
        palette={mix.palette}
        meta={<span>{plural(tracks.length, 'song')}, {formatTotal(tracks.reduce((a, t) => a + t.duration, 0))}</span>}
        actions={<PlayActions trackIds={mix.trackIds} context={context} />}
      />
      <TrackList tracks={tracks} context={context} />
    </div>
  );
}
