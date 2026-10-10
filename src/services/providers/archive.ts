/**
 * Internet Archive (https://archive.org) audio — public-domain recordings, netlabel
 * releases and the Live Music Archive (concerts by taper-friendly artists). Many
 * items carry genuine lossless masters: "Flac" (usually 16-bit) and "24bit Flac".
 *
 * Each item becomes a "recording" (album); its audio files are grouped by source
 * file into tracks, and every rendition (FLAC, 24-bit FLAC, MP3, Ogg…) becomes an
 * AudioVariant so the player can pick the requested quality.
 */
import type { AudioFormat, AudioVariant, QualityTier, RemoteCollection, Track } from '@/types/music';
import { bestTier } from '../quality';
import { fetchJSON, qs } from './http';

export const ARCHIVE = 'https://archive.org';

export interface ArchiveFileJSON {
  name: string;
  source?: 'original' | 'derivative' | 'metadata' | string;
  format?: string;
  original?: string;
  title?: string;
  track?: string;
  length?: string;
  size?: string;
  bitrate?: string;
  creator?: string;
  album?: string;
  /** "true" for files that are listed but not publicly downloadable (stream-only items). */
  private?: string;
}

export interface ArchiveMetadataJSON {
  metadata?: {
    identifier: string;
    title?: string | string[];
    creator?: string | string[];
    date?: string;
    year?: string;
    description?: string | string[];
    licenseurl?: string;
    rights?: string | string[];
    subject?: string | string[];
  };
  files?: ArchiveFileJSON[];
}

export interface ArchiveDocJSON {
  identifier: string;
  title?: string | string[];
  creator?: string | string[];
  date?: string;
  year?: string | number;
  downloads?: number;
  format?: string[];
}

interface FormatInfo {
  format: AudioFormat;
  tier: QualityTier;
  bitDepth?: number;
  maybeHiRes?: boolean;
  lossless?: boolean;
}

/** Archive.org format names → what they are. Unplayable formats (Shorten, MIDI…) are absent. */
const FORMATS: Record<string, FormatInfo> = {
  '24bit Flac': { format: 'flac', tier: 'lossless', bitDepth: 24, maybeHiRes: true, lossless: true },
  Flac: { format: 'flac', tier: 'lossless', lossless: true },
  WAVE: { format: 'wav', tier: 'lossless', lossless: true },
  AIFF: { format: 'aiff', tier: 'lossless', lossless: true },
  'Apple Lossless Audio': { format: 'alac', tier: 'lossless', lossless: true },
  'VBR MP3': { format: 'mp3', tier: 'high' },
  MP3: { format: 'mp3', tier: 'high' },
  '320Kbps MP3': { format: 'mp3', tier: 'high' },
  '256Kbps MP3': { format: 'mp3', tier: 'high' },
  '192Kbps MP3': { format: 'mp3', tier: 'high' },
  '128Kbps MP3': { format: 'mp3', tier: 'high' },
  '64Kbps MP3': { format: 'mp3', tier: 'high' },
  'Ogg Vorbis': { format: 'ogg', tier: 'high' },
};

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
const joined = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v.join(', ') : v);

export const archiveItemId = (identifier: string) => `ia-item:${identifier}`;
export const archiveCreatorId = (creator: string) => `ia-creator:${creator}`;
export const archiveCover = (identifier: string) => `${ARCHIVE}/services/img/${encodeURIComponent(identifier)}`;

export function archiveFileUrl(identifier: string, name: string): string {
  return `${ARCHIVE}/download/${encodeURIComponent(identifier)}/${name.split('/').map(encodeURIComponent).join('/')}`;
}

/** "245.6" | "04:05" | "1:02:03" → seconds. */
export function parseLength(len: string | undefined): number {
  if (!len) return 0;
  if (/^\d+(\.\d+)?$/.test(len.trim())) return parseFloat(len);
  const parts = len.split(':').map((p) => parseFloat(p));
  if (parts.some((p) => Number.isNaN(p))) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function prettify(name: string): string {
  const base = name.split('/').pop() ?? name;
  return base
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/^\d+[\s.-]+/, '')
    .trim();
}

function stripHtml(s: string | undefined): string | undefined {
  if (!s) return undefined;
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 1200);
}

