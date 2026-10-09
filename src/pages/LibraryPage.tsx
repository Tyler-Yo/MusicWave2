import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Clock, CloudOff, Disc3, Download, FileAudio, FileText, Heart, ListMusic, Plus, Trash2, Upload, UserRound } from 'lucide-react';
import { ArtistCard } from '@/components/cards/ArtistCard';
import { MediaCard } from '@/components/cards/MediaCard';
import { TrackList } from '@/components/cards/TrackList';
import { playCollection } from '@/components/collection/playCollection';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { useLibrary, useLyricsState, useSettings } from '@/hooks/usePlayer';
import { clearRenderCache } from '@/services/audioSources';
import { albumCover, getAlbum, getArtist, getPlaylist, getTracks, playlistCover, userPlaylistToPlaylist } from '@/services/catalog';
import { offlineStore } from '@/services/offlineStore';
import { libraryActions } from '@/state/libraryStore';
import { settingsActions } from '@/state/settingsStore';
import { ui } from '@/state/uiStore';
import { cn } from '@/utils/cn';
import { attachLrc, importAudioFiles } from '@/services/uploads';
import { formatBytes, plural, relativeTime } from '@/utils/format';

const TABS = [
  { id: 'playlists', label: 'Playlists', icon: ListMusic },
  { id: 'songs', label: 'Liked Songs', icon: Heart },
  { id: 'albums', label: 'Albums', icon: Disc3 },
  { id: 'artists', label: 'Artists', icon: UserRound },
  { id: 'recent', label: 'Recently Played', icon: Clock },
  { id: 'downloads', label: 'Downloads', icon: Download },
  { id: 'uploads', label: 'Uploads', icon: Upload },
] as const;
type TabId = (typeof TABS)[number]['id'];

function DownloadsTab() {
  const downloads = useLibrary((s) => s.downloads);
  const offline = useSettings((s) => s.offlineMode);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const tracks = getTracks(Object.keys(downloads));
  useEffect(() => {
    void offlineStore.estimate().then(setUsage);
  }, [downloads]);
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-line/60 bg-fg/[0.03] p-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="flex items-center gap-2 font-bold">
            <CloudOff className="h-4 w-4 text-ember" /> Offline mode
          </p>
          <p className="mt-1 text-sm text-muted">
            Simulates having no connection: only downloaded songs and your uploads can play.
            {usage && ` Using ${formatBytes(usage.usage)} of ${formatBytes(usage.quota)} browser storage.`}
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-semibold">
          <input type="checkbox" role="switch" checked={offline} onChange={(e) => settingsActions.set('offlineMode', e.target.checked)} className="peer sr-only" />
          <span className="relative h-7 w-12 rounded-full bg-fg/20 transition peer-checked:bg-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primary after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
          {offline ? 'On' : 'Off'}
        </label>
      </div>
      {tracks.length === 0 ? (
        <EmptyState icon={<Download className="h-7 w-7" />} title="No downloads yet">
          Choose “Download for offline” from any song’s ⋯ menu. Downloads are rendered once and saved in your browser.
        </EmptyState>
      ) : (
        <TrackList tracks={tracks} context={{ type: 'library', id: 'downloads', name: 'Downloads', href: '/library?tab=downloads' }} />
      )}
      <Button
        variant="ghost"
        size="sm"
        icon={<Trash2 className="h-4 w-4" />}
        onClick={() => void clearRenderCache().then(() => ui.toast('Cleared cached renders (downloads kept)', 'success'))}
      >
        Clear render cache
      </Button>
    </div>
  );
}

