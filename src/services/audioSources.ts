/**
 * Resolves a Track to a playable URL.
 *
 *   url     → used as-is (your own MP3s in /public/audio, or any URL)
 *   upload  → blob from IndexedDB → object URL
 *   synth   → memory cache → IndexedDB cache/download → render in a Web Worker
 *   remote  → downloaded copy in IndexedDB → best online rendition for the chosen quality
 *
 * Rendered audio is kept in a small in-memory LRU of object URLs (the current
 * track is pinned so it is never revoked while playing) and, optionally, in
 * IndexedDB so replays and offline listening are instant.
 */
import { renderCompositionAudio } from '@/audio/synth/client';
import { analyzePcm, type AudioAnalysis } from '@/audio/synth/engine';
import { COMPOSITIONS } from '@/data/compositions';
import { createStore } from '@/state/createStore';
import { libraryActions, libraryStore } from '@/state/libraryStore';
import { isOffline } from '@/state/networkStore';
import { settingsStore } from '@/state/settingsStore';
import type { AudioVariant, QualityTier, Track } from '@/types/music';
import { offlineStore } from './offlineStore';
import { playbackQualityStore, selectVariant } from './remoteAudio';

/** Bump when the synth engine output changes so stale cached renders are ignored. */
export const ENGINE_VERSION = 3;
const MEMORY_LIMIT = 4;
const DISK_CACHE_LIMIT = 6;

export class OfflineUnavailableError extends Error {
  constructor() {
    super('This track is not downloaded. Turn off offline mode or download it first.');
    this.name = 'OfflineUnavailableError';
  }
}

export interface ResolvedAudio {
  url: string;
  origin: 'memory' | 'disk' | 'render' | 'network' | 'upload';
  /** For online tracks: the rendition being played. */
  variant?: AudioVariant;
}

interface MemoryEntry {
  url: string;
  blob?: Blob;
  variant?: AudioVariant;
  lastUsed: number;
}

const memory = new Map<string, MemoryEntry>();
let pinnedId: string | null = null;

/** Waveform/energy analysis per track id — reactive so the UI can update when it arrives. */
export const analysisStore = createStore<{ byTrack: Record<string, AudioAnalysis> }>({ byTrack: {} });

/** Render progress per track id (0..1) for loading indicators. */
export const renderProgressStore = createStore<{ byTrack: Record<string, number> }>({ byTrack: {} });

function setAnalysis(trackId: string, analysis: AudioAnalysis | undefined) {
  if (!analysis) return;
  analysisStore.set((s) => ({ byTrack: { ...s.byTrack, [trackId]: analysis } }));
}

function setProgress(trackId: string, p: number | null) {
  renderProgressStore.set((s) => {
    const byTrack = { ...s.byTrack };
    if (p === null) delete byTrack[trackId];
    else byTrack[trackId] = p;
    return { byTrack };
  });
}

function remember(trackId: string, url: string, blob?: Blob, variant?: AudioVariant) {
  memory.set(trackId, { url, blob, variant, lastUsed: Date.now() });
  const entries = [...memory.entries()].sort((a, b) => b[1].lastUsed - a[1].lastUsed);
  for (const [id, entry] of entries.slice(MEMORY_LIMIT)) {
    if (id === pinnedId) continue;
    if (entry.url.startsWith('blob:')) URL.revokeObjectURL(entry.url);
    memory.delete(id);
  }
}

const diskKey = (compositionId: string) => `synth:${compositionId}:v${ENGINE_VERSION}`;
/** IndexedDB key of a downloaded online track. */
export const downloadKey = (trackId: string) => `dl:${trackId}`;

/** Drops a track's in-memory audio (after its download was removed). */
export function forgetTrackAudio(trackId: string): void {
  const entry = memory.get(trackId);
  if (!entry || trackId === pinnedId) return;
  if (entry.url.startsWith('blob:')) URL.revokeObjectURL(entry.url);
  memory.delete(trackId);
}

/** Marks the track currently loaded in the player so its URL is never revoked. */
export function pinTrack(trackId: string | null): void {
  pinnedId = trackId;
}

export function isPlayableOffline(track: Track): boolean {
  if (track.source.kind === 'upload') return true;
  if (track.source.kind === 'synth' || track.source.kind === 'remote') return Boolean(libraryStore.get().downloads[track.id]);
  return false;
}

async function renderSynth(track: Track, compositionId: string, priority: 'foreground' | 'background') {
  const composition = COMPOSITIONS[compositionId];
  if (!composition) throw new Error(`Unknown composition "${compositionId}".`);
  setProgress(track.id, 0);
  try {
    const result = await renderCompositionAudio(composition, {
      priority,
      onProgress: (p) => setProgress(track.id, p),
    });
    const blob = new Blob([result.wav], { type: 'audio/wav' });
    setAnalysis(track.id, result.analysis);
    if (settingsStore.get().cacheRenders) {
      void offlineStore
        .putAudio({
          key: diskKey(compositionId),
          blob,
          analysis: result.analysis,
          size: blob.size,
          savedAt: Date.now(),
          lastUsed: Date.now(),
          pinned: false,
        })
        .then(() => offlineStore.evictUnpinned(DISK_CACHE_LIMIT));
    }
    return blob;
  } finally {
    setProgress(track.id, null);
  }
}

