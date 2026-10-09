/**
 * Player state + actions, and the binding between that state and the audio engine.
 *
 * The store is the single source of truth ("what should be playing"); `initPlayer`
 * reconciles the HTMLAudioElement with it and feeds element events back.
 */
import { getAudioEngine } from '@/services/audioEngine';
import { OfflineUnavailableError, pinTrack, prefetchTrack, resolveTrackAudio } from '@/services/audioSources';
import { artistNameOf, getTrack } from '@/services/catalog';
import { invalidatePlaybackTime } from '@/services/playbackTicker';
import { persistStore, readJSON, writeJSON } from '@/services/storage';
import type { PlayContext } from '@/types/music';
import type { PlayerState, RepeatMode } from '@/types/player';
import { createStore } from './createStore';
import { libraryActions } from './libraryStore';
import {
  appendToQueue,
  insertNext,
  makeItems,
  moveItem,
  nextIndex,
  previousIndex,
  removeItem,
  shuffleUpcoming,
  unshuffle,
} from './queue';
import { ui } from './uiStore';

export const PLAYBACK_RATES = [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2] as const;

export const playerStore = createStore<PlayerState>({
  queue: [],
  index: -1,
  baseOrder: null,
  shuffle: false,
  repeat: 'off',
  isPlaying: false,
  status: 'idle',
  volume: 0.8,
  muted: false,
  playbackRate: 1,
  context: null,
  sessionHistory: [],
});

persistStore(playerStore, {
  key: 'player',
  version: 1,
  pick: ({ queue, index, baseOrder, shuffle, repeat, volume, muted, playbackRate, context }) => ({
    queue,
    index,
    baseOrder,
    shuffle,
    repeat,
    volume,
    muted,
    playbackRate,
    context,
  }),
});

const get = () => playerStore.get();
const set = playerStore.set;

export const currentItem = (s: PlayerState = get()) => (s.index >= 0 ? s.queue[s.index] : undefined);
export const currentTrackId = (s: PlayerState = get()) => currentItem(s)?.trackId;

/** Seek position to apply when the current item is next loaded (restored session / seek before load). */
let pendingStart: { uid: string; time: number } | null = null;
let loadedUid: string | null = null;
let loadSeq = 0;
let recordedUid: string | null = null;
let prefetchedUid: string | null = null;

