/**
 * Vite plugin that emits `sw.js`: a small service worker that precaches the built
 * app shell so MusicWave opens without a connection. Downloaded music lives in
 * IndexedDB; the worker never touches audio or online-catalog requests.
 */
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

const WORKER = (version: string, assets: string[]) => `/* MusicWave service worker — generated at build time */
const CACHE = 'mw-shell-${version}';
const ASSETS = ${JSON.stringify(assets)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mw-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Network first so updates arrive; the cached shell when offline (client-side routes included).
    event.respondWith(fetch(req).catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))));
    return;
  }
  if (req.headers.has('range')) return;
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && url.pathname.startsWith('/assets/')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
`;

export function serviceWorker(): Plugin {
  return {
    name: 'musicwave-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== 'sw.js');
      const assets = ['/', '/index.html', '/favicon.svg', ...files.filter((f) => f !== 'index.html').map((f) => `/${f}`)];
      const version = createHash('sha256').update(files.sort().join('|')).digest('hex').slice(0, 12);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: WORKER(version, [...new Set(assets)]) });
    },
  };
}