function UploadsTab() {
  const uploads = useLibrary((s) => s.uploads);
  const overrides = useLyricsState((s) => s.overrides);
  const tracks = getTracks(uploads.map((u) => u.id));
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-line bg-fg/[0.03] p-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="flex items-center gap-2 font-bold">
            <FileAudio className="h-4 w-4 text-primary" /> Bring your own music
          </p>
          <p className="mt-1 text-sm text-muted">
            Import MP3, M4A, OGG, WAV or FLAC files (stored privately in this browser). Name files “Artist - Title.mp3” for automatic metadata, then attach an .lrc file or sync lyrics in the Studio.
          </p>
        </div>
        <Button variant="primary" icon={<Upload className="h-4 w-4" />} onClick={() => void importAudioFiles()}>
          Import audio
        </Button>
      </div>
      {tracks.length === 0 ? (
        <EmptyState icon={<Upload className="h-7 w-7" />} title="No uploads yet">
          Your imported files appear here and play like any other track — including lyrics.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          <TrackList tracks={tracks} context={{ type: 'library', id: 'uploads', name: 'Your uploads', href: '/library?tab=uploads' }} showAlbum={false} />
          <ul className="space-y-1 pt-2 text-sm">
            {uploads.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-fg/[0.03] px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-muted">
                  {u.fileName} · {formatBytes(u.size)} · added {relativeTime(Date.parse(u.addedAt))}
                </span>
                {overrides[u.id] ? (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">Lyrics attached</span>
                ) : null}
                <Button size="sm" variant="ghost" icon={<FileText className="h-4 w-4" />} onClick={() => void attachLrc(u.id, u.title)}>
                  Attach .lrc
                </Button>
                <Link to={`/studio?track=${u.id}`} className="rounded-full px-3 py-1.5 text-sm font-semibold text-muted hover:bg-fg/5 hover:text-fg">
                  Sync in Studio
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'playlists') as TabId;
  const navigate = useNavigate();
  const playlists = useLibrary((s) => s.playlists);
  const savedPlaylists = useLibrary((s) => s.savedPlaylists);
  const liked = useLibrary((s) => s.likedTracks);
  const savedAlbums = useLibrary((s) => s.savedAlbums);
  const followed = useLibrary((s) => s.followedArtists);
  const history = useLibrary((s) => s.history);
  useLibrary((s) => s.uploads);

  const likedTracks = useMemo(() => getTracks(Object.entries(liked).sort((a, b) => b[1] - a[1]).map(([id]) => id)), [liked]);
  const recentTracks = useMemo(() => {
    const seen = new Set<string>();
    return getTracks(history.filter((h) => (seen.has(h.trackId) ? false : (seen.add(h.trackId), true))).map((h) => h.trackId)).slice(0, 50);
  }, [history]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl font-black tracking-tight">Your Library</h1>
        <Button
          variant="primary"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => {
            const p = libraryActions.createPlaylist(`My Playlist #${playlists.length + 1}`);
            navigate(`/playlist/${p.id}`);
          }}
        >
          New playlist
        </Button>
      </div>

      <div role="tablist" aria-label="Library sections" className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setParams({ tab: id }, { replace: true })}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition',
              tab === id ? 'bg-fg text-bg' : 'bg-fg/[0.07] text-muted hover:bg-fg/[0.12] hover:text-fg',
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-8">
        {tab === 'playlists' &&
          (playlists.length + Object.keys(savedPlaylists).length === 0 ? (
            <EmptyState icon={<ListMusic className="h-7 w-7" />} title="Create your first playlist">
              Playlists you make — and ones you save — live here.
            </EmptyState>
          ) : (
            <div role="list" className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-5 gap-y-8 [&>div]:w-auto">
              {playlists.map((up) => {
                const p = userPlaylistToPlaylist(up);
                return (
                  <MediaCard key={p.id} href={`/playlist/${p.id}`} cover={playlistCover(p)} title={p.title} subtitle={plural(p.trackIds.length, 'song')} onPlay={p.trackIds.length ? () => playCollection(p.trackIds, { type: 'playlist', id: p.id, name: p.title, href: `/playlist/${p.id}` }) : undefined} />
                );
              })}
              {Object.keys(savedPlaylists).map((id) => {
                const p = getPlaylist(id);
                return p ? (
                  <MediaCard key={id} href={`/playlist/${id}`} cover={playlistCover(p)} title={p.title} subtitle={`By ${p.curator}`} onPlay={() => playCollection(p.trackIds, { type: 'playlist', id, name: p.title, href: `/playlist/${id}` })} />
                ) : null;
              })}
            </div>
          ))}

        {tab === 'songs' &&
          (likedTracks.length === 0 ? (
            <EmptyState icon={<Heart className="h-7 w-7" />} title="Songs you like will appear here">
              Tap the heart on any song to save it.
            </EmptyState>
          ) : (
            <TrackList tracks={likedTracks} context={{ type: 'library', id: 'liked', name: 'Liked Songs', href: '/library?tab=songs' }} />
          ))}

        {tab === 'albums' &&
          (Object.keys(savedAlbums).length === 0 ? (
            <EmptyState icon={<Disc3 className="h-7 w-7" />} title="No saved albums">
              Save albums from their page to find them here.
            </EmptyState>
          ) : (
            <div role="list" className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-5 gap-y-8 [&>div]:w-auto">
              {Object.keys(savedAlbums).map((id) => {
                const a = getAlbum(id);
                return a ? (
                  <MediaCard key={id} href={`/album/${id}`} cover={albumCover(a)} title={a.title} subtitle={getArtist(a.artistId)?.name} onPlay={() => playCollection(a.trackIds, { type: 'album', id, name: a.title, href: `/album/${id}` })} />
                ) : null;
              })}
            </div>
          ))}

        {tab === 'artists' &&
          (Object.keys(followed).length === 0 ? (
            <EmptyState icon={<UserRound className="h-7 w-7" />} title="Follow artists you love">
              Followed artists show up here.
            </EmptyState>
          ) : (
            <div role="list" className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-x-5 gap-y-8 [&>div]:w-auto">
              {Object.keys(followed).map((id) => {
                const a = getArtist(id);
                return a ? <ArtistCard key={id} artist={a} /> : null;
              })}
            </div>
          ))}

        {tab === 'recent' &&
          (recentTracks.length === 0 ? (
            <EmptyState icon={<Clock className="h-7 w-7" />} title="Nothing played yet">
              Songs count as played after a few seconds of listening.
            </EmptyState>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => libraryActions.clearHistory()}>
                  Clear history
                </Button>
              </div>
              <TrackList tracks={recentTracks} context={{ type: 'library', id: 'recent', name: 'Recently Played', href: '/library?tab=recent' }} />
            </div>
          ))}

        {tab === 'downloads' && <DownloadsTab />}
        {tab === 'uploads' && <UploadsTab />}
      </div>
    </div>
  );
}
