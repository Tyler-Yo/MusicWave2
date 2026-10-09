import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Mic2, Play, Sparkles } from 'lucide-react';
import { ArtistCard } from '@/components/cards/ArtistCard';
import { MediaCard } from '@/components/cards/MediaCard';
import { Shelf } from '@/components/cards/Shelf';
import { CoverImage } from '@/components/common/CoverImage';
import { Equalizer } from '@/components/common/PlayIcon';
import { ShelfSkeleton, Skeleton } from '@/components/common/Skeleton';
import { useGreeting } from '@/hooks/useGreeting';
import { useLibrary, usePlayer, useSettings } from '@/hooks/usePlayer';
import { ALBUMS, ARTISTS, PLAYLISTS, PLAYLIST_MAP } from '@/data/catalog';
import { albumCover, artistNameOf, getAlbum, getArtist, getTrack, playlistCover, trackCover } from '@/services/catalog';
import { madeForYou, newReleases, topCharts } from '@/services/recommendations';
import { libraryStore } from '@/state/libraryStore';
import { player } from '@/state/playerStore';
import { settingsActions } from '@/state/settingsStore';
import { ui } from '@/state/uiStore';
import { playCollection } from '@/components/collection/playCollection';
import type { PlayContext } from '@/types/music';
import { formatTime } from '@/utils/format';

/** Simulates fetching personalized recommendations once per session (shows skeletons). */
let warmed = false;
function useWarmup(ms = 450): boolean {
  const [ready, setReady] = useState(warmed);
  useEffect(() => {
    if (warmed) return;
    const id = setTimeout(() => {
      warmed = true;
      setReady(true);
    }, ms);
    return () => clearTimeout(id);
  }, [ms]);
  return ready;
}

function useCtxPlaying(type: PlayContext['type'], id: string) {
  return usePlayer((s) => s.isPlaying && s.context?.type === type && s.context?.id === id);
}


function AlbumCardItem({ albumId }: { albumId: string }) {
  const album = getAlbum(albumId)!;
  const ctx: PlayContext = { type: 'album', id: album.id, name: album.title, href: `/album/${album.id}` };
  const playing = useCtxPlaying('album', album.id);
  return (
    <MediaCard
      href={`/album/${album.id}`}
      cover={albumCover(album)}
      title={album.title}
      subtitle={`${album.type === 'single' ? 'Single' : album.type === 'ep' ? 'EP' : 'Album'} · ${getArtist(album.artistId)?.name}`}
      playing={playing}
      onPlay={() => playCollection(album.trackIds, ctx)}
    />
  );
}

function PlaylistCardItem({ playlistId }: { playlistId: string }) {
  const p = PLAYLIST_MAP.get(playlistId)!;
  const ctx: PlayContext = { type: 'playlist', id: p.id, name: p.title, href: `/playlist/${p.id}` };
  const playing = useCtxPlaying('playlist', p.id);
  return <MediaCard href={`/playlist/${p.id}`} cover={playlistCover(p)} title={p.title} subtitle={p.description} playing={playing} onPlay={() => playCollection(p.trackIds, ctx)} />;
}

