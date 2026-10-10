/** Trending music in one genre, from the online catalogs. */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CollectionCard, RemoteNotice, RemoteShelf } from '@/components/cards/RemoteCards';
import { TrackList } from '@/components/cards/TrackList';
import { PlayActions } from '@/components/collection/PlayActions';
import { RowSkeleton } from '@/components/common/Skeleton';
import { useSettings } from '@/hooks/usePlayer';
import { useRemote } from '@/hooks/useRemote';
import { onlineCatalog } from '@/services/onlineCatalog';
import { genreGradient } from '@/components/cards/remoteHelpers';
import { cn } from '@/utils/cn';

const RANGES = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
  { id: 'allTime', label: 'All time' },
] as const;
type Range = (typeof RANGES)[number]['id'];

export default function BrowseGenrePage() {
  const { genre: raw = '' } = useParams();
  const genre = decodeURIComponent(raw);
  const [range, setRange] = useState<Range>('week');
  const sources = useSettings((s) => s.sources);
  const tracks = useRemote(sources.audius ? `trending:${genre}:${range}` : null, (signal) => onlineCatalog.trending({ genre, time: range, limit: 40, signal }));
  const archive = useRemote(sources.archive ? `archive:${genre}` : null, (signal) => onlineCatalog.searchArchive(genre, { limit: 16, signal }));
  const list = tracks.data ?? [];
  const context = { type: 'genre' as const, id: `audius:${genre}:${range}`, name: `${genre} · Trending`, href: `/browse/${encodeURIComponent(genre)}` };

  return (
    <div className="space-y-8">
      <header className="relative -mx-4 -mt-6 overflow-hidden px-4 pb-8 pt-12 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" style={{ background: genreGradient(genre) }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-bg" aria-hidden="true" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">Genre</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white sm:text-6xl">{genre}</h1>
          <p className="mt-2 text-sm text-white/80">What independent artists and listeners are playing right now.</p>
        </div>
      </header>

      {sources.audius ? (
        <section aria-labelledby="genre-trending" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="genre-trending" className="mr-auto text-xl font-extrabold">
              Trending songs
            </h2>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Time range">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  aria-pressed={range === r.id}
                  onClick={() => setRange(r.id)}
                  className={cn('rounded-full px-3.5 py-1.5 text-sm font-semibold transition', range === r.id ? 'bg-fg text-bg' : 'bg-fg/[0.07] hover:bg-fg/[0.12]')}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {list.length > 0 && (
            <div className="flex gap-3">
              <PlayActions trackIds={list.map((t) => t.id)} context={context} />
            </div>
          )}
          {tracks.loading && !list.length ? (
            Array.from({ length: 8 }, (_, i) => <RowSkeleton key={i} />)
          ) : tracks.error || tracks.offline ? (
            <RemoteNotice error={tracks.error} offline={tracks.offline} onRetry={tracks.retry} />
          ) : list.length ? (
            <TrackList tracks={list} context={context} rank />
          ) : (
            <p className="text-sm text-muted">Nothing trending in {genre} for this period.</p>
          )}
        </section>
      ) : (
        <RemoteNotice title="Audius is turned off" error="enable it in Settings → Music sources" />
      )}

      {sources.archive && (
        <RemoteShelf
          title="From the Internet Archive"
          subtitle="Free recordings and live sets"
          result={archive}
          hideWhenOffline
          render={(items) => items.map((c) => <CollectionCard key={c.id} collection={c} />)}
        />
      )}
    </div>
  );
}