export const player = {
  /** Replace the queue with `trackIds` and start playing at `startIndex`. */
  playTracks(trackIds: string[], startIndex = 0, context: PlayContext | null = null, opts: { shuffle?: boolean } = {}) {
    if (trackIds.length === 0) return;
    const items = makeItems(trackIds);
    const shuffle = opts.shuffle ?? get().shuffle;
    let start = Math.max(0, Math.min(startIndex, items.length - 1));
    if (opts.shuffle && startIndex < 0) start = Math.floor(Math.random() * items.length);
    let queue = items;
    let index = start;
    if (shuffle) {
      queue = shuffleUpcoming([items[start], ...items.filter((_, i) => i !== start)], 0);
      index = 0;
    }
    set({ queue, index, baseOrder: shuffle ? items : null, shuffle, context, isPlaying: true, status: 'loading' });
  },

  /** Make `trackId` the current track without starting playback (Lyrics Studio). */
  cue(trackId: string, context: PlayContext | null = null) {
    if (currentTrackId() === trackId) return;
    set({ queue: makeItems([trackId]), index: 0, baseOrder: null, context, isPlaying: false });
  },

  /** Play a single track; if it is already current, toggle play/pause. */
  playTrack(trackId: string, context: PlayContext | null = null) {
    if (currentTrackId() === trackId) return player.toggle();
    player.playTracks([trackId], 0, context);
  },

  toggle() {
    if (!currentItem()) return;
    set((s) => ({ isPlaying: !s.isPlaying }));
  },
  play() {
    if (currentItem()) set({ isPlaying: true });
  },
  pause() {
    set({ isPlaying: false });
  },

  next(opts: { auto?: boolean } = {}) {
    const s = get();
    const i = nextIndex(s.queue.length, s.index, s.repeat);
    if (i === null) {
      if (opts.auto) {
        // End of the queue: stop and rewind the last track.
        set({ isPlaying: false });
        getAudioEngine().seek(0);
        invalidatePlaybackTime();
      } else if (s.queue.length) {
        set({ index: 0, isPlaying: false });
      }
      return;
    }
    if (i === s.index) return player.restart();
    set({ index: i, isPlaying: opts.auto ? true : s.isPlaying });
  },

  previous() {
    const s = get();
    const engine = getAudioEngine();
    if (loadedUid === currentItem(s)?.uid && engine.currentTime > 3) return player.seek(0);
    const i = previousIndex(s.queue.length, s.index, s.repeat);
    if (i === null || i === s.index) return player.seek(0);
    set({ index: i });
  },

  restart() {
    player.seek(0);
    player.play();
  },

  seek(seconds: number) {
    const item = currentItem();
    if (!item) return;
    if (loadedUid === item.uid && get().status === 'ready') {
      getAudioEngine().seek(seconds);
    } else {
      pendingStart = { uid: item.uid, time: Math.max(0, seconds) };
    }
    invalidatePlaybackTime();
  },
  seekBy(delta: number) {
    player.seek(Math.max(0, getAudioEngine().clock.now() + delta));
  },

  setVolume(volume: number) {
    const v = Math.max(0, Math.min(1, volume));
    set({ volume: v, muted: v === 0 });
  },
  toggleMute() {
    set((s) => ({ muted: !s.muted, volume: s.muted && s.volume === 0 ? 0.5 : s.volume }));
  },
  setRate(rate: number) {
    set({ playbackRate: Math.max(0.5, Math.min(2, rate)) });
  },

  toggleShuffle() {
    const s = get();
    if (!s.shuffle) {
      set({ shuffle: true, baseOrder: s.queue, queue: shuffleUpcoming(s.queue, s.index) });
      ui.toast('Shuffle on');
    } else {
      set({ shuffle: false, queue: s.baseOrder ? unshuffle(s.queue, s.index, s.baseOrder) : s.queue, baseOrder: null });
      ui.toast('Shuffle off');
    }
  },
  cycleRepeat() {
    const order: RepeatMode[] = ['off', 'all', 'one'];
    const next = order[(order.indexOf(get().repeat) + 1) % order.length];
    set({ repeat: next });
    ui.toast(next === 'off' ? 'Repeat off' : next === 'all' ? 'Repeating queue' : 'Repeating this song');
  },

  playNext(trackIds: string[]) {
    const s = get();
    if (!currentItem(s)) return player.playTracks(trackIds, 0, { type: 'queue', name: 'Queue' });
    set({ queue: insertNext(s.queue, s.index, makeItems(trackIds, true)) });
    ui.toast(trackIds.length === 1 ? 'Playing next' : `${trackIds.length} songs playing next`, 'success');
  },
  addToQueue(trackIds: string[]) {
    const s = get();
    if (!currentItem(s)) return player.playTracks(trackIds, 0, { type: 'queue', name: 'Queue' });
    set({ queue: appendToQueue(s.queue, s.index, makeItems(trackIds, true)) });
    ui.toast(trackIds.length === 1 ? 'Added to queue' : `${trackIds.length} songs added to queue`, 'success');
  },
  removeFromQueue(uid: string) {
    const s = get();
    set(removeItem(s.queue, s.index, uid));
  },
  /** Move within the full queue (absolute indices). */
  moveInQueue(from: number, to: number) {
    const s = get();
    if (from <= s.index || to <= s.index) return;
    set({ queue: moveItem(s.queue, from, to) });
  },
  clearUpNext() {
    const s = get();
    set({ queue: s.queue.slice(0, s.index + 1) });
  },
  jumpTo(uid: string) {
    const i = get().queue.findIndex((q) => q.uid === uid);
    if (i >= 0) set({ index: i, isPlaying: true });
  },
};

// ---------------------------------------------------------------------------------------------
// Engine binding
// ---------------------------------------------------------------------------------------------

async function loadCurrent(): Promise<void> {
  const engine = getAudioEngine();
  const item = currentItem();
  const seq = ++loadSeq;
  if (!item) {
    loadedUid = null;
    pinTrack(null);
    engine.unload();
    set({ status: 'idle', isPlaying: false });
    return;
  }
  loadedUid = item.uid;
  recordedUid = null;
  prefetchedUid = null;
  const track = getTrack(item.trackId);
  if (!track) {
    set({ status: 'error', statusDetail: 'This track is no longer available.' });
    setTimeout(() => seq === loadSeq && player.next({ auto: true }), 800);
    return;
  }
  set({ status: 'loading', statusDetail: track.source.kind === 'synth' ? 'Preparing audio…' : 'Loading…' });
  pinTrack(track.id);
  engine.pause();
  try {
    const { url } = await resolveTrackAudio(track);
    if (seq !== loadSeq) return;
    const startAt = pendingStart?.uid === item.uid ? pendingStart.time : 0;
    pendingStart = null;
    await engine.load(url, startAt);
    if (seq !== loadSeq) return;
    if (track.source.kind !== 'synth' && Number.isFinite(engine.duration) && track.duration === 0) {
      // Uploaded files learn their duration on load.
      libraryActions.updateUpload(track.id, { duration: engine.duration });
    }
    set({ status: 'ready', statusDetail: undefined });
    invalidatePlaybackTime();
    ui.announce(`Now playing ${track.title} by ${artistNameOf(track)}`);
    if (get().isPlaying) {
      const ok = await engine.play();
      if (!ok && seq === loadSeq) {
        set({ isPlaying: false });
        ui.toast('Press play to start listening');
      }
    }
  } catch (err) {
    if (seq !== loadSeq) return;
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'superseded') return;
    loadedUid = null;
    set({ status: 'error', statusDetail: message });
    const offline = err instanceof OfflineUnavailableError;
    ui.toast(offline ? `"${track.title}" isn't downloaded. ${message}` : `Couldn't play "${track.title}": ${message}`, 'error');
    const s = get();
    if (s.isPlaying && nextIndex(s.queue.length, s.index, s.repeat) !== null && s.queue.length > 1) {
      setTimeout(() => seq === loadSeq && player.next({ auto: true }), 1500);
    } else {
      set({ isPlaying: false });
    }
  }
}

