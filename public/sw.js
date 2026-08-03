// Minimal service worker: exists so the dashboard is installable as an app.
// All requests pass straight through to the network — the server already
// controls caching (code no-cache, images 1h) and the data is live Supabase,
// so a caching layer here would only get in the way. The one nicety: when the
// network is down entirely, navigations get the last-seen app shell.

const SHELL = 'remnant-shell-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/'))
    );
  }
});
