/**
 * Runtime registry for tracks, collections and artists that come from online
 * catalogs. Anything the listener interacts with is registered here so the rest
 * of the app can resolve it synchronously by id (`getTrack(id)` etc.).
 *
 * The registry is persisted to localStorage, keeping everything the listener
 * references (likes, playlists, downloads, history, queue) plus the most recently
 * seen items, so the library keeps working after a reload and while offline.
 */
import { readJSON, writeJSON } from '@/services/storage';
import type { RemoteArtist, RemoteCollection, Track } from '@/types/music';
import { createStore } from './createStore';

const KEY = 'remote-catalog';
const MAX_TRACKS = 900;
const MAX_OTHERS = 300;

interface Entry<T> {
  value: T;
  seen: number;
}

const tracks = new Map<string, Entry<Track>>();
const collections = new Map<string, Entry<RemoteCollection>>();
const artists = new Map<string, Entry<RemoteArtist>>();
const collectionTracks = new Map<string, string[]>();

/** Bumped on every change so components can re-render (`useStore(remoteCatalogStore, s => s.version)`). */
export const remoteCatalogStore = createStore({ version: 0 });

let referenced: () => Set<string> = () => new Set();
/** Registers a function returning every id the library currently references (never pruned). */
export function setReferenceProvider(fn: () => Set<string>): void {
  referenced = fn;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function changed() {
  remoteCatalogStore.set((s) => ({ version: s.version + 1 }));
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 800);
}

function prune<T>(map: Map<string, Entry<T>>, max: number, keep: Set<string>): Array<[string, Entry<T>]> {
  return [...map.entries()].sort((a, b) => Number(keep.has(b[0])) - Number(keep.has(a[0])) || b[1].seen - a[1].seen).slice(0, max);
}

function save() {
  const keep = referenced();
  writeJSON(KEY, {
    v: 1,
    tracks: prune(tracks, MAX_TRACKS, keep).map(([, e]) => e),
    collections: prune(collections, MAX_OTHERS, keep).map(([, e]) => e),
    artists: prune(artists, MAX_OTHERS, keep).map(([, e]) => e),
    collectionTracks: [...collectionTracks.entries()].filter(([id]) => keep.has(id) || collections.has(id)).slice(-MAX_OTHERS),
  });
}

function load() {
  const data = readJSON<{
    v: number;
    tracks: Entry<Track>[];
    collections: Entry<RemoteCollection>[];
    artists: Entry<RemoteArtist>[];
    collectionTracks: Array<[string, string[]]>;
  }>(KEY);
  if (!data || data.v !== 1) return;
  data.tracks?.forEach((e) => tracks.set(e.value.id, e));
  data.collections?.forEach((e) => collections.set(e.value.id, e));
  data.artists?.forEach((e) => artists.set(e.value.id, e));
  data.collectionTracks?.forEach(([id, ids]) => collectionTracks.set(id, ids));
}
if (typeof window !== 'undefined') {
  load();
  window.addEventListener('pagehide', save);
}

/** Keeps what was learned about a track (inspected renditions, real length) when it is fetched again. */
function mergeTrack(prev: Track | undefined, next: Track): Track {
  if (!prev || prev.source.kind !== 'remote' || next.source.kind !== 'remote') return next;
  const known = new Map(prev.source.variants.map((v) => [v.url, v]));
  const variants = next.source.variants.map((v) => {
    const old = known.get(v.url);
    return old && !old.needsInspection ? old : v;
  });
  return { ...next, duration: next.duration || prev.duration, source: { ...next.source, variants } };
}

export function registerTracks(list: Track[]): Track[] {
  const now = Date.now();
  const out = list.map((t) => {
    const merged = mergeTrack(tracks.get(t.id)?.value, t);
    tracks.set(t.id, { value: merged, seen: now });
    return merged;
  });
  if (list.length) changed();
  return out;
}
export function registerCollections(list: RemoteCollection[]): RemoteCollection[] {
  const now = Date.now();
  for (const c of list) collections.set(c.id, { value: c, seen: now });
  if (list.length) changed();
  return list;
}
export function registerArtists(list: RemoteArtist[]): RemoteArtist[] {
  const now = Date.now();
  for (const a of list) artists.set(a.id, { value: a, seen: now });
  if (list.length) changed();
  return list;
}
export function setCollectionTracks(id: string, trackIds: string[]): void {
  collectionTracks.set(id, trackIds);
  changed();
}

export const getRemoteTrack = (id: string): Track | undefined => tracks.get(id)?.value;
export const getRemoteCollection = (id: string): RemoteCollection | undefined => collections.get(id)?.value;
export const getRemoteArtist = (id: string): RemoteArtist | undefined => artists.get(id)?.value;
export const getCollectionTrackIds = (id: string): string[] | undefined => collectionTracks.get(id);

/** Updates a stored track (e.g. after a quality variant was inspected). */
export function updateRemoteTrack(id: string, update: (t: Track) => Track): void {
  const e = tracks.get(id);
  if (!e) return;
  tracks.set(id, { value: update(e.value), seen: e.seen });
  changed();
}

/** Re-renders subscribers without changing data (e.g. local artwork became available). */
export function notifyRemoteCatalog(): void {
  remoteCatalogStore.set((s) => ({ version: s.version + 1 }));
}

export function isRemoteId(id: string): boolean {
  return /^(?:audius(?:-user|-playlist)?|ia(?:-item|-creator)?):/.test(id);
}
