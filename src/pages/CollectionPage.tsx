/** An online album / playlist (Audius) or recording (Internet Archive). */
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Disc3, Download, ExternalLink, Heart, ListPlus } from 'lucide-react';
import { RemoteNotice } from '@/components/cards/RemoteCards';
import { collectionContext, PROVIDER_LABEL } from '@/components/cards/remoteHelpers';
import { TrackList } from '@/components/cards/TrackList';
import { CollectionHeader } from '@/components/collection/CollectionHeader';
import { PlayActions } from '@/components/collection/PlayActions';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { ProgressRing } from '@/components/common/DownloadIndicator';
import { QualityBadge } from '@/components/common/QualityBadge';
import { RowSkeleton, Skeleton } from '@/components/common/Skeleton';
import { useLibrary } from '@/hooks/usePlayer';
import { useRemote } from '@/hooks/useRemote';
import { collectionCover, generatedCover } from '@/services/catalog';
import { downloadAll, downloadsStore } from '@/services/downloads';
import { onlineCatalog, type CollectionData } from '@/services/onlineCatalog';
import { bestTier } from '@/services/quality';
import { useStore } from '@/state/createStore';
import { libraryActions } from '@/state/libraryStore';
import { remoteCatalogStore } from '@/state/remoteCatalog';
import { ui } from '@/state/uiStore';
import type { Palette } from '@/types/music';
import { formatTotal, plural } from '@/utils/format';
import { hashString } from '@/utils/random';
import { PALETTES } from '@/data/catalog';

const palettes = Object.values(PALETTES);

export default function CollectionPage() {
  const { id: rawParam = '' } = useParams();
  const id = decodeURIComponent(rawParam);
  useStore(remoteCatalogStore, (s) => s.version);
  const result = useRemote<CollectionData | null>(`collection:${id}`, (signal) => onlineCatalog.collection(id, signal));
  const data = result.data ?? onlineCatalog.cachedCollection(id);
  const saved = useLibrary((s) => Boolean(s.savedAlbums[id] || s.savedPlaylists[id]));
  const downloads = useLibrary((s) => s.downloads);
  const jobs = useStore(downloadsStore, (s) => s.jobs);

  const palette: Palette = palettes[hashString(id) % palettes.length];
  const tracks = useMemo(() => data?.tracks ?? [], [data]);
  const tier = useMemo(() => bestTier(tracks.flatMap((t) => (t.source.kind === 'remote' ? t.source.variants : []))), [tracks]);

  if (!data) {
    if (result.loading) {
      return (
        <div aria-busy="true" aria-label="Loading">
          <div className="mb-8 flex flex-col items-center gap-6 sm:flex-row sm:items-end">
            <Skeleton className="h-56 w-56 rounded-2xl" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
          {Array.from({ length: 6 }, (_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      );
    }
    if (result.offline || result.error) return <RemoteNotice offline={result.offline} error={result.error} onRetry={result.retry} />;
    return (
      <EmptyState icon={<Disc3 className="h-7 w-7" />} title="Not found">
        This album or playlist doesn’t exist anymore, or isn’t public.
      </EmptyState>
    );
  }

  const c = data.collection;
  const context = collectionContext(c);
  const total = tracks.reduce((a, t) => a + t.duration, 0);
  const ids = tracks.map((t) => t.id);
  const savedCount = tracks.filter((t) => downloads[t.id]).length;
  const active = tracks.filter((t) => jobs[t.id] && jobs[t.id].status !== 'error');
  const allSaved = tracks.length > 0 && savedCount === tracks.length;
  const kind = c.kind === 'recording' ? 'Recording' : c.kind === 'album' ? 'Album' : 'Playlist';
  const artistLink = c.artistId ? `/artist/${encodeURIComponent(c.artistId)}` : undefined;

  const toggleSave = () => {
    if (c.kind === 'playlist') libraryActions.toggleSavePlaylist(c.id);
    else libraryActions.toggleSaveAlbum(c.id);
    ui.toast(saved ? 'Removed from your library' : 'Saved to your library', 'success');
  };

  return (
    <div className="space-y-8">
      <CollectionHeader
        cover={collectionCover(c)}
        kind={`${kind} · ${PROVIDER_LABEL[c.provider]}`}
        title={c.title}
        palette={palette}
        description={c.description ? <span className="line-clamp-3 whitespace-pre-line">{c.description}</span> : undefined}
        meta={
          <>
            {artistLink ? (
              <Link to={artistLink} className="font-bold text-fg hover:underline">
                {c.artistName}
              </Link>
            ) : (
              <span className="font-bold text-fg">{c.artistName}</span>
            )}
            {c.year && <span>· {c.year}</span>}
            {tracks.length > 0 && (
              <span>
                · {plural(tracks.length, 'song')}
                {total > 0 ? `, ${formatTotal(total)}` : ''}
              </span>
            )}
            {(tier !== 'high' || c.has24Bit) && <QualityBadge tier={tier} detail={c.has24Bit && tier !== 'hires' ? '24-bit masters' : undefined} />}
          </>
        }
        actions={
          <>
            <PlayActions trackIds={ids} context={context} />
            <Button size="lg" variant="ghost" aria-pressed={saved} onClick={toggleSave} icon={<Heart className="h-5 w-5" fill={saved ? 'currentColor' : 'none'} />} className={saved ? '!text-ember' : ''}>
              {saved ? 'Saved' : 'Save'}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              disabled={tracks.length === 0 || allSaved || active.length > 0}
              onClick={() => downloadAll(tracks, c.title)}
              icon={active.length ? <ProgressRing value={null} className="h-5 w-5" /> : allSaved ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Download className="h-5 w-5" />}
            >
              {active.length ? `Downloading ${savedCount}/${tracks.length}` : allSaved ? 'Downloaded' : savedCount ? `Download rest (${tracks.length - savedCount})` : 'Download'}
            </Button>
            <Button size="lg" variant="ghost" disabled={!tracks.length} onClick={() => ui.openAddToPlaylist(ids)} icon={<ListPlus className="h-5 w-5" />}>
              Add to playlist
            </Button>
          </>
        }
      />
      {result.error && <RemoteNotice error={result.error} onRetry={result.retry} compact />}
      {tracks.length > 0 ? (
        <TrackList tracks={tracks} context={context} showCover={c.kind === 'playlist'} showAlbum={c.kind === 'playlist'} />
      ) : (
        <EmptyState icon={<img src={generatedCover(id)} alt="" className="h-10 w-10 rounded-lg" />} title="No playable tracks">
          The files in this item can’t be played in a browser.
        </EmptyState>
      )}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
        <span>
          From {PROVIDER_LABEL[c.provider]}
          {c.provider === 'archive' ? ' — public domain, Creative Commons or taper-friendly live recordings.' : ' — streamed with the artist’s permission via the Audius network.'}
        </span>
        {c.pageUrl && (
          <a href={c.pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-muted hover:text-fg">
            View source <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </p>
    </div>
  );
}
