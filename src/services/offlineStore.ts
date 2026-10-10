/**
 * IndexedDB storage for large binary data:
 *  - `audio`:   rendered demo tracks (auto cache, LRU) and explicit downloads (pinned)
 *  - `uploads`: audio files the listener imported
 *  - `lyrics`:  lyrics looked up online (so downloaded songs keep their lyrics offline)
 *  - `artwork`: cover art of downloaded online tracks
 * Every operation resolves to a safe fallback if IndexedDB is unavailable.
 */
import type { AudioAnalysis } from '@/audio/synth/engine';
import type { AudioVariant } from '@/types/music';
import type { RemoteLyricsResult } from './providers/lrclib';

const DB_NAME = 'musicwave';
const DB_VERSION = 2;

export interface AudioRecord {
  key: string;
  blob: Blob;
  analysis?: AudioAnalysis;
  size: number;
  savedAt: number;
  lastUsed: number;
  /** Pinned records are explicit "downloads" and never evicted automatically. */
  pinned: boolean;
  /** For downloaded online tracks: the exact rendition that was saved. */
  variant?: AudioVariant;
}

export interface LyricsRecord {
  trackId: string;
  result: RemoteLyricsResult;
  fetchedAt: number;
}

export interface ArtworkRecord {
  key: string;
  blob: Blob;
}

export interface UploadRecord {
  id: string;
  blob: Blob;
  name: string;
  type: string;
  size: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('uploads')) db.createObjectStore('uploads', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('lyrics')) db.createObjectStore('lyrics', { keyPath: 'trackId' });
        if (!db.objectStoreNames.contains('artwork')) db.createObjectStore('artwork', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const t = db.transaction(store, mode);
          const req = fn(t.objectStore(store));
          t.oncomplete = () => resolve(req ? (req.result as T) : undefined);
          t.onerror = () => resolve(undefined);
          t.onabort = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export const offlineStore = {
  getAudio: (key: string) => tx<AudioRecord>('audio', 'readonly', (s) => s.get(key)),
  putAudio: (rec: AudioRecord) => tx('audio', 'readwrite', (s) => s.put(rec)),
  deleteAudio: (key: string) => tx('audio', 'readwrite', (s) => s.delete(key)),
  listAudio: async (): Promise<Array<Omit<AudioRecord, 'blob' | 'analysis'>>> => {
    const all = (await tx<AudioRecord[]>('audio', 'readonly', (s) => s.getAll())) ?? [];
    return all.map(({ key, size, savedAt, lastUsed, pinned, variant }) => ({ key, size, savedAt, lastUsed, pinned, variant }));
  },
  touchAudio: async (key: string) => {
    const rec = await offlineStore.getAudio(key);
    if (rec) await offlineStore.putAudio({ ...rec, lastUsed: Date.now() });
  },
  /** Keeps at most `maxUnpinned` auto-cached renders (least recently used are evicted). */
  evictUnpinned: async (maxUnpinned: number) => {
    const list = (await offlineStore.listAudio()).filter((r) => !r.pinned).sort((a, b) => b.lastUsed - a.lastUsed);
    for (const r of list.slice(maxUnpinned)) await offlineStore.deleteAudio(r.key);
  },
  getUpload: (id: string) => tx<UploadRecord>('uploads', 'readonly', (s) => s.get(id)),
  putUpload: (rec: UploadRecord) => tx('uploads', 'readwrite', (s) => s.put(rec)),
  deleteUpload: (id: string) => tx('uploads', 'readwrite', (s) => s.delete(id)),
  getLyrics: (trackId: string) => tx<LyricsRecord>('lyrics', 'readonly', (s) => s.get(trackId)),
  putLyrics: (rec: LyricsRecord) => tx('lyrics', 'readwrite', (s) => s.put(rec)),
  getArtwork: (key: string) => tx<ArtworkRecord>('artwork', 'readonly', (s) => s.get(key)),
  putArtwork: (rec: ArtworkRecord) => tx('artwork', 'readwrite', (s) => s.put(rec)),
  deleteArtwork: (key: string) => tx('artwork', 'readwrite', (s) => s.delete(key)),
  listArtwork: async (): Promise<ArtworkRecord[]> => (await tx<ArtworkRecord[]>('artwork', 'readonly', (s) => s.getAll())) ?? [],
  estimate: async (): Promise<{ usage: number; quota: number } | null> => {
    try {
      const e = await navigator.storage?.estimate?.();
      return e ? { usage: e.usage ?? 0, quota: e.quota ?? 0 } : null;
    } catch {
      return null;
    }
  },
};