let initialized = false;

/** Wires the store to the audio engine. Safe to call more than once. */
export function initPlayer(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  const engine = getAudioEngine();
  const s0 = get();
  engine.setVolume(s0.volume, s0.muted);
  engine.setRate(s0.playbackRate);

  // Restore the last position, but don't load (or render) anything until the listener presses play.
  const saved = readJSON<{ uid: string; time: number }>('position');
  const item0 = currentItem(s0);
  if (saved && item0 && saved.uid === item0.uid) pendingStart = saved;
  set({ isPlaying: false, status: 'idle' });

  playerStore.subscribe((s, prev) => {
    const item = currentItem(s);
    if (item?.uid !== currentItem(prev)?.uid) {
      if (s.isPlaying) void loadCurrent();
      else if (loadedUid !== item?.uid) {
        loadedUid = null;
        if (get().status !== 'idle') set({ status: 'idle', statusDetail: undefined });
      }
    } else if (s.isPlaying !== prev.isPlaying) {
      if (s.isPlaying) {
        if (loadedUid !== item?.uid || s.status === 'error' || s.status === 'idle') void loadCurrent();
        else if (s.status === 'ready') void engine.play().then((ok) => !ok && set({ isPlaying: false }));
      } else {
        engine.pause();
      }
    }
    if (s.volume !== prev.volume || s.muted !== prev.muted) engine.setVolume(s.volume, s.muted);
    if (s.playbackRate !== prev.playbackRate) engine.setRate(s.playbackRate);
  });

  engine.on('ended', () => {
    if (get().repeat === 'one') {
      engine.seek(0);
      void engine.play();
      return;
    }
    player.next({ auto: true });
  });
  // Reflect pauses/plays that come from outside the app (OS media keys, headphones unplugged).
  engine.on('pause', () => {
    if (engine.audio.ended || get().status !== 'ready') return;
    if (get().isPlaying) set({ isPlaying: false });
  });
  engine.on('play', () => {
    if (!get().isPlaying && get().status === 'ready') set({ isPlaying: true });
  });
  engine.on('error', () => {
    const s = get();
    if (s.status === 'ready') {
      set({ status: 'error', statusDetail: 'Playback failed.', isPlaying: false });
      ui.toast('Playback failed. The audio stream was interrupted.', 'error');
    }
  });

  let lastSaved = 0;
  engine.on('timeupdate', () => {
    const s = get();
    const item = currentItem(s);
    if (!item || loadedUid !== item.uid) return;
    const t = engine.currentTime;
    // Count a play after 3 seconds of listening.
    if (recordedUid !== item.uid && t >= 3) {
      recordedUid = item.uid;
      libraryActions.recordPlay(item.trackId, s.context ?? undefined);
      set({ sessionHistory: [...s.sessionHistory, item.trackId].slice(-50) });
    }
    // Prefetch the next track once this one is comfortably underway.
    if (prefetchedUid !== item.uid && t >= 2) {
      prefetchedUid = item.uid;
      const ni = nextIndex(s.queue.length, s.index, s.repeat);
      if (ni !== null && ni !== s.index) prefetchTrack(getTrack(s.queue[ni].trackId));
    }
    if (Date.now() - lastSaved > 4000) {
      lastSaved = Date.now();
      writeJSON('position', { uid: item.uid, time: t });
    }
  });
  window.addEventListener('pagehide', () => {
    const item = currentItem();
    if (item && loadedUid === item.uid) writeJSON('position', { uid: item.uid, time: engine.currentTime });
  });
}

/** Position to show before the current item is loaded (restored session). */
export function pendingPosition(): number {
  const item = currentItem();
  return pendingStart && item && pendingStart.uid === item.uid ? pendingStart.time : 0;
}

/** True when the element currently holds the current queue item. */
export function isCurrentLoaded(): boolean {
  return loadedUid !== null && loadedUid === currentItem()?.uid && get().status === 'ready';
}
