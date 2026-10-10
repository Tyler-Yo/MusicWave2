import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Clock, Mic2, Play, SearchX, WifiOff, X } from 'lucide-react';
import { ArtistCard } from '@/components/cards/ArtistCard';
import { GenreTile } from '@/components/cards/GenreTile';
import { MediaCard } from '@/components/cards/MediaCard';
import { OnlineGenreTile } from '@/components/cards/OnlineGenreTile';
import { CollectionCard, RemoteArtistCard, RemoteNotice, RemoteShelf } from '@/components/cards/RemoteCards';
import { Shelf } from '@/components/cards/Shelf';
import { TrackList } from '@/components/cards/TrackList';
import { playCollection } from '@/components/collection/playCollection';
import { CoverImage } from '@/components/common/CoverImage';
import { EmptyState } from '@/components/common/EmptyState';
import { QualityBadge } from '@/components/common/QualityBadge';
import { RowSkeleton, ShelfSkeleton, Skeleton } from '@/components/common/Skeleton';
import { SearchInput } from '@/components/layout/TopBar';
import { GENRES } from '@/data/catalog';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLibrary, useSettings } from '@/hooks/usePlayer';
import { useRemote } from '@/hooks/useRemote';
import {
  albumCover,
  albumHref,
  artistHref,
  artistImage,
  artistNameOf,
  getAlbum,
  getArtist,
  getPlaylist,
  getTrack,
  getTracks,
  playlistCover,
  trackCover,
  trackFallbackCover,
  tracksByArtist,
} from '@/services/catalog';
import { onlineCatalog } from '@/services/onlineCatalog';
import { AUDIUS_GENRES } from '@/services/providers/audius';
import { bestTier } from '@/services/quality';
import { normalize, search, type LyricHit } from '@/services/search';
import { libraryActions } from '@/state/libraryStore';
import { useOffline } from '@/state/networkStore';
import { player } from '@/state/playerStore';
import { ui } from '@/state/uiStore';
import type { PlayContext, Track } from '@/types/music';
import { cn } from '@/utils/cn';
import { compactNumber, formatTime } from '@/utils/format';

