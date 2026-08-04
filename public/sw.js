// Service worker: makes the dashboard installable and delivers push
// notifications. Requests pass straight through to the network — the server
// already controls caching (code no-cache, images 1h) and the data is live
// Supabase, so a caching layer here would only get in the way. The one nicety:
// when the network is down entirely, navigations get the last-seen app shell.

const SHELL = 'remnant-shell-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    // Only the dashboard root is a valid offline shell. Hub pages (/a/{slug})
    // and /join are server-personalised, so caching one of those under "/"
    // would hand the wrong page back the next time the network dipped.
    const isRoot = new URL(req.url).pathname === '/';
    e.respondWith(
      fetch(req)
        .then(res => {
          if (isRoot && res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then(c => c.put('/', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('/').then(hit => hit || Response.error()))
    );
  }
});

/* ---------- push ---------- */

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* plain text push */ }
  const title = data.title || 'Tha Remnant Music Group';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/img/icon-192.png',
      badge: '/img/icon-192.png',
      tag: data.tag || 'remnant',
      data: { url: data.url || '/' },
    })
  );
});

// Tapping a notification focuses the app if it is already open, rather than
// stacking up duplicate windows.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
