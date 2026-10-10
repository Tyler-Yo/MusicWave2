/** Everything saved for offline listening, plus downloads in progress. */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownCircle, HardDrive, RefreshCw, Settings2, Trash2, WifiOff, X } from 'lucide-react';
import { TrackList } from '@/components/cards/TrackList';
import { PlayActions } from '@/components/collection/PlayActions';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { ProgressRing } from '@/components/common/DownloadIndicator';
import { QualityBadge } from '@/components/common/QualityBadge';
import { useLibrary, useSettings } from '@/hooks/usePlayer';
import { getTrack, getTracks } from '@/services/catalog';
import { cancelAllDownloads, cancelDownload, downloadsStore, enqueueDownloads, removeDownload } from '@/services/downloads';
import { offlineStore } from '@/services/offlineStore';
import { TIER_LABEL } from '@/services/quality';
import { useStore } from '@/state/createStore';
import { useOffline } from '@/state/networkStore';
import { remoteCatalogStore } from '@/state/remoteCatalog';
import { ui } from '@/state/uiStore';
import type { QualityTier } from '@/types/music';
import { cn } from '@/utils/cn';
import { formatBytes, formatTotal, plural } from '@/utils/format';

const CONTEXT = { type: 'library' as const, id: 'downloads', name: 'Downloads', href: '/downloads' };
type Filter = 'all' | QualityTier;

export default function DownloadsPage() {
  useStore(remoteCatalogStore, (s) => s.version);
  const downloads = useLibrary((s) => s.downloads);
  const jobs = useStore(downloadsStore, (s) => s.jobs);
  const quality = useSettings((s) => s.downloadQuality);
  const { offline, connected } = useOffline();
  const [filter, setFilter] = useState<Filter>('all');
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

  const ordered = useMemo(
    () =>
      getTracks(
        Object.entries(downloads)
          .sort((a, b) => b[1].savedAt - a[1].savedAt)
          .map(([id]) => id),
      ),
    [downloads],
  );
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: ordered.length, high: 0, lossless: 0, hires: 0 };
    for (const t of ordered) {
      const tier = downloads[t.id]?.tier;
      if (tier) c[tier]++;
    }
    return c;
  }, [ordered, downloads]);
  const shown = filter === 'all' ? ordered : ordered.filter((t) => downloads[t.id]?.tier === filter);
  const totalSize = Object.values(downloads).reduce((a, d) => a + d.size, 0);
  const totalTime = ordered.reduce((a, t) => a + t.duration, 0);
  const jobList = Object.values(jobs);
  const failed = jobList.filter((j) => j.status === 'error');

  useEffect(() => {
    void offlineStore.estimate().then(setStorage);
  }, [downloads]);

  const removeAll = async () => {
    if (!window.confirm(`Remove all ${ordered.length} downloaded songs from this device?`)) return;
    for (const t of ordered) await removeDownload(t);
    ui.toast('All downloads removed');
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <div className="grid h-40 w-40 shrink-0 place-items-center self-center rounded-2xl bg-gradient-to-br from-primary via-accent to-ember text-white shadow-[0_24px_60px_-18px_rgba(0,0,0,0.6)] sm:self-auto">
          <ArrowDownCircle className="h-16 w-16" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-fg/70">Available offline</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Downloads</h1>
          <p className="mt-3 text-sm text-muted">
            {plural(ordered.length, 'song')}
            {totalTime > 0 && ` · ${formatTotal(totalTime)}`}
            {totalSize > 0 && ` · ${formatBytes(totalSize)}`}
            {storage && storage.quota > 0 && ` · ${formatBytes(storage.usage)} of ${formatBytes(storage.quota)} browser storage used`}
          </p>
          <p className="mt-1 text-sm text-muted">
            New downloads are saved in <strong className="text-fg">{TIER_LABEL[quality]}</strong> when the source has it.{' '}
            <Link to="/settings#audio-quality" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              <Settings2 className="h-3.5 w-3.5" /> Change
            </Link>
          </p>
        </div>
      </header>

      {offline && (
        <div className="flex items-center gap-3 rounded-2xl bg-primary/10 px-4 py-3 text-sm">
          <WifiOff className="h-4 w-4 shrink-0 text-primary" />
          <span>{connected ? 'Offline mode is on' : 'You’re offline'} — everything on this page still plays, with lyrics and artwork.</span>
        </div>
      )}

      {jobList.length > 0 && (
        <section aria-labelledby="in-progress" className="rounded-2xl border border-line/50 bg-fg/[0.03] p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="in-progress" className="font-extrabold">
              {jobList.length - failed.length > 0 ? `Downloading · ${jobList.length - failed.length} left` : 'Downloads that failed'}
            </h2>
            <div className="flex gap-2">
              {failed.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => enqueueDownloads(failed.map((j) => getTrack(j.trackId)).filter((t): t is NonNullable<typeof t> => Boolean(t)))}
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                >
                  Retry failed
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={cancelAllDownloads} icon={<X className="h-3.5 w-3.5" />}>
                {failed.length === jobList.length ? 'Clear' : 'Cancel all'}
              </Button>
            </div>
          </div>
          <ul className="divide-y divide-line/40">
            {jobList.map((j) => {
              const pct = j.total ? Math.min(1, j.received / j.total) : null;
              return (
                <li key={j.trackId} className="flex items-center gap-3 py-2 text-sm">
                  <span className={cn('shrink-0', j.status === 'error' ? 'text-ember' : 'text-primary')}>
                    <ProgressRing value={j.status === 'queued' ? 0 : j.status === 'error' ? 1 : pct} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{j.title}</span>
                    <span className={cn('block truncate text-xs', j.status === 'error' ? 'text-ember' : 'text-muted')}>
                      {j.status === 'queued' && 'Waiting…'}
                      {j.status === 'downloading' && (j.total ? `${formatBytes(j.received)} of ${formatBytes(j.total)}` : j.received ? formatBytes(j.received) : 'Starting…')}
                      {j.status === 'saving' && 'Saving to this device…'}
                      {j.status === 'error' && (j.error ?? 'Failed')}
                    </span>
                  </span>
                  {j.tier && <QualityBadge tier={j.tier} showHigh />}
                  <button onClick={() => cancelDownload(j.trackId)} aria-label={`Cancel ${j.title}`} className="grid h-8 w-8 place-items-center rounded-full text-subtle hover:bg-fg/10 hover:text-fg">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {ordered.length === 0 ? (
        <EmptyState
          icon={<HardDrive className="h-7 w-7" />}
          title="No downloads yet"
          action={
            <Link to="/search" className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-bold text-on-primary">
              Find music
            </Link>
          }
        >
          Use “Download” on any song, album or playlist and it will be saved here for listening without a connection — with its lyrics.
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <PlayActions trackIds={shown.map((t) => t.id)} context={CONTEXT} />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by quality">
              {(['all', 'hires', 'lossless', 'high'] as Filter[])
                .filter((f) => f === 'all' || counts[f] > 0)
                .map((f) => (
                  <button
                    key={f}
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                    className={cn('rounded-full px-3.5 py-1.5 text-sm font-semibold transition', filter === f ? 'bg-fg text-bg' : 'bg-fg/[0.07] hover:bg-fg/[0.12]')}
                  >
                    {f === 'all' ? 'All' : TIER_LABEL[f]} · {counts[f]}
                  </button>
                ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => void removeAll()} icon={<Trash2 className="h-4 w-4" />} className="ml-auto">
              Remove all
            </Button>
          </div>
          <TrackList tracks={shown} context={CONTEXT} />
        </>
      )}
    </div>
  );
}