function Highlight({ text, query }: { text: string; query: string }) {
  const i = text.toLowerCase().indexOf(query.toLowerCase().trim());
  if (i < 0 || !query.trim()) return <>{text}</>;
  const q = query.trim();
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-primary/25 px-0.5 text-fg">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

function LyricResult({ hit, query }: { hit: LyricHit; query: string }) {
  const play = () => {
    libraryActions.rememberSearch(query);
    player.playTracks([hit.track.id], 0, { type: 'search', name: `“${query}” in lyrics`, href: `/search?q=${encodeURIComponent(query)}` });
    player.seek(Math.max(0, hit.time - 0.4));
    ui.openNowPlaying('lyrics');
  };
  return (
    <li>
      <button onClick={play} className="group flex w-full items-center gap-4 rounded-xl px-2 py-2.5 text-left hover:bg-fg/[0.05]">
        <CoverImage src={trackCover(hit.track)} alt="" rounded="rounded-md" className="h-12 w-12 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold italic">
            “<Highlight text={hit.text} query={query} />”
          </span>
          <span className="block truncate text-sm text-muted">
            {hit.track.title} · {artistNameOf(hit.track)}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-fg/[0.07] px-3 py-1.5 text-xs font-bold text-muted transition group-hover:bg-primary group-hover:text-on-primary">
          <Play className="h-3 w-3" fill="currentColor" /> {formatTime(hit.time)}
        </span>
      </button>
    </li>
  );
}

function TopResult({ kind, id }: { kind: 'track' | 'artist' | 'album' | 'playlist'; id: string }) {
  let cover = '';
  let title = '';
  let subtitle = '';
  let href = '';
  let onPlay: () => void = () => undefined;
  if (kind === 'track') {
    const t = getTrack(id)!;
    cover = trackCover(t);
    title = t.title;
    subtitle = `Song · ${artistNameOf(t)}`;
    href = `/album/${t.albumId}`;
    onPlay = () => player.playTrack(t.id, { type: 'search', name: 'Search' });
  } else if (kind === 'artist') {
    const a = getArtist(id)!;
    cover = artistImage(a);
    title = a.name;
    subtitle = 'Artist';
    href = `/artist/${a.id}`;
    onPlay = () => player.playTracks(getTracksForArtist(a.id), 0, { type: 'artist', id: a.id, name: a.name, href });
  } else if (kind === 'album') {
    const a = getAlbum(id)!;
    cover = albumCover(a);
    title = a.title;
    subtitle = `Album · ${getArtist(a.artistId)?.name}`;
    href = `/album/${a.id}`;
    onPlay = () => playCollection(a.trackIds, { type: 'album', id: a.id, name: a.title, href });
  } else {
    const p = getPlaylist(id)!;
    cover = playlistCover(p);
    title = p.title;
    subtitle = `Playlist · ${p.curator}`;
    href = `/playlist/${p.id}`;
    onPlay = () => playCollection(p.trackIds, { type: 'playlist', id: p.id, name: p.title, href });
  }
  return (
    <div className="group relative rounded-2xl bg-fg/[0.05] p-5 transition hover:bg-fg/[0.08]">
      <Link to={href} className="block rounded-xl">
        <CoverImage src={cover} alt="" rounded={kind === 'artist' ? 'rounded-full' : 'rounded-xl'} className="h-28 w-28 shadow-card" />
        <p className="mt-4 truncate text-3xl font-black">{title}</p>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </Link>
      <button
        onClick={onPlay}
        aria-label={`Play ${title}`}
        className="absolute bottom-5 right-5 grid h-12 w-12 place-items-center rounded-full bg-primary text-on-primary shadow-glow transition hover:scale-105"
      >
        <Play className="h-5 w-5" fill="currentColor" />
      </button>
    </div>
  );
}

const getTracksForArtist = (id: string) => tracksByArtist(id).map((t) => t.id);

function BrowseHome() {
  const recent = useLibrary((s) => s.recentSearches);
  const sources = useSettings((s) => s.sources);
  const { offline } = useOffline();
  const [, setParams] = useSearchParams();
  return (
    <div className="space-y-10">
      {recent.length > 0 && (
        <section aria-labelledby="recent-searches">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="recent-searches" className="text-lg font-extrabold">
              Recent searches
            </h2>
            <button onClick={() => libraryActions.clearSearches()} className="text-sm font-semibold text-muted hover:text-fg">
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((q) => (
              <button key={q} onClick={() => setParams({ q })} className="inline-flex items-center gap-2 rounded-full bg-fg/[0.07] px-4 py-2 text-sm font-semibold hover:bg-fg/[0.12]">
                <Clock className="h-3.5 w-3.5 text-subtle" /> {q}
              </button>
            ))}
          </div>
        </section>
      )}
      {sources.audius && !offline && (
        <section aria-labelledby="browse-all">
          <h2 id="browse-all" className="mb-1 text-2xl font-black tracking-tight">
            Browse all
          </h2>
          <p className="mb-4 text-sm text-muted">Search any artist, song, album, playlist or live recording — or dive into a genre.</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {AUDIUS_GENRES.map((g) => (
              <OnlineGenreTile key={g} genre={g} />
            ))}
          </div>
        </section>
      )}
      <section aria-labelledby="originals-genres">
        <h2 id="originals-genres" className="mb-4 text-xl font-extrabold tracking-tight">
          MusicWave Originals
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {GENRES.map((g) => (
            <GenreTile key={g.id} genre={g} />
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-line/50 bg-fg/[0.03] p-5">
        <h2 className="flex items-center gap-2 font-extrabold">
          <Mic2 className="h-4 w-4 text-primary" /> Try searching inside lyrics
        </h2>
        <p className="mt-1 text-sm text-muted">Type a line you remember — results jump straight to that moment in the song (MusicWave Originals and songs whose lyrics you’ve opened).</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {['carry me home', 'violet rain', 'semicolons', 'harbor lights', 'golden hour'].map((q) => (
            <button key={q} onClick={() => setParams({ q })} className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/20">
              “{q}”
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

type Filter = 'all' | 'songs' | 'artists' | 'albums' | 'archive' | 'originals';
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'songs', label: 'Songs' },
  { id: 'artists', label: 'Artists' },
  { id: 'albums', label: 'Albums & Playlists' },
  { id: 'archive', label: 'Live & Archive' },
  { id: 'originals', label: 'MusicWave Originals' },
];

function RemoteTopTrack({ track, list, context }: { track: Track; list: Track[]; context: PlayContext }) {
  const href = albumHref(track) ?? artistHref(track) ?? '/';
  const tier = track.source.kind === 'remote' ? bestTier(track.source.variants) : 'high';
  return (
    <div className="group relative rounded-2xl bg-fg/[0.05] p-5 transition hover:bg-fg/[0.08]">
      <Link to={href} className="block rounded-xl">
        <CoverImage src={trackCover(track)} fallback={trackFallbackCover(track)} alt="" className="h-28 w-28 shadow-card" />
        <p className="mt-4 line-clamp-2 pr-16 text-2xl font-black sm:text-3xl">{track.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pr-16 text-sm text-muted">
          Song · {artistNameOf(track)}
          <QualityBadge tier={tier} />
          {track.plays > 0 && <span className="text-subtle">· {compactNumber(track.plays)} plays</span>}
        </p>
      </Link>
      <button
        onClick={() =>
          player.playTracks(
            list.map((t) => t.id),
            list.indexOf(track),
            context,
          )
        }
        aria-label={`Play ${track.title}`}
        className="absolute bottom-5 right-5 grid h-12 w-12 place-items-center rounded-full bg-primary text-on-primary shadow-glow transition hover:scale-105"
      >
        <Play className="h-5 w-5" fill="currentColor" />
      </button>
    </div>
  );
}

function SongsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <RowSkeleton key={i} />
      ))}
    </div>
  );
}

/** Downloaded songs matching the query — what search can still find offline. */
function useOfflineMatches(q: string): Track[] {
  const downloads = useLibrary((s) => s.downloads);
  return useMemo(() => {
    const n = normalize(q);
    if (!n) return [];
    return getTracks(Object.keys(downloads)).filter((t) => normalize(`${t.title} ${artistNameOf(t)} ${t.albumTitle ?? ''}`).includes(n));
  }, [q, downloads]);
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const filter = (params.get('type') as Filter | null) ?? 'all';
  const losslessOnly = params.get('lossless') === '1';
  const debounced = useDebouncedValue(query, 300);
  const q = debounced.trim();
  const pending = query.trim() !== q;
  const sources = useSettings((s) => s.sources);
  const { offline } = useOffline();
  const local = useMemo(() => search(debounced), [debounced]);
  const offlineMatches = useOfflineMatches(q);

  const wants = (f: Filter) => filter === 'all' || filter === f;
  const songs = useRemote(q && sources.audius && wants('songs') ? `search:tracks:${q}:${filter === 'songs'}` : null, (signal) =>
    onlineCatalog.searchTracks(q, { limit: filter === 'songs' ? 50 : 20, signal }),
  );
  const artists = useRemote(q && sources.audius && wants('artists') ? `search:artists:${q}` : null, (signal) => onlineCatalog.searchArtists(q, { limit: 16, signal }));
  const albums = useRemote(q && sources.audius && wants('albums') ? `search:playlists:${q}` : null, (signal) => onlineCatalog.searchPlaylists(q, { limit: 16, signal }));
  const archive = useRemote(q && sources.archive && wants('archive') ? `search:archive:${q}:${losslessOnly}` : null, (signal) =>
    onlineCatalog.searchArchive(q, { limit: 24, losslessOnly, signal }),
  );

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const remoteTotal = (songs.data?.length ?? 0) + (artists.data?.length ?? 0) + (albums.data?.length ?? 0) + (archive.data?.length ?? 0);
  const anyLoading = songs.loading || artists.loading || albums.loading || archive.loading;
  const anyError = songs.error || artists.error || albums.error || archive.error;

  useEffect(() => {
    if (!q || (local.total === 0 && remoteTotal === 0)) return;
    const id = setTimeout(() => libraryActions.rememberSearch(q), 1500);
    return () => clearTimeout(id);
  }, [q, local.total, remoteTotal]);

  const searchCtx: PlayContext = { type: 'search', id: q, name: `Search: ${q}`, href: `/search?q=${encodeURIComponent(q)}` };
  const songList = songs.data ?? [];

  const filters = (
    <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter results">
      {FILTERS.filter((f) => (f.id === 'archive' ? sources.archive : f.id === 'songs' || f.id === 'artists' || f.id === 'albums' ? sources.audius : true)).map((f) => (
        <button
          key={f.id}
          aria-pressed={filter === f.id}
          onClick={() => setParam('type', f.id === 'all' ? null : f.id)}
          className={cn('shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition', filter === f.id ? 'bg-fg text-bg' : 'bg-fg/[0.07] hover:bg-fg/[0.12]')}
        >
          {f.label}
        </button>
      ))}
    </div>
  );

  const originals = (
    <>
      {local.top && filter === 'originals' && (
        <section aria-labelledby="top-result">
          <h2 id="top-result" className="mb-3 text-xl font-extrabold">
            Top result
          </h2>
          <div className="max-w-md">
            <TopResult kind={local.top.kind} id={local.top.id} />
          </div>
        </section>
      )}
      {local.tracks.length > 0 && (
        <section aria-labelledby="originals-songs" className="min-w-0">
          <h2 id="originals-songs" className="mb-3 text-xl font-extrabold">
            {filter === 'originals' ? 'Songs' : 'MusicWave Originals'}
          </h2>
          <TrackList tracks={local.tracks.slice(0, filter === 'originals' ? 20 : 5)} context={searchCtx} header={false} showAlbum={false} />
        </section>
      )}
      {local.lyrics.length > 0 && (
        <section aria-labelledby="lyrics-result">
          <h2 id="lyrics-result" className="mb-1 flex items-center gap-2 text-xl font-extrabold">
            <Mic2 className="h-5 w-5 text-primary" /> In lyrics
          </h2>
          <p className="mb-3 text-sm text-muted">Click a line to play the song from that moment.</p>
          <ul className="grid gap-x-6 md:grid-cols-2">
            {local.lyrics.map((hit) => (
              <LyricResult key={`${hit.track.id}-${hit.lineIndex}`} hit={hit} query={debounced} />
            ))}
          </ul>
        </section>
      )}
      {filter === 'originals' && (
        <>
          {local.artists.length > 0 && (
            <Shelf title="Artists">
              {local.artists.map((a) => (
                <ArtistCard key={a.id} artist={a} />
              ))}
            </Shelf>
          )}
          {local.albums.length > 0 && (
            <Shelf title="Albums">
              {local.albums.map((a) => (
                <MediaCard
                  key={a.id}
                  href={`/album/${a.id}`}
                  cover={albumCover(a)}
                  title={a.title}
                  subtitle={getArtist(a.artistId)?.name}
                  onPlay={() => playCollection(a.trackIds, { type: 'album', id: a.id, name: a.title, href: `/album/${a.id}` })}
                />
              ))}
            </Shelf>
          )}
          {local.playlists.length > 0 && (
            <Shelf title="Playlists">
              {local.playlists.map((p) => (
                <MediaCard
                  key={p.id}
                  href={`/playlist/${p.id}`}
                  cover={playlistCover(p)}
                  title={p.title}
                  subtitle={`By ${p.curator}`}
                  onPlay={() => playCollection(p.trackIds, { type: 'playlist', id: p.id, name: p.title, href: `/playlist/${p.id}` })}
                />
              ))}
            </Shelf>
          )}
          {local.genres.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-extrabold">Genres</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {local.genres.map((g) => (
                  <GenreTile key={g.id} genre={g} />
                ))}
              </div>
            </section>
          )}
          {local.total === 0 && <EmptyState icon={<SearchX className="h-7 w-7" />} title={`No originals match “${q}”`} />}
        </>
      )}
    </>
  );

  let body: React.ReactNode;
  if (!query.trim()) body = <BrowseHome />;
  else if (pending)
    body = (
      <div className="space-y-8" aria-busy="true" aria-label="Searching">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Skeleton className="h-60 rounded-2xl" />
          <SongsSkeleton rows={4} />
        </div>
        <ShelfSkeleton />
      </div>
    );
  else if (offline)
    body = (
      <div className="space-y-8">
        <div className="flex items-center gap-3 rounded-2xl bg-fg/[0.05] px-4 py-3 text-sm text-muted">
          <WifiOff className="h-4 w-4 shrink-0" /> You’re offline — showing matches from your downloads and MusicWave Originals.
        </div>
        {offlineMatches.length > 0 && (
          <section>
            <h2 className="mb-3 text-xl font-extrabold">Downloaded</h2>
            <TrackList tracks={offlineMatches} context={searchCtx} header={false} />
          </section>
        )}
        {originals}
        {offlineMatches.length === 0 && local.total === 0 && <EmptyState icon={<SearchX className="h-7 w-7" />} title={`Nothing downloaded matches “${q}”`} />}
      </div>
    );
  else if (filter === 'originals') body = <div className="space-y-10">{originals}</div>;
  else {
    const nothing = !anyLoading && !anyError && remoteTotal === 0 && (filter !== 'all' || local.total === 0);
    body = nothing ? (
      <EmptyState
        icon={<SearchX className="h-7 w-7" />}
        title={`No results for “${q}”`}
        action={
          <button onClick={() => setParams({})} className="inline-flex items-center gap-2 rounded-full bg-fg/10 px-4 py-2 text-sm font-semibold hover:bg-fg/15">
            <X className="h-4 w-4" /> Clear search
          </button>
        }
      >
        Check the spelling, try fewer words, or search for a lyric line you remember.
      </EmptyState>
    ) : (
      <div className="space-y-10">
        {wants('songs') && sources.audius && (
          <div className={cn('grid gap-6', filter === 'all' && 'lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]')}>
            {filter === 'all' && (songList[0] || songs.loading) && (
              <section aria-labelledby="top-result">
                <h2 id="top-result" className="mb-3 text-xl font-extrabold">
                  Top result
                </h2>
                {songList[0] ? <RemoteTopTrack track={songList[0]} list={songList} context={searchCtx} /> : <Skeleton className="h-60 rounded-2xl" />}
              </section>
            )}
            <section aria-labelledby="songs-result" className="min-w-0">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="songs-result" className="text-xl font-extrabold">
                  Songs
                </h2>
                {filter === 'all' && songList.length > 6 && (
                  <button onClick={() => setParam('type', 'songs')} className="text-sm font-semibold text-muted hover:text-fg">
                    Show all
                  </button>
                )}
              </div>
              {songs.loading && !songList.length ? (
                <SongsSkeleton />
              ) : songs.error ? (
                <RemoteNotice error={songs.error} onRetry={songs.retry} compact />
              ) : songList.length ? (
                <TrackList tracks={filter === 'all' ? songList.slice(0, 6) : songList} context={searchCtx} header={filter !== 'all'} showAlbum={filter !== 'all'} />
              ) : (
                <p className="text-sm text-muted">No songs found.</p>
              )}
            </section>
          </div>
        )}

        {wants('artists') && sources.audius && (
          <RemoteShelf title="Artists" result={artists} render={(items) => items.map((a) => <RemoteArtistCard key={a.id} artist={a} />)} />
        )}
        {wants('albums') && sources.audius && (
          <RemoteShelf title="Albums & Playlists" result={albums} render={(items) => items.map((c) => <CollectionCard key={c.id} collection={c} />)} />
        )}
        {wants('archive') && sources.archive && (
          <section className="space-y-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-muted">
              <input type="checkbox" checked={losslessOnly} onChange={(e) => setParam('lossless', e.target.checked ? '1' : null)} className="h-4 w-4 accent-primary" />
              Lossless recordings only (FLAC)
            </label>
            <RemoteShelf
              title="Live & Archive Recordings"
              subtitle="Concerts, 78s and netlabel releases from the Internet Archive"
              result={archive}
              render={(items) => items.map((c) => <CollectionCard key={c.id} collection={c} />)}
            />
            {!archive.loading && !archive.error && archive.data?.length === 0 && <p className="text-sm text-muted">No recordings found{losslessOnly ? ' in lossless' : ''}.</p>}
          </section>
        )}
        {filter === 'all' && originals}
        <p className="sr-only" role="status">
          {anyLoading ? 'Searching…' : `${remoteTotal + local.total} results for ${q}`}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 md:hidden">
        <SearchInput autoFocus={!query} />
      </div>
      {query.trim() && !offline && filters}
      {body}
    </div>
  );
}