function toVariant(identifier: string, f: ArchiveFileJSON): AudioVariant | null {
  const info = f.format ? FORMATS[f.format] : undefined;
  if (!info) return null;
  const bitrate = f.bitrate ? parseInt(f.bitrate, 10) : undefined;
  return {
    tier: info.tier,
    url: archiveFileUrl(identifier, f.name),
    format: info.format,
    bitrateKbps: !info.lossless && bitrate && bitrate > 0 ? bitrate : undefined,
    bitDepth: info.bitDepth,
    sizeBytes: f.size ? parseInt(f.size, 10) : undefined,
    maybeHiRes: info.maybeHiRes,
    needsInspection: info.lossless ? true : undefined,
  };
}

/** Turns an item's metadata into a recording plus its playable tracks (in track order). */
export function mapArchiveItem(meta: ArchiveMetadataJSON): { collection: RemoteCollection; tracks: Track[] } | null {
  const m = meta.metadata;
  if (!m?.identifier) return null;
  const id = m.identifier;
  const files = (meta.files ?? []).filter((f) => f.format && FORMATS[f.format] && f.private !== 'true');
  const byName = new Map(files.map((f) => [f.name, f]));

  // Group renditions by their source file.
  const groups = new Map<string, ArchiveFileJSON[]>();
  for (const f of files) {
    let root = f.name;
    if (f.source === 'derivative' && f.original && byName.has(f.original)) root = f.original;
    const key = root.replace(/\.[a-z0-9]+$/i, '');
    const list = groups.get(key) ?? [];
    list.push(f);
    groups.set(key, list);
  }

  const creator = joined(m.creator) ?? 'Unknown artist';
  const albumTitle = first(m.title) ?? id;
  const year = (m.year ?? m.date ?? '').slice(0, 4) || undefined;
  const license = m.licenseurl ?? joined(m.rights);

  const tracks: Track[] = [];
  for (const [key, group] of groups) {
    const variants = group.map((f) => toVariant(id, f)).filter((v): v is AudioVariant => v !== null);
    if (variants.length === 0) continue;
    const named = group.find((f) => f.title) ?? group[0];
    const duration = Math.max(0, ...group.map((f) => parseLength(f.length)));
    const trackNo = parseInt((group.find((f) => f.track)?.track ?? '').split('/')[0], 10);
    tracks.push({
      id: `ia:${id}:${key}`,
      title: named.title?.trim() || prettify(named.name),
      artistId: archiveCreatorId(group.find((f) => f.creator)?.creator ?? creator),
      artistName: group.find((f) => f.creator)?.creator ?? creator,
      albumId: archiveItemId(id),
      albumTitle,
      trackNumber: Number.isFinite(trackNo) ? trackNo : 0,
      duration,
      genreId: 'remote',
      genreName: first(m.subject),
      releaseDate: m.date?.slice(0, 10) ?? '',
      plays: 0,
      source: { kind: 'remote', provider: 'archive', variants },
      provider: 'archive',
      artworkUrl: archiveCover(id),
      pageUrl: `${ARCHIVE}/details/${encodeURIComponent(id)}`,
      license,
    });
  }
  tracks.sort((a, b) => (a.trackNumber || 999) - (b.trackNumber || 999) || a.id.localeCompare(b.id));

  const collection: RemoteCollection = {
    id: archiveItemId(id),
    provider: 'archive',
    kind: 'recording',
    title: albumTitle,
    artistName: creator,
    artistId: archiveCreatorId(creator),
    artworkUrl: archiveCover(id),
    description: stripHtml(joined(m.description)),
    year,
    trackCount: tracks.length,
    bestTier: bestTier(tracks.flatMap((t) => (t.source.kind === 'remote' ? t.source.variants : []))),
    has24Bit: files.some((f) => f.format === '24bit Flac'),
    pageUrl: `${ARCHIVE}/details/${encodeURIComponent(id)}`,
  };
  return { collection, tracks };
}

