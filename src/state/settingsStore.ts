/** User preferences, persisted to localStorage. */
import { persistStore } from '@/services/storage';
import { createStore } from './createStore';

export type ThemePreference = 'dark' | 'light' | 'system';
export type MotionPreference = 'system' | 'reduce' | 'full';

export interface SettingsState {
  theme: ThemePreference;
  userName: string;
  /** Karaoke mode: bigger, animated active line. */
  karaoke: boolean;
  /** Per-track lyric offset in seconds (+ = lyrics earlier). */
  lyricsOffsets: Record<string, number>;
  /** Global output-latency compensation in seconds (e.g. Bluetooth headphones). */
  outputLatency: number;
  /** Lyrics font scale (0.8 – 1.5). */
  lyricsScale: number;
  motion: MotionPreference;
  /** Simulated offline mode: only downloaded / uploaded tracks are playable. */
  offlineMode: boolean;
  /** Lyrics Studio: seconds subtracted from each tap to compensate reaction time. */
  tapCompensation: number;
  /** Show the current lyric in the mini player when there is room. */
  miniLyrics: boolean;
  /** Spinning vinyl artwork in Now Playing. */
  vinylArt: boolean;
  /** Keep recently rendered demo tracks in IndexedDB for instant replays. */
  cacheRenders: boolean;
}

export const OFFSET_STEP = 0.25;

export const settingsStore = createStore<SettingsState>({
  theme: 'dark',
  userName: 'Listener',
  karaoke: false,
  lyricsOffsets: {},
  outputLatency: 0,
  lyricsScale: 1,
  motion: 'system',
  offlineMode: false,
  tapCompensation: 0.12,
  miniLyrics: true,
  vinylArt: true,
  cacheRenders: true,
});

persistStore(settingsStore, { key: 'settings', version: 1, pick: (s) => s });

export const settingsActions = {
  set<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    settingsStore.set({ [key]: value } as Pick<SettingsState, K>);
  },
  toggleKaraoke() {
    settingsStore.set((s) => ({ karaoke: !s.karaoke }));
  },
  nudgeOffset(trackId: string, delta: number) {
    settingsStore.set((s) => {
      const next = Math.round(((s.lyricsOffsets[trackId] ?? 0) + delta) * 100) / 100;
      const lyricsOffsets = { ...s.lyricsOffsets, [trackId]: Math.max(-10, Math.min(10, next)) };
      if (Math.abs(lyricsOffsets[trackId]) < 0.001) delete lyricsOffsets[trackId];
      return { lyricsOffsets };
    });
  },
  resetOffset(trackId: string) {
    settingsStore.set((s) => {
      const lyricsOffsets = { ...s.lyricsOffsets };
      delete lyricsOffsets[trackId];
      return { lyricsOffsets };
    });
  },
};

/** Total lyric shift for a track: per-track offset + global latency compensation. */
export function lyricShift(trackId: string | undefined, s: SettingsState = settingsStore.get()): number {
  return (trackId ? (s.lyricsOffsets[trackId] ?? 0) : 0) + s.outputLatency;
}
