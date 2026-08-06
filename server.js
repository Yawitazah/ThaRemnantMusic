// Zero-dependency static server for the Label Command Center.
// Run locally:  node server.js        →  http://localhost:3000
// On Railway:   picked up automatically via `npm start`, binds process.env.PORT.

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const PORT = process.env.PORT || 3000;

/* Public artist link hubs live at /a/{slug}. Fan email capture posts here and
   is forwarded server-side to Zah CRM (the browser can't cross-origin POST).
   The slug map also personalises the share preview for each hub. */
// "remnant" is the shared label account, auto-provisioned by the CRM's SSO
// bridge — one pool of leads the whole team works together.
const CRM_CAPTURE_URL =
  process.env.CRM_CAPTURE_URL || 'https://zahcrm.com/api/card/remnant/capture';
// Captures also land in the label's own database so the whole team sees every
// fan in the dashboard's Fans tab. The publishable key is public by design;
// row-level security only allows inserts here.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://upfqppdfckqehzgsosdi.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_c0j0FTpd3X-joAr673KR4A_NmMGSP7u';

/* ---------- web push ----------
   The public VAPID key is served to the browser; the private one signs. Both
   default to the pair generated for this project so push works out of the box
   and can still be rotated through the environment. The fanout worker polls
   push_claim() with a shared secret instead of carrying a service-role key. */
const VAPID_PUBLIC = process.env.VAPID_PUBLIC
  || 'BF80eyZ4VEYnW3WKH3iKpX97bBr_RvpAflvpgYPCrmb4QG4NIh_unEjM1sIKu0mgw3zUCn4aQgSoJ7KULyJjcRM';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || 'OY-TtZyjAp-ZOQbYKfcjksNdiiONfANiQKi2Z9ISgNs';
const PUSH_SECRET = process.env.PUSH_SECRET || 'VYawfzWCaOefTTgsx4PJmt_7yJpmoxsW';
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:zahbrandsolutions@gmail.com',
  VAPID_PUBLIC, VAPID_PRIVATE,
);

const rpc = (fn, body) => fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
  method: 'POST',
  headers: {
    apikey: SUPABASE_ANON_KEY,
    authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(10000),
});

/* Poll for fans who signed up since the last round and push one notification
   each. Captures are marked inside push_claim, so a crash mid-round can drop a
   notification but can never send the same one twice. */
async function pushRound() {
  const res = await rpc('push_claim', { p_secret: PUSH_SECRET });
  if (!res.ok) throw new Error(`push_claim HTTP ${res.status}`);
  const { captures = [], subs = [] } = await res.json();
  if (!captures.length || !subs.length) return;

  let ok = 0, failed = 0, dropped = 0;
  for (const c of captures) {
    const payload = JSON.stringify({
      title: `New fan for ${c.artist}`,
      body: `${c.name || c.email} just joined the list.`,
      url: '/command#fans',
      tag: 'fan-' + c.email,
    });
    await Promise.all(subs.map(async s => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        ok++;
      } catch (err) {
        failed++;
        // 404/410 are the standard "this subscription is gone" codes (app
        // uninstalled, permission revoked). Anything else may be transient, so
        // the device keeps its subscription and we try again next time.
        if (err.statusCode === 404 || err.statusCode === 410) {
          dropped++;
          await rpc('push_drop', { p_secret: PUSH_SECRET, p_endpoint: s.endpoint }).catch(() => {});
        } else {
          console.warn(`[push] ${s.endpoint.slice(0, 48)}… failed: ${err.statusCode || err.message}`);
        }
      }
    }));
  }
  console.log(`[push] ${captures.length} fan(s) × ${subs.length} device(s): `
    + `${ok} delivered, ${failed} failed, ${dropped} stale removed`);
}

setInterval(() => { pushRound().catch(e => console.error('[push]', e.message)); }, 60_000);

/* ---------- nightly YouTube refresh ----------
   The streaming figures used to be pulled by hand, and the footer said "scraped
   2 Aug" for days after they moved. This closes that.

   It is the official API, not a scrape: one request per 50 video ids answers
   "how many views does each of these have", for any public video, no matter who
   owns the channel. So there is no per-artist setup and multiple channels per
   artist cost nothing extra — the whole catalog is 2 requests, plus 1 per channel
   handle, against a free quota of 10,000 units a day. Scraping the pages would
   mean fighting consent walls and markup that changes without notice.

   Writes go through yt_apply(), a definer function gated on the same shared
   secret push_claim() uses, so the server never needs a service-role key. */