function LyricsSpotlight() {
  const lab = PLAYLIST_MAP.get('lyrics-lab')!;
  const start = (karaoke: boolean) => {
    if (karaoke) settingsActions.set('karaoke', true);
    player.playTracks(lab.trackIds, 0, { type: 'playlist', id: lab.id, name: lab.title, href: `/playlist/${lab.id}` });
    ui.openNowPlaying('lyrics');
  };
  return (
    <section
      aria-labelledby="spotlight-title"
      className="relative overflow-hidden rounded-[1.75rem] border border-line/40 p-6 sm:p-8"
      style={{ background: 'linear-gradient(120deg, #120a2e 0%, #1d1150 40%, #0b3b46 100%)' }}
    >
      <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-primary/30 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-accent/30 blur-3xl" aria-hidden="true" />
      <div className="relative grid items-center gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="text-white">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em]">
            <Mic2 className="h-3.5 w-3.5" /> Flagship feature
          </p>
          <h2 id="spotlight-title" className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
            Every word, <span className="text-primary">right on time.</span>
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/75 sm:text-base">
            Word-by-word synchronized lyrics with karaoke mode, click-to-seek, sync offset and a Lyrics Studio to time your own songs. Five demo songs — a slow ballad, a fast rap, a chorus-heavy pop hit, a synthwave epic with a long solo and a folk song.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => start(false)} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-black transition hover:scale-[1.03]">
              <Play className="h-4 w-4" fill="currentColor" /> Play Lyrics Lab
            </button>
            <button onClick={() => start(true)} className="inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-bold text-white transition hover:bg-white/20">
              <Sparkles className="h-4 w-4" /> Karaoke mode
            </button>
          </div>
        </div>
        <div className="relative hidden h-56 md:block" aria-hidden="true">
          <div className="absolute inset-0 flex flex-col justify-center gap-3 pl-6 font-extrabold">
            <p className="text-lg text-white/30">and set them drifting on the tide</p>
            <p className="text-3xl text-white">
              <span className="text-primary">Paper lanterns,</span> carry me home
            </p>
            <p className="text-lg text-white/55">over the water, under the stars</p>
            <p className="text-base text-white/30">if I get lost in the long and the low</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickTile({ to, cover, title, onPlay, playing, icon }: { to: string; cover?: string; title: string; onPlay?: () => void; playing?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="group relative flex h-16 items-center overflow-hidden rounded-xl bg-fg/[0.06] transition hover:bg-fg/[0.1]">
      <Link to={to} className="flex h-full min-w-0 flex-1 items-center gap-3 rounded-xl pr-12">
        {cover ? (
          <CoverImage src={cover} alt="" rounded="rounded-none" className="h-16 w-16 shrink-0" />
        ) : (
          <span className="grid h-16 w-16 shrink-0 place-items-center bg-gradient-to-br from-ember to-accent text-white">{icon}</span>
        )}
        <span className="truncate text-sm font-bold">{title}</span>
      </Link>
      {playing ? (
        <span className="absolute right-4">
          <Equalizer />
        </span>
      ) : (
        onPlay && (
          <button
            aria-label={`Play ${title}`}
            onClick={onPlay}
            className="absolute right-3 grid h-9 w-9 place-items-center rounded-full bg-primary text-on-primary opacity-0 shadow-glow transition focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Play className="h-4 w-4" fill="currentColor" />
          </button>
        )
      )}
    </div>
  );
}

export function HomePage() {
  const greeting = useGreeting();
  const name = useSettings((s) => s.userName);
  const ready = useWarmup();
  const history = useLibrary((s) => s.history);
  const likedCount = useLibrary((s) => Object.keys(s.likedTracks).length);
  const playCounts = useLibrary((s) => s.playCounts);
  const currentCtx = usePlayer((s) => (s.isPlaying ? `${s.context?.type}:${s.context?.id}` : ''));

  const mixes = useMemo(() => madeForYou(libraryStore.get()), [playCounts, likedCount]); // eslint-disable-line react-hooks/exhaustive-deps
  const charts = useMemo(() => topCharts(libraryStore.get()).slice(0, 8), [playCounts]); // eslint-disable-line react-hooks/exhaustive-deps
  const releases = useMemo(() => newReleases().slice(0, 10), []);

  const recentAlbums = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const h of history) {
      const t = getTrack(h.trackId);
      if (!t || !getAlbum(t.albumId) || seen.has(t.albumId)) continue;
      seen.add(t.albumId);
      out.push(t.albumId);
      if (out.length >= 10) break;
    }
    return out;
  }, [history]);

  const quick = [
    ...mixes.slice(0, 3).map((m) => ({ to: `/mix/${m.id}`, cover: m.cover, title: m.title, ids: m.trackIds, ctx: { type: 'mix' as const, id: m.id, name: m.title, href: `/mix/${m.id}` } })),
    ...PLAYLISTS.slice(0, 2).map((p) => ({ to: `/playlist/${p.id}`, cover: playlistCover(p), title: p.title, ids: p.trackIds, ctx: { type: 'playlist' as const, id: p.id, name: p.title, href: `/playlist/${p.id}` } })),
  ];

  return (
    <div className="space-y-10">
      <section aria-labelledby="greeting">
        <h1 id="greeting" className="text-3xl font-black tracking-tight sm:text-4xl">
          {greeting}
          {name ? `, ${name}` : ''}
        </h1>
        <p className="mt-1 text-muted">Fresh picks, synced lyrics and everything you love — all in one wave.</p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {!ready
            ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
            : [
                <QuickTile key="liked" to="/library?tab=songs" title={`Liked Songs${likedCount ? ` · ${likedCount}` : ''}`} icon={<Heart className="h-6 w-6" fill="currentColor" />} />,
                ...quick.map((q) => (
                  <QuickTile
                    key={q.to}
                    to={q.to}
                    cover={q.cover}
                    title={q.title}
                    playing={currentCtx === `${q.ctx.type}:${q.ctx.id}`}
                    onPlay={() => player.playTracks(q.ids, 0, q.ctx)}
                  />
                )),
              ]}
        </div>
      </section>

      <LyricsSpotlight />

      {!ready ? (
        <>
          <ShelfSkeleton />
          <ShelfSkeleton />
        </>
      ) : (
        <>
          <Shelf title="Made for You" subtitle="Personal mixes that learn from what you play and like">
            {mixes.map((m) => (
              <MixCard key={m.id} mix={m} />
            ))}
          </Shelf>

          {recentAlbums.length > 0 && (
            <Shelf title="Recently Played" seeAllHref="/library?tab=recent">
              {recentAlbums.map((id) => (
                <AlbumCardItem key={id} albumId={id} />
              ))}
            </Shelf>
          )}

          <Shelf title="New Releases" subtitle="The latest from MusicWave artists" seeAllHref="/new-releases">
            {releases.map((a) => (
              <AlbumCardItem key={a.id} albumId={a.id} />
            ))}
          </Shelf>

          <section aria-labelledby="charts-title">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 id="charts-title" className="text-xl font-extrabold tracking-tight sm:text-2xl">
                  Top Charts
                </h2>
                <p className="mt-0.5 text-sm text-muted">The most-played songs on MusicWave this week</p>
              </div>
              <Link to="/charts" className="rounded-full px-3 py-1.5 text-sm font-semibold text-muted hover:bg-fg/5 hover:text-fg">
                See all
              </Link>
            </div>
            <ol className="grid gap-x-6 gap-y-1 md:grid-cols-2">
              {charts.map((t, i) => (
                <li key={t.id}>
                  <button
                    onClick={() => player.playTracks(charts.map((c) => c.id), i, { type: 'chart', id: 'top', name: 'Top Charts', href: '/charts' })}
                    className="group flex w-full items-center gap-4 rounded-xl px-2 py-2 text-left hover:bg-fg/[0.05]"
                  >
                    <span className="w-6 text-center text-lg font-black tabular-nums text-subtle group-hover:text-primary">{i + 1}</span>
                    <CoverImage src={trackCover(t)} alt="" rounded="rounded-md" className="h-12 w-12 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{t.title}</span>
                      <span className="block truncate text-sm text-muted">{artistNameOf(t)}</span>
                    </span>
                    <span className="text-sm tabular-nums text-subtle">{formatTime(t.duration)}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <Shelf title="Synthwave & Electronic" subtitle="Neon nights and four-on-the-floor">
            {ALBUMS.filter((a) => ['synthwave', 'electronic', 'chiptune'].includes(a.genreId)).map((a) => (
              <AlbumCardItem key={a.id} albumId={a.id} />
            ))}
          </Shelf>

          <Shelf title="Chill & Focus" subtitle="Lo-fi, ambient and gentle piano">
            {ALBUMS.filter((a) => ['lofi', 'ambient', 'jazz', 'piano', 'cinematic'].includes(a.genreId)).map((a) => (
              <AlbumCardItem key={a.id} albumId={a.id} />
            ))}
          </Shelf>

          <Shelf title="Featured Playlists" subtitle="Hand-picked by the MusicWave team">
            {PLAYLISTS.map((p) => (
              <PlaylistCardItem key={p.id} playlistId={p.id} />
            ))}
          </Shelf>

          <Shelf title="Artists to Explore">
            {ARTISTS.map((a) => (
              <ArtistCard key={a.id} artist={a} />
            ))}
          </Shelf>
        </>
      )}
    </div>
  );
}

function MixCard({ mix }: { mix: ReturnType<typeof madeForYou>[number] }) {
  const ctx: PlayContext = { type: 'mix', id: mix.id, name: mix.title, href: `/mix/${mix.id}` };
  const playing = useCtxPlaying('mix', mix.id);
  return <MediaCard href={`/mix/${mix.id}`} cover={mix.cover} title={mix.title} subtitle={mix.description} size="lg" playing={playing} onPlay={() => playCollection(mix.trackIds, ctx)} />;
}

export default HomePage;
