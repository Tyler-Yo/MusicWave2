/**
 * Picks the rendition of an online track to stream or download for a requested
 * quality tier, and verifies lossless files by reading their header.
 *
 * Lossless candidates (FLAC / WAV / AIFF) are inspected once: the first 64 KB are
 * read and the real bit depth / sample rate decide between Lossless and Hi-Res
 * Lossless. Results are written back to the track in the remote catalog, so the
 * inspection is never repeated.
 */
import { createStore } from '@/state/createStore';
import { getRemoteTrack, updateRemoteTrack } from '@/state/remoteCatalog';
import type { AudioVariant, QualityTier, Track } from '@/types/music';
import { audiusInspectUrl, rawId } from './providers/audius';
import { fetchJSON } from './providers/http';
import { formatFromName, isLossless, parseAudioHeader, rankVariants, tierRank, withSpecs } from './quality';

const HEADER_BYTES = 64 * 1024;
const INSPECT_TIMEOUT = 9000;

/** What is playing right now, and at which quality (for the Now Playing badge). */
export interface PlaybackQuality {
  trackId: string | null;
  variant: AudioVariant | null;
  requested: QualityTier;
  /** "download" when playing a saved copy. */
  origin: 'stream' | 'download' | null;
  /** Per-track quality chosen from the Now Playing menu (overrides Settings). */
  override: { trackId: string; tier: QualityTier } | null;
}

export const playbackQualityStore = createStore<PlaybackQuality>({
  trackId: null,
  variant: null,
  requested: 'high',
  origin: null,
  override: null,
});

export function variantsOf(track: Track): AudioVariant[] {
  return track.source.kind === 'remote' ? track.source.variants : [];
}

/** Reads up to `limit` bytes from the start of a response body, then stops the download. */
async function readPrefix(res: Response, limit: number, controller: AbortController): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(await res.arrayBuffer()).subarray(0, limit);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < limit) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.length;
  }
  void reader.cancel().catch(() => undefined);
  controller.abort();
  const out = new Uint8Array(Math.min(size, limit));
  let at = 0;
  for (const c of chunks) {
    const part = c.subarray(0, Math.min(c.length, out.length - at));
    out.set(part, at);
    at += part.length;
    if (at >= out.length) break;
  }
  return out;
}

/** Fetches the beginning of a file (no Range header, to avoid a CORS preflight). */
export async function fetchHeader(url: string, signal?: AbortSignal): Promise<{ bytes: Uint8Array; contentType: string; size?: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INSPECT_TIMEOUT);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const length = Number(res.headers.get('content-length')) || undefined;
    const contentType = res.headers.get('content-type') ?? '';
    const bytes = await readPrefix(res, HEADER_BYTES, controller);
    return { bytes, contentType, size: length };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function replaceVariant(trackId: string, url: string, next: AudioVariant | null): void {
  updateRemoteTrack(trackId, (t) => {
    if (t.source.kind !== 'remote') return t;
    const variants = next ? t.source.variants.map((v) => (v.url === url ? next : v)) : t.source.variants.filter((v) => v.url !== url);
    return { ...t, source: { ...t.source, variants } };
  });
}

const inspecting = new Map<string, Promise<AudioVariant | null>>();

/**
 * Confirms a lossless candidate. Returns the updated variant, or null when the file
 * turned out not to be lossless (the variant is then removed from the track).
 * Network/CORS failures keep the variant as unverified Lossless — never Hi-Res.
 */
export function inspectVariant(track: Track, v: AudioVariant, signal?: AbortSignal): Promise<AudioVariant | null> {
  if (!v.needsInspection && v.verified) return Promise.resolve(v);
  if (!v.needsInspection && !isLossless(v.format)) return Promise.resolve(v);
  const key = `${track.id}|${v.url}`;
  const pending = inspecting.get(key);
  if (pending) return pending;
  const job = (async (): Promise<AudioVariant | null> => {
    let format = v.format;
    let sizeBytes = v.sizeBytes;
    if (track.provider === 'audius' && v.needsInspection) {
      // Audius tells us what the original upload really is before we touch the file.
      try {
        const info = await fetchJSON<{ data?: { size?: number; content_type?: string } }>(audiusInspectUrl(rawId(track.id)), 'Audius', {
          signal,
          timeoutMs: INSPECT_TIMEOUT,
        });
        const ct = info.data?.content_type ?? '';
        if (ct) {
          format = formatFromName('', ct) === 'unknown' ? format : formatFromName('', ct);
          if (!isLossless(format)) {
            replaceVariant(track.id, v.url, null);
            return null;
          }
        }
        sizeBytes = info.data?.size ?? sizeBytes;
      } catch {
        /* fall through to the header check */
      }
    }
    let result: AudioVariant;
    try {
      const head = await fetchHeader(v.url, signal);
      const specs = parseAudioHeader(head.bytes);
      if (specs) result = { ...withSpecs(v, specs), sizeBytes: sizeBytes ?? head.size };
      else {
        const sniffed = formatFromName('', head.contentType);
        if (sniffed !== 'unknown' && !isLossless(sniffed)) {
          replaceVariant(track.id, v.url, null);
          return null;
        }
        result = { ...v, format, sizeBytes: sizeBytes ?? head.size, needsInspection: false };
      }
    } catch {
      if (signal?.aborted) return v;
      // Could not read the file (CORS/network): keep it as plain Lossless, unverified.
      result = { ...v, format, sizeBytes, needsInspection: false };
    }
    replaceVariant(track.id, v.url, result);
    return result;
  })().finally(() => inspecting.delete(key));
  inspecting.set(key, job);
  return job;
}

/**
 * Chooses the rendition to use for `requested`, inspecting lossless candidates first
 * when a lossless tier was asked for. `exclude` holds URLs that already failed.
 */
export async function selectVariant(
  track: Track,
  requested: QualityTier,
  opts: { exclude?: Set<string>; signal?: AbortSignal } = {},
): Promise<AudioVariant | null> {
  const exclude = opts.exclude ?? new Set<string>();
  if (requested !== 'high') {
    const candidates = variantsOf(track).filter((v) => v.needsInspection && !exclude.has(v.url));
    await Promise.all(candidates.map((v) => inspectVariant(track, v, opts.signal)));
  }
  const latest = getRemoteTrack(track.id) ?? track;
  const ranked = rankVariants(variantsOf(latest), requested).filter((v) => !exclude.has(v.url));
  return ranked[0] ?? null;
}

/** Highest tier a track can be streamed in, as far as is known. */
export function availableTiers(track: Track): QualityTier[] {
  const tiers = new Set(variantsOf(track).map((v) => v.tier));
  return (['high', 'lossless', 'hires'] as QualityTier[]).filter((t) => tiers.has(t));
}

/** True if any variant could still turn out to be Hi-Res after inspection. */
export function mayBeHiRes(track: Track): boolean {
  return variantsOf(track).some((v) => v.maybeHiRes && !v.verified);
}

export const atOrBelow = (tier: QualityTier, max: QualityTier) => tierRank(tier) <= tierRank(max);
