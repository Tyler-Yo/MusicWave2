/**
 * Connectivity: the browser's online/offline signal combined with the listener's
 * manual offline mode. When either says offline, only downloaded music plays.
 */
import { createStore, useStore } from './createStore';
import { settingsStore, type SettingsState } from './settingsStore';

export const networkStore = createStore({ online: typeof navigator === 'undefined' ? true : navigator.onLine !== false });

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => networkStore.set({ online: true }));
  window.addEventListener('offline', () => networkStore.set({ online: false }));
}

/** True when the app must behave offline (no connection, or offline mode switched on). */
export function isOffline(s: SettingsState = settingsStore.get()): boolean {
  return s.offlineMode || !networkStore.get().online;
}

export function useOffline(): { offline: boolean; manual: boolean; connected: boolean } {
  const manual = useStore(settingsStore, (s) => s.offlineMode);
  const connected = useStore(networkStore, (s) => s.online);
  return { offline: manual || !connected, manual, connected };
}
