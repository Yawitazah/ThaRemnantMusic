// Zero-dependency static server for the Label Command Center.
// Run locally:  node server.js        →  http://localhost:3000
// On Railway:   picked up automatically via `npm start`, binds process.env.PORT.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const PORT = process.env.PORT || 3000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
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
