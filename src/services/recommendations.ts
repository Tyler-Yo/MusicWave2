/**
 * "Made for You": personalised mixes computed from listening history and likes.
 * Everything is deterministic for a given library state.
 */
import { ALBUMS, PALETTES, TRACKS } from '@/data/catalog';
import type { LibraryState } from '@/state/libraryStore';
import type { CoverStyle, Palette, Track } from '@/types/music';
import { coverDataUrl } from '@/utils/art';
import { createRng } from '@/utils/random';

export interface Mix {
  id: string;
  title: string;
  description: string;
  trackIds: string[];
  palette: Palette;
  style: CoverStyle;
  cover: string;
}

function genreAffinity(lib: LibraryState): Map<string, number> {
  const score = new Map<string, number>();
  const bump = (trackId: string, w: number) => {
    const t = TRACKS.find((x) => x.id === trackId);
    if (t) score.set(t.genreId, (score.get(t.genreId) ?? 0) + w);
  };
  Object.entries(lib.playCounts).forEach(([id, n]) => bump(id, n));
  Object.keys(lib.likedTracks).forEach((id) => bump(id, 3));
  return score;
}

function makeMix(id: string, title: string, description: string, tracks: Track[], palette: Palette, style: CoverStyle): Mix {
  return {
    id,
    title,
    description,
    trackIds: tracks.map((t) => t.id),
    palette,
    style,
    cover: coverDataUrl({ seed: id, palette, style, title, subtitle: 'Made for you' }),
  };
}

export function madeForYou(lib: LibraryState, day = new Date().toDateString()): Mix[] {
  const affinity = genreAffinity(lib);
  const rng = createRng(`mix:${day}:${Object.keys(lib.playCounts).length}`);
  const byAffinity = [...TRACKS].sort(
    (a, b) => (affinity.get(b.genreId) ?? 0) - (affinity.get(a.genreId) ?? 0) || b.plays - a.plays,
  );
  const fresh = [...TRACKS].filter((t) => !lib.playCounts[t.id]).sort(() => rng.next() - 0.5);
  const lyricSongs = TRACKS.filter((t) => t.lyricsId);
  const calm = TRACKS.filter((t) => ['ambient', 'lofi', 'piano', 'jazz', 'cinematic'].includes(t.genreId));
  const mostPlayed = [...TRACKS]
    .filter((t) => lib.playCounts[t.id])
    .sort((a, b) => (lib.playCounts[b.id] ?? 0) - (lib.playCounts[a.id] ?? 0));

  const mixes = [
    makeMix('daily-mix-1', 'Daily Mix 1', 'Your favourite sounds, refreshed every day.', byAffinity.slice(0, 6), PALETTES.coast, 'mesh'),
    makeMix('discovery', 'Discovery Wave', fresh.length ? 'Songs you have not heard yet.' : 'You have heard everything — here is a fresh shuffle.', (fresh.length ? fresh : byAffinity).slice(0, 6), PALETTES.aurora, 'waves'),
    makeMix('sing-along', 'Sing-Along Mix', 'Every track has synced lyrics. Try karaoke mode.', lyricSongs, PALETTES.golden, 'bloom'),
    makeMix('calm-focus', 'Calm Focus', 'Low-key instrumentals for deep work.', calm.slice(0, 6), PALETTES.moss, 'topo'),
  ];
  if (mostPlayed.length >= 3) {
    mixes.splice(1, 0, makeMix('on-repeat', 'On Repeat', 'The songs you cannot stop playing.', mostPlayed.slice(0, 8), PALETTES.kettle, 'rings'));
  }
  return mixes;
}

export function getMix(id: string, lib: LibraryState): Mix | undefined {
  return madeForYou(lib).find((m) => m.id === id);
}

export function topCharts(lib: LibraryState): Track[] {
  return [...TRACKS].sort((a, b) => b.plays + (lib.playCounts[b.id] ?? 0) * 1e6 - (a.plays + (lib.playCounts[a.id] ?? 0) * 1e6));
}

export function newReleases() {
  return [...ALBUMS].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
}
