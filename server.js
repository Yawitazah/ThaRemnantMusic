// Zero-dependency static server for the Label Command Center.
// Run locally:  node server.js        →  http://localhost:3000
// On Railway:   picked up automatically via `npm start`, binds process.env.PORT.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const PORT = process.env.PORT || 3000;

/* Public artist link hubs live at /a/{slug}. Fan email capture posts here and
   is forwarded server-side to Zah CRM (the browser can't cross-origin POST).
   The slug map also personalises the share preview for each hub. */
const CRM_CAPTURE_URL =
  process.env.CRM_CAPTURE_URL || 'https://zahcrm.com/api/card/zah/capture';
// Captures also land in the label's own database so the whole team sees every
// fan in the dashboard's Fans tab. The publishable key is public by design;
// row-level security only allows inserts here.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://upfqppdfckqehzgsosdi.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_c0j0FTpd3X-joAr673KR4A_NmMGSP7u';
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
  '.ico':  'image/x-icon',
};

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

    // Hub pages share the SPA shell, but each gets its own share preview.
    const hubMatch = pathname.match(/^\/a\/([\w-]+)\/?$/);
    if (hubMatch) {
      const hub = HUBS[hubMatch[1].toLowerCase()];
      let html = await readFile(join(ROOT, 'index.html'), 'utf8');
      if (hub) {
        const title = `${hub.name} — Tha Remnant Music Group`;
        const desc = `${hub.name}'s official links: music, videos and socials, all in one place.`;
        html = html
          .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
          .replace(/(property="og:title" content=")[^"]*/, `$1${title}`)
          .replace(/(name="description" content=")[^"]*/, `$1${desc}`)
          .replace(/(property="og:description" content=")[^"]*/, `$1${desc}`)
          .replace(/(property="og:image" content=")[^"]*/,
            `$1https://command-center-production-cc6b.up.railway.app${hub.image}`)
          .replace(/(property="og:url" content=")[^"]*/,
            `$1https://command-center-production-cc6b.up.railway.app/a/${hubMatch[1].toLowerCase()}`);
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

    let body;
    try {
      const s = await stat(file);
      if (!s.isFile()) throw new Error('not a file');
      body = await readFile(file);
    } catch {
      // SPA fallback
      body = await readFile(join(ROOT, 'index.html'));
      res.writeHead(200, { 'content-type': TYPES['.html'] });
      return res.end(body);
    }

    const ext = extname(file).toLowerCase();
    const type = TYPES[ext] || 'application/octet-stream';
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
