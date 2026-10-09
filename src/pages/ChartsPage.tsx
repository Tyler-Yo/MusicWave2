import { TrendingUp } from 'lucide-react';
import { TrackList } from '@/components/cards/TrackList';
import { PlayActions } from '@/components/collection/PlayActions';
import { useLibrary } from '@/hooks/usePlayer';
import { topCharts } from '@/services/recommendations';
import { libraryStore } from '@/state/libraryStore';

export default function ChartsPage() {
  useLibrary((s) => s.playCounts);
  const tracks = topCharts(libraryStore.get());
  const context = { type: 'chart' as const, id: 'top', name: 'Top Charts', href: '/charts' };
  return (
    <div className="space-y-8">
      <header>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
          <TrendingUp className="h-4 w-4" /> Updated weekly
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">Top Charts</h1>
        <p className="mt-2 max-w-xl text-muted">The most-played songs on MusicWave. Your own plays count too.</p>
        <div className="mt-6 flex gap-3">
          <PlayActions trackIds={tracks.map((t) => t.id)} context={context} />
        </div>
      </header>
      <TrackList tracks={tracks} context={context} rank />
    </div>
  );
}
