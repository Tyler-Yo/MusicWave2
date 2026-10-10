/**
 * Downloads for offline listening.
 *
 * Online tracks are fetched in the quality chosen in Settings (falling back to the
 * next best rendition if one fails), stored in IndexedDB together with their
 * artwork and lyrics, and listed under Library → Downloads. Built-in MusicWave
 * tracks are rendered and stored the same way. Two downloads run at a time; the
 * rest wait in a queue.
 */
import { createStore } from '@/state/createStore';
import { libraryActions, libraryStore } from '@/state/libraryStore';
import { isOffline } from '@/state/networkStore';
import { notifyRemoteCatalog, updateRemoteTrack } from '@/state/remoteCatalog';
import { settingsStore } from '@/state/settingsStore';
import { ui } from '@/state/uiStore';
import type { AudioVariant, QualityTier, Track } from '@/types/music';
import { downloadKey, downloadTrack as downloadSynthTrack, removeDownloadedTrack } from './audioSources';
import { getTrack, setLocalArtwork } from './catalog';
import { offlineStore } from './offlineStore';
import { formatFromName, isLossless, parseAudioHeader, TIER_LABEL, variantDetail, withSpecs } from './quality';
import { selectVariant } from './remoteAudio';
import { ensureRemoteLyrics } from './remoteLyrics';

const MAX_PARALLEL = 2;
const MAX_ATTEMPTS = 4;

export interface DownloadJob {
  trackId: string;
  title: string;
  status: 'queued' | 'downloading' | 'saving' | 'error';
  received: number;
  total?: number;
  tier?: QualityTier;
  error?: string;
}

export const downloadsStore = createStore<{ jobs: Record<string, DownloadJob> }>({ jobs: {} });

const queue: string[] = [];
const controllers = new Map<string, AbortController>();
let active = 0;
let batch = { done: 0, failed: 0, size: 0 };

function patchJob(trackId: string, patch: Partial<DownloadJob> | null) {
  downloadsStore.set((s) => {
    const jobs = { ...s.jobs };
    if (patch === null) delete jobs[trackId];
    else if (jobs[trackId]) jobs[trackId] = { ...jobs[trackId], ...patch };
    return { jobs };
  });
}

export const isDownloadable = (t: Track) => t.source.kind === 'synth' || t.source.kind === 'remote';

/** Queues tracks for download. Returns how many were added. */
export function enqueueDownloads(tracks: Track[]): number {
  const lib = libraryStore.get();
  const jobs = { ...downloadsStore.get().jobs };
  let added = 0;
  for (const t of tracks) {
    if (!isDownloadable(t) || lib.downloads[t.id] || (jobs[t.id] && jobs[t.id].status !== 'error')) continue;
    jobs[t.id] = { trackId: t.id, title: t.title, status: 'queued', received: 0 };
    queue.push(t.id);
    added++;
  }
  if (!added) return 0;
  if (active === 0 && queue.length === added) batch = { done: 0, failed: 0, size: 0 };
  batch.size += added;
  downloadsStore.set({ jobs });
  pump();
  return added;
}

export function cancelDownload(trackId: string): void {
  const i = queue.indexOf(trackId);
  if (i >= 0) queue.splice(i, 1);
  controllers.get(trackId)?.abort();
  patchJob(trackId, null);
}

export function cancelAllDownloads(): void {
  for (const id of [...queue]) cancelDownload(id);
  for (const id of [...controllers.keys()]) cancelDownload(id);
}

export async function removeDownload(track: Track): Promise<void> {
  cancelDownload(track.id);
  await removeDownloadedTrack(track);
  setLocalArtwork(track.id, null);
  notifyRemoteCatalog();
}

function pump() {
  while (active < MAX_PARALLEL && queue.length) {
    const id = queue.shift()!;
    active++;
    void run(id).finally(() => {
      active--;
      pump();
      if (active === 0 && queue.length === 0) finishBatch();
    });
  }
}

function finishBatch() {
  const { done, failed, size } = batch;
  if (size > 1) {
    if (failed) ui.toast(`${done} of ${size} songs downloaded — ${failed} failed (see Downloads)`, done ? 'info' : 'error');
    else ui.toast(`${done} songs downloaded and available offline`, 'success');
  }
  batch = { done: 0, failed: 0, size: 0 };
}

async function run(trackId: string) {
  const track = getTrack(trackId);
  if (!track) return patchJob(trackId, null);
  const controller = new AbortController();
  controllers.set(trackId, controller);
  patchJob(trackId, { status: 'downloading', received: 0, total: undefined, error: undefined });
  try {
    if (track.source.kind === 'remote') await downloadRemote(track, controller.signal);
    else await downloadSynthTrack(track);
    patchJob(trackId, null);
    batch.done++;
    if (batch.size <= 1) {
      const info = libraryStore.get().downloads[trackId];
      ui.toast(`“${track.title}” downloaded${info?.tier ? ` in ${TIER_LABEL[info.tier]}` : ''}`, 'success');
    }
  } catch (err) {
    if (controller.signal.aborted) return patchJob(trackId, null);
    batch.failed++;
    const message = err instanceof Error ? err.message : 'Download failed';
    patchJob(trackId, { status: 'error', error: message });
    if (batch.size <= 1) ui.toast(`Couldn’t download “${track.title}”: ${message}`, 'error');
  } finally {
    controllers.delete(trackId);
  }
}

