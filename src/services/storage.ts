/**
 * Versioned, fault-tolerant localStorage persistence.
 * Every read/write is wrapped so private mode or a full quota never breaks the app.
 */
import type { Store } from '@/state/createStore';

const PREFIX = 'musicwave:';

export function readJSON<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

interface Envelope<T> {
  v: number;
  data: T;
}

/**
 * Hydrates `store` from localStorage and saves the picked slice on change (debounced).
 * `migrate` receives older data when the stored version differs.
 */
export function persistStore<T extends object, P extends Partial<T>>(
  store: Store<T>,
  options: {
    key: string;
    version: number;
    pick: (state: T) => P;
    migrate?: (data: unknown, fromVersion: number) => Partial<T> | undefined;
    debounceMs?: number;
  },
): void {
  const saved = readJSON<Envelope<P>>(options.key);
  if (saved && typeof saved === 'object' && 'data' in saved) {
    if (saved.v === options.version) store.set(saved.data);
    else {
      const migrated = options.migrate?.(saved.data, saved.v);
      if (migrated) store.set(migrated);
    }
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = JSON.stringify(options.pick(store.get()));
  store.subscribe((state) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const next = JSON.stringify(options.pick(state));
      if (next === last) return;
      last = next;
      writeJSON(options.key, { v: options.version, data: JSON.parse(next) });
    }, options.debounceMs ?? 250);
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
      writeJSON(options.key, { v: options.version, data: options.pick(store.get()) });
    });
  }
}
