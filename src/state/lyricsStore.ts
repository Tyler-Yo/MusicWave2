/**
 * Custom lyrics saved from the Lyrics Studio or imported .lrc files.
 * They override a track's built-in lyrics and are persisted to localStorage.
 */
import { persistStore } from '@/services/storage';
import { createStore } from './createStore';

export interface LyricsOverride {
  lrc: string;
  updatedAt: number;
  source: 'studio' | 'import';
}

export interface LyricsState {
  overrides: Record<string, LyricsOverride>;
  /** Unsaved Lyrics Studio draft, so a refresh never loses work. */
  draft: { trackId: string | null; text: string; lrc: string } | null;
}

export const lyricsStore = createStore<LyricsState>({ overrides: {}, draft: null });

persistStore(lyricsStore, { key: 'lyrics', version: 1, pick: (s) => s, debounceMs: 600 });

export const lyricsActions = {
  saveOverride(trackId: string, lrc: string, source: LyricsOverride['source']) {
    lyricsStore.set((s) => ({ overrides: { ...s.overrides, [trackId]: { lrc, updatedAt: Date.now(), source } } }));
  },
  removeOverride(trackId: string) {
    lyricsStore.set((s) => {
      const overrides = { ...s.overrides };
      delete overrides[trackId];
      return { overrides };
    });
  },
  setDraft(draft: LyricsState['draft']) {
    lyricsStore.set({ draft });
  },
};