export function mapArchiveDoc(d: ArchiveDocJSON): RemoteCollection {
  const formats = d.format ?? [];
  const lossless = formats.some((f) => FORMATS[f]?.lossless);
  return {
    id: archiveItemId(d.identifier),
    provider: 'archive',
    kind: 'recording',
    title: first(d.title) ?? d.identifier,
    artistName: joined(d.creator) ?? 'Unknown artist',
    artistId: first(d.creator) ? archiveCreatorId(first(d.creator) as string) : undefined,
    artworkUrl: archiveCover(d.identifier),
    year: String(d.year ?? d.date ?? '').slice(0, 4) || undefined,
    bestTier: lossless ? 'lossless' : 'high',
    has24Bit: formats.includes('24bit Flac'),
    pageUrl: `${ARCHIVE}/details/${encodeURIComponent(d.identifier)}`,
  };
}

/** Removes Lucene syntax so free text can't break the query. */
export function sanitizeQuery(q: string): string {
  return q
    .replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, ' ')
    .replace(/\b(AND|OR|NOT)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Music-focused collections (live concerts, 78s, netlabels, community music). */
const MUSIC_SCOPE = 'mediatype:(audio) AND collection:(etree OR 78rpm OR netlabels OR audio_music OR opensource_audio)';

interface SearchResponse {
  response?: { numFound: number; docs: ArchiveDocJSON[] };
}

async function searchDocs(q: string, opts: { rows?: number; sort?: string; signal?: AbortSignal } = {}): Promise<RemoteCollection[]> {
  const params = new URLSearchParams(qs({ q, rows: opts.rows ?? 24, page: 1, output: 'json' }));
  for (const f of ['identifier', 'title', 'creator', 'date', 'year', 'downloads', 'format']) params.append('fl[]', f);
  params.append('sort[]', opts.sort ?? 'downloads desc');
  const body = await fetchJSON<SearchResponse>(`${ARCHIVE}/advancedsearch.php?${params}`, 'Internet Archive', { signal: opts.signal });
  return (body.response?.docs ?? []).map(mapArchiveDoc);
}

export const archive = {
  async search(query: string, opts: { rows?: number; losslessOnly?: boolean; signal?: AbortSignal } = {}): Promise<RemoteCollection[]> {
    const text = sanitizeQuery(query);
    if (!text) return [];
    const lossless = opts.losslessOnly ? ' AND format:(Flac OR "24bit Flac")' : '';
    return searchDocs(`(${text}) AND ${MUSIC_SCOPE}${lossless}`, { rows: opts.rows, signal: opts.signal });
  },
  /** Popular 24-bit FLAC concert recordings (candidates for Hi-Res). */
  async hiResConcerts(opts: { rows?: number; signal?: AbortSignal } = {}): Promise<RemoteCollection[]> {
    return searchDocs('collection:(etree) AND format:("24bit Flac")', { rows: opts.rows ?? 16, signal: opts.signal });
  },
  /** Popular lossless live recordings. */
  async losslessConcerts(opts: { rows?: number; signal?: AbortSignal } = {}): Promise<RemoteCollection[]> {
    return searchDocs('collection:(etree) AND format:(Flac)', { rows: opts.rows ?? 16, signal: opts.signal });
  },
  /** Public-domain 78 rpm records (Great 78 Project). */
  async classic78s(opts: { rows?: number; signal?: AbortSignal } = {}): Promise<RemoteCollection[]> {
    return searchDocs('collection:(78rpm) AND mediatype:(audio)', { rows: opts.rows ?? 16, signal: opts.signal });
  },
  /** Creative Commons netlabel releases. */
  async netlabels(opts: { rows?: number; signal?: AbortSignal } = {}): Promise<RemoteCollection[]> {
    return searchDocs('collection:(netlabels) AND mediatype:(audio)', { rows: opts.rows ?? 16, signal: opts.signal });
  },
  async byCreator(creator: string, opts: { rows?: number; signal?: AbortSignal } = {}): Promise<RemoteCollection[]> {
    const c = creator.replace(/"/g, '');
    return searchDocs(`creator:("${c}") AND mediatype:(audio)`, { rows: opts.rows ?? 30, signal: opts.signal });
  },
  async item(identifier: string, signal?: AbortSignal): Promise<{ collection: RemoteCollection; tracks: Track[] } | null> {
    const meta = await fetchJSON<ArchiveMetadataJSON>(`${ARCHIVE}/metadata/${encodeURIComponent(identifier)}`, 'Internet Archive', { signal });
    return mapArchiveItem(meta);
  },
};