/** Fetches a file, reporting progress, and returns it as a Blob. */
async function fetchWithProgress(url: string, signal: AbortSignal, onProgress: (received: number, total?: number) => void): Promise<Blob> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`the server answered ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (/^(text\/|application\/json)/.test(type)) throw new Error('the server did not return an audio file');
  const total = Number(res.headers.get('content-length')) || undefined;
  const reader = res.body?.getReader();
  if (!reader) {
    const blob = await res.blob();
    onProgress(blob.size, blob.size);
    return blob;
  }
  const chunks: BlobPart[] = [];
  let received = 0;
  let lastReport = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    const now = performance.now();
    if (now - lastReport > 150) {
      lastReport = now;
      onProgress(received, total);
    }
  }
  onProgress(received, total ?? received);
  return new Blob(chunks, { type });
}

/** Looks at the saved bytes to describe the file exactly (and catch mislabelled ones). */
async function verifyBlob(blob: Blob, v: AudioVariant): Promise<AudioVariant> {
  const head = new Uint8Array(await blob.slice(0, 64 * 1024).arrayBuffer());
  const specs = parseAudioHeader(head);
  if (specs) return withSpecs(v, specs);
  const isMp3 = (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0);
  const sniffed = isMp3 ? 'mp3' : formatFromName('', blob.type);
  if (isLossless(v.format) && sniffed !== 'unknown' && !isLossless(sniffed)) {
    // The source handed us a lossy file instead of the lossless original.
    return { ...v, format: sniffed, tier: 'high', verified: false, maybeHiRes: false, needsInspection: false, bitDepth: undefined, sampleRate: undefined };
  }
  return { ...v, needsInspection: false };
}

async function downloadRemote(track: Track, signal: AbortSignal): Promise<void> {
  if (isOffline()) throw new Error('you are offline');
  const requested = settingsStore.get().downloadQuality;
  const exclude = new Set<string>();
  let blob: Blob | null = null;
  let variant: AudioVariant | null = null;
  let lastError = '';
  for (let attempt = 0; attempt < MAX_ATTEMPTS && !blob; attempt++) {
    variant = await selectVariant(track, requested, { exclude, signal });
    if (!variant) break;
    patchJob(track.id, { tier: variant.tier, received: 0, total: variant.sizeBytes });
    try {
      blob = await fetchWithProgress(variant.url, signal, (received, total) => patchJob(track.id, { received, total }));
    } catch (err) {
      if (signal.aborted) throw err;
      lastError = err instanceof Error && err.name !== 'TypeError' ? err.message : 'the source refused the download';
      exclude.add(variant.url);
    }
  }
  if (!blob || !variant) throw new Error(lastError || 'no downloadable version was found');

  patchJob(track.id, { status: 'saving' });
  const checked = await verifyBlob(blob, variant);
  if (checked !== variant) {
    updateRemoteTrack(track.id, (t) =>
      t.source.kind === 'remote' ? { ...t, source: { ...t.source, variants: t.source.variants.map((v) => (v.url === variant!.url ? { ...checked } : v)) } } : t,
    );
  }
  const now = Date.now();
  await offlineStore.putAudio({ key: downloadKey(track.id), blob, size: blob.size, savedAt: now, lastUsed: now, pinned: true, variant: checked });
  const stored = await offlineStore.getAudio(downloadKey(track.id));
  if (!stored) throw new Error('your browser did not allow saving it (storage may be full or disabled)');

  // Artwork and lyrics travel with the download so the song looks and reads the same offline.
  if (track.artworkUrl) {
    try {
      const res = await fetch(track.artworkUrl, { signal });
      if (res.ok) {
        const art = await res.blob();
        if (art.type.startsWith('image/')) {
          await offlineStore.putArtwork({ key: track.id, blob: art });
          setLocalArtwork(track.id, URL.createObjectURL(art));
        }
      }
    } catch {
      /* artwork is optional — a generated cover is used offline */
    }
  }
  await ensureRemoteLyrics(track).catch(() => undefined);
  libraryActions.setDownloaded(track.id, blob.size, { tier: checked.tier, detail: variantDetail(checked) });
  notifyRemoteCatalog();
}

/** Restores downloaded artwork as object URLs (call once at startup). */
export async function restoreLocalArtwork(): Promise<void> {
  const downloads = libraryStore.get().downloads;
  const records = await offlineStore.listArtwork();
  let any = false;
  for (const r of records) {
    if (!downloads[r.key]) continue;
    setLocalArtwork(r.key, URL.createObjectURL(r.blob));
    any = true;
  }
  if (any) notifyRemoteCatalog();
}

/** Downloads one track, or removes it if already downloaded. */
export async function toggleDownload(track: Track): Promise<void> {
  if (libraryStore.get().downloads[track.id]) {
    await removeDownload(track);
    ui.toast(`Removed “${track.title}” from downloads`);
    return;
  }
  if (downloadsStore.get().jobs[track.id]?.status === 'downloading') return;
  if (isOffline()) {
    ui.toast('You’re offline — connect to download music', 'error');
    return;
  }
  if (enqueueDownloads([track])) {
    const tier = track.source.kind === 'remote' ? ` (${TIER_LABEL[settingsStore.get().downloadQuality]} when available)` : '';
    ui.toast(`Downloading “${track.title}”${tier}…`);
  }
}

/** Downloads every track of a list (album, playlist…). */
export function downloadAll(tracks: Track[], label: string): void {
  if (isOffline()) {
    ui.toast('You’re offline — connect to download music', 'error');
    return;
  }
  const added = enqueueDownloads(tracks);
  if (added) ui.toast(`Downloading ${added} ${added === 1 ? 'song' : 'songs'} from ${label}…`);
  else ui.toast(`Everything in ${label} is already downloaded`);
}
