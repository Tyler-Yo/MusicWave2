/**
 * A tiny observable store (≈ zustand-lite) built on useSyncExternalStore.
 * Components subscribe with a selector and only re-render when the selected
 * slice changes.
 */
import { useCallback, useRef, useSyncExternalStore } from 'react';

export interface Store<T> {
  get(): T;
  set(update: Partial<T> | ((state: T) => Partial<T> | T)): void;
  subscribe(listener: (state: T, prev: T) => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<(state: T, prev: T) => void>();
  return {
    get: () => state,
    set(update) {
      const patch = typeof update === 'function' ? update(state) : update;
      if (patch === state) return;
      const prev = state;
      state = { ...state, ...patch };
      listeners.forEach((l) => l(state, prev));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Shallow equality for arrays/objects returned by selectors. */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

export function useStore<T extends object, S>(
  store: Store<T>,
  selector: (state: T) => S,
  isEqual: (a: S, b: S) => boolean = Object.is,
): S {
  const cache = useRef<{ state: T; value: S } | null>(null);
  const getSnapshot = useCallback(() => {
    const state = store.get();
    const cached = cache.current;
    if (cached && cached.state === state) return cached.value;
    const value = selector(state);
    if (cached && isEqual(cached.value, value)) {
      cache.current = { state, value: cached.value };
      return cached.value;
    }
    cache.current = { state, value };
    return value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, selector]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
