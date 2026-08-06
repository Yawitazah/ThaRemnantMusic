// Service worker: makes the dashboard installable and delivers push
// notifications. Requests pass straight through to the network — the server
// already controls caching (code no-cache, images 1h) and the data is live
// Supabase, so a caching layer here would only get in the way. The one nicety:
// when the network is down entirely, navigations get the last-seen app shell.

// v2: the shell moved from "/" to "/command" when the label page took over the
// root. The rename also retires any v1 cache still holding the old dashboard
// HTML under "/", which would otherwise be served in place of the label page.
const SHELL = 'remnant-shell-v2';
const APP = '/command';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  /* Force code off the network, bypassing the browser's HTTP cache.
     server.js sends `no-cache` for js/css, but Cloudflare's Browser Cache TTL was
     rewriting that to max-age=14400, so browsers pinned modules for four hours.
     Setting Cloudflare to respect origin headers fixes new visitors, but it does
     NOT evict copies already stored — and a stale module against a fresh one is
     not a slow page, it is a broken one: a cached data.js missing an export its
     importer now needs throws SyntaxError and the app never boots.

     This heals those clients without anyone clearing anything, and costs nothing
     we were not already paying, since the origin declares these uncacheable. The
     SW script itself is exempt from the HTTP cache (updateViaCache 'imports'), so
     this reaches browsers that are holding a stale everything-else. */
  const u = new URL(req.url);
  if (u.origin === location.origin && /\.(js|css)$/.test(u.pathname)) {
    e.respondWith(
      fetch(req, { cache: 'reload' }).catch(() => fetch(req))
    );
    return;
  }

  if (req.mode === 'navigate') {
    // Only the Command Center is a valid offline shell — it is what the installed
    // app opens (manifest start_url). Hub pages (/a/{slug}), the label page and
    // /join are server-personalised, so caching one of those under the shell key
    // would hand the wrong page back the next time the network dipped.
    const isApp = new URL(req.url).pathname.replace(/\/$/, '') === APP;
    e.respondWith(
      fetch(req)
        .then(res => {
          if (isApp && res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then(c => c.put(APP, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => (isApp
          ? caches.match(APP).then(hit => hit || Response.error())
          : Response.error()))
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
      data: { url: data.url || APP },
    })
  );
});

// Tapping a notification focuses the app if it is already open, rather than
// stacking up duplicate windows.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || APP;
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