const YT_KEY = process.env.YOUTUBE_API_KEY || '';
const YT_HOUR = Number(process.env.YT_REFRESH_HOUR ?? 7);   // 07:00 UTC ≈ 3am ET
let ytLastRun = '';

const chunk = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function ytRefresh() {
  if (!YT_KEY) return;

  const ids = (await (await rpc('yt_video_ids', {})).json()).map(r => r.video_id);
  const handles = (await (await rpc('yt_handles', {})).json()).map(r => r.handle);

  /* 50 is the API's hard maximum per call and each call costs 1 unit, so the
     whole catalogue is a rounding error against the daily quota. */
  const videos = [];
  for (const group of chunk(ids, 50)) {
    const url = 'https://www.googleapis.com/youtube/v3/videos'
      + `?part=statistics&id=${group.join(',')}&key=${YT_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`videos.list HTTP ${res.status}`);
    const { items = [] } = await res.json();
    // A private, deleted or region-blocked video simply is not in `items`, which
    // is why yt_apply only ever raises a count and never clears one.
    for (const it of items) {
      const views = Number(it.statistics?.viewCount || 0);
      if (views > 0) videos.push({ video_id: it.id, views });
    }
  }

  /* forHandle takes one handle per call, so this is one unit per channel. */
  const channels = [];
  for (const handle of handles) {
    const url = 'https://www.googleapis.com/youtube/v3/channels'
      + `?part=statistics&forHandle=${encodeURIComponent(handle)}&key=${YT_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) continue;                       // one bad handle must not sink the run
    const s = (await res.json()).items?.[0]?.statistics;
    if (!s) continue;
    /* Subscribers only. videoCount is every upload on the channel — Shorts, live
       streams, reaction videos, the lot — so refreshing it turned a curated count
       of 40 music videos into 244 of everything, which measures nothing anyone
       here cares about. The catalog table is the real count of music, and that is
       maintained deliberately rather than by whatever got posted yesterday. */
    channels.push({ handle, subs: Number(s.subscriberCount || 0) });
  }

  const res = await rpc('yt_apply', { p_secret: PUSH_SECRET, p_videos: videos, p_channels: channels });
  if (!res.ok) throw new Error(`yt_apply HTTP ${res.status} ${await res.text()}`);
  const n = await res.json();
  console.log(`[yt] ${videos.length} videos + ${channels.length} channels read; `
    + `updated catalog ${n.catalog}, album ${n.album_tracks}, channels ${n.channels}`);
}

/* Checked hourly rather than scheduled with cron, because Railway restarts on
   every deploy and a process-lifetime timer would drift with it. The date stamp
   makes the run idempotent: at most one per day, whenever the container happens
   to be up at that hour. */
function ytTick() {
  if (!YT_KEY) return;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (now.getUTCHours() !== YT_HOUR || ytLastRun === today) return;
  ytLastRun = today;
  ytRefresh().catch(e => { console.error('[yt]', e.message); });
}
setInterval(ytTick, 10 * 60_000);
ytTick();

/* Manual trigger, so the job can be proved without waiting for 3am. Gated on the
   same shared secret as the write itself, so it is not a public button. */
async function ytManual(req, res, url) {
  if (url.searchParams.get('secret') !== PUSH_SECRET) {
    res.writeHead(403, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, error: 'forbidden' }));
  }
  if (!YT_KEY) {
    res.writeHead(503, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, error: 'YOUTUBE_API_KEY is not set' }));
  }
  try {
    await ytRefresh();
    ytLastRun = new Date().toISOString().slice(0, 10);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (e) {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
}

const SITE = process.env.SITE_URL || 'https://tharemnant.com';

const HUBS = {
  breed:       { name: 'BREED',         image: '/img/og-card.jpg' },
  kingkonnect: { name: 'King Konnect',  image: '/img/og-card.jpg' },
  jay:         { name: 'JayThaRealist', image: '/img/jaytharealist.jpg' },
  yawitazah:   { name: 'Yawitazah',     image: '/img/yawitazah.jpg' },
};

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
};

// Media that the browser is allowed to seek inside.
const RANGEABLE = new Set(['.mp4', '.webm']);

