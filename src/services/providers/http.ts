/** Small fetch helper for the online catalogs: timeouts, cancellation and readable errors. */

export class SourceError extends Error {
  constructor(
    message: string,
    readonly source: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'SourceError';
  }
}

export async function fetchJSON<T>(url: string, source: string, init: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), init.timeoutMs ?? 15000);
  const onAbort = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new SourceError(`${source} answered ${res.status}`, source, res.status);
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof SourceError) throw err;
    if (init.signal?.aborted) throw err;
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    throw new SourceError(offline ? 'You are offline' : `Couldn’t reach ${source}`, source);
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', onAbort);
  }
}

export function qs(params: Record<string, string | number | boolean | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v));
  return p.toString();
}

export function isAbort(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError');
}