async function decodeAnalysis(trackId: string, blob: Blob) {
  try {
    if (typeof OfflineAudioContext === 'undefined') return;
    const buf = await blob.arrayBuffer();
    const ctx = new OfflineAudioContext(1, 1, 44100);
    const decoded = await ctx.decodeAudioData(buf);
    const left = decoded.getChannelData(0);
    const right = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : left;
    setAnalysis(trackId, analyzePcm(left, right, decoded.sampleRate));
  } catch {
    /* waveform is optional */
  }
}

/** Quality to stream a track in: a per-track choice from Now Playing, else Settings. */
export function requestedQuality(trackId: string): QualityTier {
  const o = playbackQualityStore.get().override;
  return o && o.trackId === trackId ? o.tier : settingsStore.get().streamingQuality;
}

export async function resolveTrackAudio(
  track: Track,
  options: {
    priority?: 'foreground' | 'background';
    /** Online renditions that already failed to load. */
    exclude?: Set<string>;
    /** Stream this quality even if a downloaded copy exists (Now Playing quality menu). */
    preferStream?: boolean;
  } = {},
): Promise<ResolvedAudio> {
  const priority = options.priority ?? 'foreground';
  const offline = isOffline();
  const streamFirst = Boolean(options.preferStream && !offline);
  const cached = memory.get(track.id);
  if (cached && !streamFirst && !options.exclude?.size) {
    cached.lastUsed = Date.now();
    return { url: cached.url, origin: 'memory', variant: cached.variant };
  }

  switch (track.source.kind) {
    case 'url': {
      if (offline) throw new OfflineUnavailableError();
      return { url: track.source.url, origin: 'network' };
    }
    case 'upload': {
      const rec = await offlineStore.getUpload(track.source.blobKey);
      if (!rec) throw new Error('This uploaded file is no longer stored on this device.');
      const url = URL.createObjectURL(rec.blob);
      remember(track.id, url, rec.blob);
      if (!analysisStore.get().byTrack[track.id]) void decodeAnalysis(track.id, rec.blob);
      return { url, origin: 'upload' };
    }
    case 'synth': {
      const { compositionId } = track.source;
      const disk = await offlineStore.getAudio(diskKey(compositionId));
      if (disk) {
        const url = URL.createObjectURL(disk.blob);
        remember(track.id, url, disk.blob);
        setAnalysis(track.id, disk.analysis);
        void offlineStore.touchAudio(disk.key);
        return { url, origin: 'disk' };
      }
      if (offline) throw new OfflineUnavailableError();
      const blob = await renderSynth(track, compositionId, priority);
      const url = URL.createObjectURL(blob);
      remember(track.id, url, blob);
      return { url, origin: 'render' };
    }
    case 'remote': {
      if (!streamFirst) {
        const saved = await offlineStore.getAudio(downloadKey(track.id));
        if (saved) {
          const url = URL.createObjectURL(saved.blob);
          remember(track.id, url, saved.blob, saved.variant);
          void offlineStore.touchAudio(saved.key);
          return { url, origin: 'disk', variant: saved.variant };
        }
      }
      if (offline) throw new OfflineUnavailableError();
      const variant = await selectVariant(track, requestedQuality(track.id), { exclude: options.exclude });
      if (!variant) {
        throw new Error(options.exclude?.size ? 'None of the available versions of this track could be played.' : 'Your browser can’t play any version of this track.');
      }
      return { url: variant.url, origin: 'network', variant };
    }
  }
}

/** Renders/loads a track in the background so it starts instantly later. */
export function prefetchTrack(track: Track | undefined): void {
  if (!track || memory.has(track.id) || isOffline()) return;
  // For online tracks this warms the quality inspection; the stream itself starts on play.
  void resolveTrackAudio(track, { priority: 'background' }).catch(() => undefined);
}

/** "Download" a demo track: render if needed and store it permanently in IndexedDB. */
export async function downloadTrack(track: Track): Promise<void> {
  if (track.source.kind === 'upload') return;
  if (track.source.kind !== 'synth') throw new Error('Use the downloads service for online tracks.');
  const key = diskKey(track.source.compositionId);
  let rec = await offlineStore.getAudio(key);
  if (!rec) {
    const mem = memory.get(track.id);
    const blob = mem?.blob ?? (await renderSynth(track, track.source.compositionId, 'foreground'));
    rec = {
      key,
      blob,
      analysis: analysisStore.get().byTrack[track.id],
      size: blob.size,
      savedAt: Date.now(),
      lastUsed: Date.now(),
      pinned: true,
    };
  }
  await offlineStore.putAudio({ ...rec, pinned: true });
  const check = await offlineStore.getAudio(key);
  if (!check) throw new Error('Your browser did not allow saving this track (storage may be full or disabled).');
  libraryActions.setDownloaded(track.id, rec.size);
}

export async function removeDownloadedTrack(track: Track): Promise<void> {
  if (track.source.kind === 'synth') {
    const rec = await offlineStore.getAudio(diskKey(track.source.compositionId));
    if (rec) await offlineStore.putAudio({ ...rec, pinned: false, lastUsed: 0 });
    await offlineStore.evictUnpinned(DISK_CACHE_LIMIT);
  }
  if (track.source.kind === 'remote') {
    await offlineStore.deleteAudio(downloadKey(track.id));
    await offlineStore.deleteArtwork(track.id);
    forgetTrackAudio(track.id);
  }
  libraryActions.removeDownload(track.id);
}

/** Clears auto-cached renders (downloads are kept). */
export async function clearRenderCache(): Promise<void> {
  await offlineStore.evictUnpinned(0);
}
