import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Clock, Mic2, Play, SearchX, X } from 'lucide-react';
import { ArtistCard } from '@/components/cards/ArtistCard';
import { GenreTile } from '@/components/cards/GenreTile';
import { MediaCard } from '@/components/cards/MediaCard';
import { Shelf } from '@/components/cards/Shelf';
import { TrackList } from '@/components/cards/TrackList';
import { playCollection } from '@/components/collection/playCollection';
import { CoverImage } from '@/components/common/CoverImage';
import { EmptyState } from '@/components/common/EmptyState';
import { RowSkeleton, ShelfSkeleton, Skeleton } from '@/components/common/Skeleton';
import { SearchInput } from '@/components/layout/TopBar';
import { GENRES } from '@/data/catalog';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLibrary } from '@/hooks/usePlayer';
import { albumCover, artistImage, artistNameOf, getAlbum, getArtist, getPlaylist, getTrack, playlistCover, trackCover, tracksByArtist } from '@/services/catalog';
import { search, type LyricHit } from '@/services/search';
import { libraryActions } from '@/state/libraryStore';
import { player } from '@/state/playerStore';
import { ui } from '@/state/uiStore';
import { formatTime } from '@/utils/format';

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
      <section aria-labelledby="browse-all">
        <h2 id="browse-all" className="mb-4 text-2xl font-black tracking-tight">
          Browse all
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
        <p className="mt-1 text-sm text-muted">Type a line you remember — results jump straight to that moment in the song.</p>
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

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const debounced = useDebouncedValue(query, 250);
  const pending = query.trim() !== debounced.trim();
  const results = useMemo(() => search(debounced), [debounced]);

  useEffect(() => {
    if (!debounced.trim() || results.total === 0) return;
    const id = setTimeout(() => libraryActions.rememberSearch(debounced), 1500);
    return () => clearTimeout(id);
  }, [debounced, results.total]);

  return (
    <div>
      <div className="mb-6 md:hidden">
        <SearchInput autoFocus={!query} />
      </div>
      {!query.trim() ? (
        <BrowseHome />
      ) : pending ? (
        <div className="space-y-8" aria-busy="true" aria-label="Searching">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <Skeleton className="h-60 rounded-2xl" />
            <div>
              {Array.from({ length: 4 }, (_, i) => (
                <RowSkeleton key={i} />
              ))}
            </div>
          </div>
          <ShelfSkeleton />
        </div>
      ) : results.total === 0 ? (
        <EmptyState
          icon={<SearchX className="h-7 w-7" />}
          title={`No results for “${query}”`}
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
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            {results.top && (
              <section aria-labelledby="top-result">
                <h2 id="top-result" className="mb-3 text-xl font-extrabold">
                  Top result
                </h2>
                <TopResult kind={results.top.kind} id={results.top.id} />
              </section>
            )}
            {results.tracks.length > 0 && (
              <section aria-labelledby="songs-result" className="min-w-0">
                <h2 id="songs-result" className="mb-3 text-xl font-extrabold">
                  Songs
                </h2>
                <TrackList tracks={results.tracks.slice(0, 5)} context={{ type: 'search', id: debounced, name: `Search: ${debounced}`, href: `/search?q=${encodeURIComponent(debounced)}` }} header={false} showAlbum={false} />
              </section>
            )}
          </div>

          {results.lyrics.length > 0 && (
            <section aria-labelledby="lyrics-result">
              <h2 id="lyrics-result" className="mb-1 flex items-center gap-2 text-xl font-extrabold">
                <Mic2 className="h-5 w-5 text-primary" /> In lyrics
              </h2>
              <p className="mb-3 text-sm text-muted">Click a line to play the song from that moment.</p>
              <ul className="grid gap-x-6 md:grid-cols-2">
                {results.lyrics.map((hit) => (
                  <LyricResult key={`${hit.track.id}-${hit.lineIndex}`} hit={hit} query={debounced} />
                ))}
              </ul>
            </section>
          )}

          {results.artists.length > 0 && (
            <Shelf title="Artists">
              {results.artists.map((a) => (
                <ArtistCard key={a.id} artist={a} />
              ))}
            </Shelf>
          )}
          {results.albums.length > 0 && (
            <Shelf title="Albums">
              {results.albums.map((a) => (
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
          {results.playlists.length > 0 && (
            <Shelf title="Playlists">
              {results.playlists.map((p) => (
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
          <p className="sr-only" role="status">
            {results.total} results for {query}
          </p>
          {results.genres.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-extrabold">Genres</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {results.genres.map((g) => (
                  <GenreTile key={g.id} genre={g} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
