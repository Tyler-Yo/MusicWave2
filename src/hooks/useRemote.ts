/**
 * Loads data from an online catalog with caching, cancellation, offline awareness
 * and retry. Results are cached per key for `ttlMs` (and reused across pages).
 */
import { useCallback, useEffect, useState } from 'react';
import { useOffline } from '@/state/networkStore';

const cache = new Map<string, { at: number; data: unknown }>();

export interface RemoteResult<T> {
  data: T | undefined;
  /** Readable error message, if the last request failed. */
  error: string | null;
  loading: boolean;
  /** Offline with nothing cached. */
  offline: boolean;
  retry: () => void;
}

export function peekRemote<T>(key: string): T | undefined {
  return cache.get(key)?.data as T | undefined;
}

export function useRemote<T>(key: string | null, fetcher: (signal: AbortSignal) => Promise<T>, ttlMs = 10 * 60 * 1000): RemoteResult<T> {
  const { offline } = useOffline();
  const [state, setState] = useState<{ key: string | null; data: T | undefined; error: string | null; loading: boolean }>(() => ({
    key,
    data: key ? (cache.get(key)?.data as T | undefined) : undefined,
    error: null,
    loading: Boolean(key && !cache.has(key)),
  }));
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!key) return;
    const hit = cache.get(key);
    if (hit && (Date.now() - hit.at < ttlMs || offline) && nonce === 0) {
      setState({ key, data: hit.data as T, error: null, loading: false });
      return;
    }
    if (offline) {
      setState({ key, data: hit?.data as T | undefined, error: null, loading: false });
      return;
    }
    const controller = new AbortController();
    setState({ key, data: hit?.data as T | undefined, error: null, loading: !hit });
    fetcher(controller.signal).then(
      (data) => {
        cache.set(key, { at: Date.now(), data });
        if (!controller.signal.aborted) setState({ key, data, error: null, loading: false });
      },
      (err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ key, data: hit?.data as T | undefined, error: err instanceof Error ? err.message : 'Something went wrong', loading: false });
      },
    );
    return () => controller.abort();
    // `fetcher` is intentionally not a dependency: the key identifies the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, offline, nonce, ttlMs]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  // Before the effect catches up with a new key, answer from the cache rather than stale state.
  if (state.key !== key) {
    const hit = key ? cache.get(key) : undefined;
    return { data: hit?.data as T | undefined, error: null, loading: Boolean(key && !hit && !offline), offline: offline && !hit, retry };
  }
  return { data: state.data, error: state.error, loading: state.loading, offline: offline && state.data === undefined, retry };
}
