/** Transient UI state: overlays, dialogs, toasts and screen-reader announcements. */
import { createStore } from './createStore';

export type NowPlayingPanel = 'lyrics' | 'queue';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
  action?: { label: string; run: () => void };
}

export interface UIState {
  nowPlayingOpen: boolean;
  /** Desktop: right-hand panel. Mobile: which view replaces the artwork. */
  nowPlayingPanel: NowPlayingPanel | null;
  queueDrawerOpen: boolean;
  toasts: Toast[];
  addToPlaylist: { trackIds: string[] } | null;
  shortcutsOpen: boolean;
  /** Text for the polite live region (track changes etc.). */
  announcement: string;
}

export const uiStore = createStore<UIState>({
  nowPlayingOpen: false,
  nowPlayingPanel: 'lyrics',
  queueDrawerOpen: false,
  toasts: [],
  addToPlaylist: null,
  shortcutsOpen: false,
  announcement: '',
});

let toastId = 0;

export const ui = {
  openNowPlaying(panel?: NowPlayingPanel | null) {
    uiStore.set((s) => ({ nowPlayingOpen: true, nowPlayingPanel: panel === undefined ? s.nowPlayingPanel : panel }));
  },
  closeNowPlaying: () => uiStore.set({ nowPlayingOpen: false }),
  togglePanel(panel: NowPlayingPanel) {
    uiStore.set((s) => ({ nowPlayingPanel: s.nowPlayingPanel === panel ? null : panel }));
  },
  toggleQueueDrawer: (open?: boolean) => uiStore.set((s) => ({ queueDrawerOpen: open ?? !s.queueDrawerOpen })),
  toast(message: string, tone: Toast['tone'] = 'info', action?: Toast['action']) {
    const id = ++toastId;
    uiStore.set((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, tone, action }] }));
    setTimeout(() => ui.dismissToast(id), action ? 6000 : 3800);
    return id;
  },
  dismissToast: (id: number) => uiStore.set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  openAddToPlaylist: (trackIds: string[]) => uiStore.set({ addToPlaylist: { trackIds } }),
  closeAddToPlaylist: () => uiStore.set({ addToPlaylist: null }),
  setShortcutsOpen: (open: boolean) => uiStore.set({ shortcutsOpen: open }),
  announce: (text: string) => uiStore.set({ announcement: text }),
};