// Optional: override the baked-in Supabase credentials with environment variables.
const runtimeConfig = JSON.stringify({
  ...(process.env.SUPABASE_URL      ? { SUPABASE_URL: process.env.SUPABASE_URL } : {}),
  ...(process.env.SUPABASE_ANON_KEY ? { SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY } : {}),
});

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);

    if (pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      return res.end('ok');
    }

    // Run the YouTube refresh now instead of waiting for the nightly hour.
    if (pathname === '/api/yt/refresh') return ytManual(req, res, url);

    // The browser needs the public VAPID key to create a push subscription.
    if (pathname === '/api/push/key') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' });
      return res.end(JSON.stringify({ key: VAPID_PUBLIC }));
    }

    // Send a test notification to the devices already subscribed, so a person
    // can confirm notifications work the moment they turn them on.
    if (pathname === '/api/push/test' && req.method === 'POST') {
      const r = await rpc('push_claim', { p_secret: PUSH_SECRET });
      const { subs = [] } = r.ok ? await r.json() : {};
      const payload = JSON.stringify({
        title: 'Notifications are on',
        body: 'This is what a new fan will look like.',
        url: '/command#fans', tag: 'push-test',
      });
      let sent = 0;
      await Promise.all(subs.map(async s => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
          sent++;
        } catch { /* dead endpoint, cleaned up on the next real round */ }
      }));
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ sent }));
    }

    // Fan capture from a hub → forward to Zah CRM, tagged per artist.
    if (pathname === '/api/capture' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 10_000) break; }
      let p = {};
      try { p = JSON.parse(body); } catch {}
      const artist = String(p.artist || '').slice(0, 80).trim();
      const email  = String(p.email  || '').slice(0, 200).trim();
      const name   = String(p.name   || '').slice(0, 120).trim();
      if (!artist || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        res.writeHead(400, { 'content-type': 'application/json' });
        return res.end('{"error":"artist and a valid email are required"}');
      }
      // Own database first (the team's Fans tab), CRM second (outreach).
      const own = fetch(`${SUPABASE_URL}/rest/v1/hub_captures`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'content-type': 'application/json',
          prefer: 'return=minimal',
        },
        body: JSON.stringify({ artist, name: name || null, email }),
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);
      const crm = fetch(CRM_CAPTURE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name || email,
          email,
          group: `Remnant - ${artist}`,
          source: 'remnant_hub',
          notes: `Joined ${artist}'s list from the Remnant link hub.`,
        }),
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);
      const [ownRes, crmRes] = await Promise.all([own, crm]);
      const ok = !!(ownRes?.ok || crmRes?.ok);
      res.writeHead(ok ? 200 : 502, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok }));
    }

    // The public label page is the front door: it answers / and the old /label.
    // index.html already carries this copy, so only og:url varies by path.
    if (/^\/(label\/?)?$/.test(pathname)) {
      let html = await readFile(join(ROOT, 'index.html'), 'utf8');
      html = html
        .replace(/(property="og:image" content=")[^"]*/, `$1${SITE}/img/og-card.jpg`)
        .replace(/(property="og:url" content=")[^"]*/, `$1${SITE}${pathname === '/' ? '/' : '/label'}`);
      res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-cache' });
      return res.end(html);
    }

    // The Command Center. The one path that serves the internal dashboard, and
    // the only place the internal title and description are used.
    if (/^\/command\/?$/.test(pathname)) {
      const title = 'Tha Remnant Music Group — Label Command Center';
      const desc = 'Live label dashboard: roster, catalog, album ledger, 90-day '
        + 'playbook, budget and weekly tracking.';
      let html = await readFile(join(ROOT, 'index.html'), 'utf8');
      html = html
        .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
        .replace(/(property="og:title" content=")[^"]*/, `$1${title}`)
        .replace(/(name="description" content=")[^"]*/, `$1${desc}`)
        .replace(/(property="og:description" content=")[^"]*/, `$1${desc}`)
        .replace(/(property="og:url" content=")[^"]*/, `$1${SITE}/command`);
      res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-cache' });
      return res.end(html);
    }

    // Hub and profile pages share the SPA shell, each with its own preview.
    const hubMatch = pathname.match(/^\/(a|artist)\/([\w-]+)\/?$/);
    if (hubMatch) {
      const isProfile = hubMatch[1] === 'artist';
      const hub = HUBS[hubMatch[2].toLowerCase()];
      let html = await readFile(join(ROOT, 'index.html'), 'utf8');
      if (hub) {
        const title = `${hub.name} — Tha Remnant Music Group`;
        const desc = isProfile
          ? `${hub.name} on Tha Remnant Music Group: popular tracks, releases, tour dates and more.`
          : `${hub.name}'s official links: music, videos and socials, all in one place.`;
        html = html
          .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
          .replace(/(property="og:title" content=")[^"]*/, `$1${title}`)
          .replace(/(name="description" content=")[^"]*/, `$1${desc}`)
          .replace(/(property="og:description" content=")[^"]*/, `$1${desc}`)
          .replace(/(property="og:image" content=")[^"]*/, `$1${SITE}${hub.image}`)
          .replace(/(property="og:url" content=")[^"]*/,
            `$1${SITE}/${hubMatch[1]}/${hubMatch[2].toLowerCase()}`);
      }
      res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-cache' });
      return res.end(html);
    }

    if (pathname === '/config.js') {
      res.writeHead(200, { 'content-type': TYPES['.js'], 'cache-control': 'no-store' });
      return res.end(`window.__CONFIG__ = ${runtimeConfig};`);
    }

    if (pathname === '/') pathname = '/index.html';

    // Block path traversal.
    const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    const file = join(ROOT, safe);
    if (!file.startsWith(ROOT + sep) && file !== join(ROOT, 'index.html')) {
      res.writeHead(403); return res.end('Forbidden');
    }

    let info;
    try {
      info = await stat(file);
      if (!info.isFile()) throw new Error('not a file');
    } catch {
      /* A missing FILE has to 404. Handing back index.html for it was actively
         harmful once Cloudflare went in front of this server: Cloudflare caches by
         URL extension, and because this fallback sent 200 + HTML with no
         cache-control, Cloudflare stored that HTML under `/js/gate.js` with
         max-age=14400 and served it for four hours. The origin was correct the
         whole time and /command was broken anyway. Any missing asset could poison
         the edge the same way.

         A 200 also hides deploy gaps: the file looks present and only its content
         type gives it away, which is why deployed assets have to be checked by
         content_type and never by status code.

         Extensionless paths are app routes, so they still get the shell. */
      if (extname(pathname)) {
        res.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
        return res.end('Not found');
      }
      const body = await readFile(join(ROOT, 'index.html'));
      res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-cache' });
      return res.end(body);
    }

    const ext = extname(file).toLowerCase();
    const type = TYPES[ext] || 'application/octet-stream';

    /* Byte ranges, for video only.
       Without this a browser reports the file as unseekable: `video.seekable`
       stays empty and assigning `currentTime` silently does nothing, which is
       exactly what broke the scroll-driven scenes on the label page. Streaming
       the slice also keeps a multi-megabyte clip out of memory. */
    if (RANGEABLE.has(ext)) {
      const total = info.size;
      const range = req.headers.range;
      const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (m) {
        let start = m[1] === '' ? null : Number(m[1]);
        let end   = m[2] === '' ? null : Number(m[2]);
        // "bytes=-500" means the last 500 bytes, not a range starting at zero.
        if (start === null) { start = Math.max(0, total - (end || 0)); end = total - 1; }
        if (end === null || end >= total) end = total - 1;
        if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= total) {
          res.writeHead(416, { 'content-range': `bytes */${total}` });
          return res.end();
        }
        res.writeHead(206, {
          'content-type': type,
          'content-length': end - start + 1,
          'content-range': `bytes ${start}-${end}/${total}`,
          'accept-ranges': 'bytes',
          'cache-control': 'public, max-age=3600',
        });
        return createReadStream(file, { start, end }).pipe(res);
      }
      res.writeHead(200, {
        'content-type': type,
        'content-length': total,
        'accept-ranges': 'bytes',
        'cache-control': 'public, max-age=3600',
      });
      return createReadStream(file).pipe(res);
    }

    const body = await readFile(file);
    // Code (html/css/js) is always fetched fresh so every deploy is visible
    // immediately — at this size the bytes are trivial, and a 5-minute stale
    // window meant mismatched UI right after each push. Images may cache.
    const cache = ['.png', '.jpg', '.jpeg', '.svg', '.ico'].includes(ext)
      ? 'public, max-age=3600'
      : 'no-cache';
    res.writeHead(200, { 'content-type': type, 'cache-control': cache });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Server error: ' + err.message);
  }
});

server.listen(PORT, () => {
  console.log(`Tha Remnant Command Center → http://localhost:${PORT}`);
});
