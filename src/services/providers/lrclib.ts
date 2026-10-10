/**
 * LRCLIB (https://lrclib.net) — an open, community-maintained database of synced
 * (LRC) and plain lyrics. Lookups use the track title, artist and duration.
 *
 * Synced lyrics are only used when the LRCLIB recording has (almost) the same
 * length as ours — otherwise the timestamps would belong to a different
 * version (live take, radio edit…) and the lyrics are shown unsynced instead.
 */
import { fetchJSON, qs, SourceError } from './http';

export const LRCLIB_API = 'https://lrclib.net/api';
/** Max length difference (seconds) for which synced timestamps are trusted. */
export const SYNC_TOLERANCE = 2.5;

export interface LrclibRecord {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string | null;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export type RemoteLyricsResult =
  | { status: 'synced'; lrc: string; lrclibId: number; durationDelta: number }
  | { status: 'plain'; plain: string; lrclibId: number; reason: 'no-sync' | 'length-mismatch' }
  | { status: 'instrumental'; lrclibId: number }
  | { status: 'none' };

/** Removes decorations that never appear in lyric databases. */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s*[([](?:official|lyric|lyrics|audio|video|visualizer|free\s*(?:dl|download)|out now|hq|hd|explicit|clean|remaster(?:ed)?[^)\]]*)[^)\]]*[)\]]/gi, '')
    .replace(/\s*[([](?:prod\.?|produced by)[^)\]]*[)\]]/gi, '')
    .replace(/\s*[([](?:feat\.?|ft\.?|featuring)[^)\]]*[)\]]/gi, '')
    .replace(/\s+(?:feat\.?|ft\.?|featuring)\s+.*$/i, '')
    .replace(/\s+-\s+(?:\d{4}\s+)?remaster(?:ed)?.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanArtist(artist: string): string {
  return artist.split(/\s*(?:,|&|\bx\b|\bfeat\.?|\bft\.?|\band\b)\s*/i)[0].trim() || artist.trim();
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Strips [mm:ss.xx] stamps so synced text can be shown as plain lyrics. */
export function stripTimestamps(lrc: string): string {
  return lrc
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(\[[^\]]*\])+/, '').replace(/<\d+:\d+(?:\.\d+)?>/g, '').trim())
    .filter((l, i, arr) => l || (i > 0 && arr[i - 1]))
    .join('\n')
    .trim();
}

/** Turns an LRCLIB record into a result for a track of `duration` seconds (0 = unknown). */
export function evaluateRecord(r: LrclibRecord, duration: number): RemoteLyricsResult {
  if (r.instrumental) return { status: 'instrumental', lrclibId: r.id };
  const delta = duration > 0 ? Math.abs(r.duration - duration) : 0;
  if (r.syncedLyrics?.trim() && delta <= SYNC_TOLERANCE) {
    return { status: 'synced', lrc: r.syncedLyrics, lrclibId: r.id, durationDelta: delta };
  }
  const plain = r.plainLyrics?.trim() || (r.syncedLyrics ? stripTimestamps(r.syncedLyrics) : '');
  if (plain) return { status: 'plain', plain, lrclibId: r.id, reason: r.syncedLyrics ? 'length-mismatch' : 'no-sync' };
  return { status: 'none' };
}

/** Picks the best search candidate for a title/artist/duration, or null if none is a real match. */
export function pickCandidate(records: LrclibRecord[], title: string, artist: string, duration: number): LrclibRecord | null {
  const t = norm(cleanTitle(title));
  const a = norm(cleanArtist(artist));
  let best: { r: LrclibRecord; score: number } | null = null;
  for (const r of records) {
    const rt = norm(cleanTitle(r.trackName));
    const ra = norm(r.artistName);
    const titleScore = rt === t ? 3 : rt.includes(t) || t.includes(rt) ? 2 : 0;
    const artistScore = ra === a ? 3 : ra.includes(a) || a.includes(ra) ? 2 : 0;
    if (!titleScore || !artistScore) continue;
    const delta = duration > 0 ? Math.abs(r.duration - duration) : 0;
    let score = titleScore + artistScore - Math.min(3, delta / 10);
    if (r.syncedLyrics && delta <= SYNC_TOLERANCE) score += 2;
    if (r.instrumental) score -= 1;
    if (!best || score > best.score) best = { r, score };
  }
  return best?.r ?? null;
}

export async function findLyrics(
  info: { title: string; artist: string; album?: string; duration: number },
  signal?: AbortSignal,
): Promise<RemoteLyricsResult> {
  const title = cleanTitle(info.title);
  const artist = cleanArtist(info.artist);
  if (!title || !artist) return { status: 'none' };
  if (info.duration > 0) {
    try {
      const exact = await fetchJSON<LrclibRecord>(
        `${LRCLIB_API}/get?${qs({ track_name: title, artist_name: artist, album_name: info.album, duration: Math.round(info.duration) })}`,
        'LRCLIB',
        { signal },
      );
      const result = evaluateRecord(exact, info.duration);
      if (result.status !== 'none') return result;
    } catch (err) {
      if (!(err instanceof SourceError) || err.status !== 404) {
        if (!(err instanceof SourceError)) throw err;
        if (err.status === undefined) throw err; // network problem: let the caller retry later
      }
    }
  }
  const list = await fetchJSON<LrclibRecord[]>(`${LRCLIB_API}/search?${qs({ track_name: title, artist_name: artist })}`, 'LRCLIB', { signal });
  const pick = pickCandidate(Array.isArray(list) ? list : [], title, artist, info.duration);
  return pick ? evaluateRecord(pick, info.duration) : { status: 'none' };
}
