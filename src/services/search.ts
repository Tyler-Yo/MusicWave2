/**
 * In-memory search across songs, artists, albums, playlists and lyrics.
 *
 * Scoring favours exact and prefix matches, tolerates one typo per word (≥ 4 letters)
 * and ignores accents and punctuation. Lyric hits return the matching line and its
 * timestamp so results can jump straight to that moment in the song.
 */
import { ALBUMS, ARTISTS, GENRES, PLAYLISTS } from '@/data/catalog';
import { libraryStore } from '@/state/libraryStore';
import type { Album, Artist, Genre, Playlist, Track } from '@/types/music';
import { albumTitleOf, allTracks, artistNameOf, userPlaylistToPlaylist } from './catalog';
import { lyricsSourceFor, parseCached } from './lyrics';

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** One insertion, deletion, substitution or adjacent transposition apart. */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const i = [...a].findIndex((c, k) => c !== b[k]);
    if (i >= 0 && i + 1 < a.length && a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)) return true;
  }
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Score how well `query` matches `text` (0 = no match). */
export function scoreText(query: string, text: string): number {
  const q = normalize(query);
  const t = normalize(text);
  if (!q || !t) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(` ${q}`)) return 65;
  if (t.includes(q)) return 50;
  const qWords = q.split(' ');
  const tWords = t.split(' ');
  let matched = 0;
  for (const qw of qWords) {
    const hit = tWords.some(
      (tw) => tw.startsWith(qw) || (qw.length >= 4 && (withinOneEdit(qw, tw) || withinOneEdit(qw, tw.slice(0, qw.length)))),
    );
    if (hit) matched++;
  }
  if (matched === qWords.length) return 30 + matched * 2;
  return 0;
}

export interface LyricHit {
  track: Track;
  lineIndex: number;
  text: string;
  time: number;
  score: number;
}

export interface SearchResults {
  query: string;
  top: { kind: 'track' | 'artist' | 'album' | 'playlist'; id: string } | null;
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
  playlists: Playlist[];
  genres: Genre[];
  lyrics: LyricHit[];
  total: number;
}

function rank<T>(items: T[], score: (item: T) => number, limit: number): Array<{ item: T; score: number }> {
  return items
    .map((item) => ({ item, score: score(item) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function searchLyrics(query: string, limit = 12): LyricHit[] {
  const q = normalize(query);
  if (q.length < 3) return [];
  const hits: LyricHit[] = [];
  for (const track of allTracks()) {
    const src = lyricsSourceFor(track);
    if (!src) continue;
    const parsed = parseCached(src.lrc);
    const seen = new Set<string>();
    parsed.lines.forEach((line, i) => {
      const n = normalize(line.text);
      if (!n.includes(q) || seen.has(n)) return;
      seen.add(n);
      hits.push({ track, lineIndex: i, text: line.text, time: line.start, score: n === q ? 100 : n.startsWith(q) ? 80 : 60 });
    });
  }
  return hits.sort((a, b) => b.score - a.score || b.track.plays - a.track.plays).slice(0, limit);
}

export function search(query: string): SearchResults {
  const q = query.trim();
  const empty: SearchResults = { query: q, top: null, tracks: [], artists: [], albums: [], playlists: [], genres: [], lyrics: [], total: 0 };
  if (!q) return empty;

  const lyrics = searchLyrics(q);
  const lyricTrackIds = new Set(lyrics.map((h) => h.track.id));
  const tracks = rank(
    allTracks(),
    (t) => {
      const base = Math.max(
        scoreText(q, t.title) * 1.1,
        scoreText(q, artistNameOf(t)) * 0.8,
        scoreText(q, albumTitleOf(t)) * 0.6,
        scoreText(q, (t.moods ?? []).join(' ')) * 0.4,
        lyricTrackIds.has(t.id) ? 28 : 0,
      );
      // Popularity only breaks ties between real matches.
      return base > 0 ? base + Math.log10(t.plays + 10) : 0;
    },
    20,
  );
  const artists = rank(ARTISTS, (a) => scoreText(q, a.name) * 1.05, 8);
  const albums = rank(ALBUMS, (a) => Math.max(scoreText(q, a.title), scoreText(q, ARTISTS.find((x) => x.id === a.artistId)?.name ?? '') * 0.7), 8);
  const userPlaylists = libraryStore.get().playlists.map(userPlaylistToPlaylist);
  const playlists = rank([...PLAYLISTS, ...userPlaylists], (p) => Math.max(scoreText(q, p.title), scoreText(q, p.description) * 0.5), 8);
  const genres = rank(GENRES, (g) => scoreText(q, g.name), 4);

  const candidates = [
    tracks[0] && { kind: 'track' as const, id: tracks[0].item.id, score: tracks[0].score },
    artists[0] && { kind: 'artist' as const, id: artists[0].item.id, score: artists[0].score + 2 },
    albums[0] && { kind: 'album' as const, id: albums[0].item.id, score: albums[0].score },
    playlists[0] && { kind: 'playlist' as const, id: playlists[0].item.id, score: playlists[0].score },
  ].filter(Boolean) as Array<{ kind: 'track' | 'artist' | 'album' | 'playlist'; id: string; score: number }>;
  const topCandidate = candidates.sort((a, b) => b.score - a.score)[0];

  const result: SearchResults = {
    query: q,
    top: topCandidate ? { kind: topCandidate.kind, id: topCandidate.id } : null,
    tracks: tracks.map((x) => x.item),
    artists: artists.map((x) => x.item),
    albums: albums.map((x) => x.item),
    playlists: playlists.map((x) => x.item),
    genres: genres.map((x) => x.item),
    lyrics,
    total: 0,
  };
  result.total = result.tracks.length + result.artists.length + result.albums.length + result.playlists.length + result.lyrics.length;
  return result;
}
