// Static server + analytics API — no dependencies.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeStore, aggregate } from './analytics.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT) || 4173;
// Optional: set ANALYTICS_KEY to require ?key=... for reading analytics (event
// logging stays open — the app itself must be able to post). Recommended if the
// site is ever hosted publicly.
const ANALYTICS_KEY = process.env.ANALYTICS_KEY || '';
const store = makeStore(root);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8',
};

function readBody(req, capBytes) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > capBytes) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
const sendJSON = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let path = decodeURIComponent(url.pathname);

    // ---- analytics API ----
    if (path === '/api/event' && req.method === 'POST') {
      try {
        const ok = await store.record(JSON.parse(await readBody(req, 8192)));
        res.writeHead(ok ? 204 : 400); res.end();
      } catch { res.writeHead(400); res.end(); }
      return;
    }
    if (path === '/api/analytics' && req.method === 'GET') {
      if (ANALYTICS_KEY && url.searchParams.get('key') !== ANALYTICS_KEY) {
        sendJSON(res, 403, { error: 'analytics key required (?key=...)' }); return;
      }
      const num = (name, dflt) => {
        const v = parseFloat(url.searchParams.get(name));
        return Number.isFinite(v) ? v : dflt;
      };
      const events = await store.loadEvents();
      sendJSON(res, 200, aggregate(events, {
        from: num('from', 0), to: num('to', Infinity), tzOffsetMin: num('tz', 0),
      }));
      return;
    }
    // Local static development uses the production read-only Overture endpoint so it
    // exercises the same footprint source without requiring local R2/D1 bindings.
    if (path === '/api/buildings' && req.method === 'GET') {
      const upstream = new URL('/api/buildings' + url.search, 'https://tchumshabbos.com');
      const response = await fetch(upstream, { headers: { Accept: 'application/json' } });
      const body = Buffer.from(await response.arrayBuffer());
      res.writeHead(response.status, {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(body);
      return;
    }
    if (path === '/api/building-corrections' && req.method === 'POST') {
      await readBody(req, 32000);
      sendJSON(res, 201, { id: 'local-preview', status: 'pending' });
      return;
    }

    // ---- static files ----
    if (path === '/') path = '/index.html';
    if (path === '/analytics') path = '/analytics.html';
    if (path === '/about') path = '/about.html';
    if (path === '/designtest' || path === '/designtest/') path = '/designtest/index.html';
    if (/^\/designtest\/[1-5]\/?$/.test(path)) path = path.replace(/\/$/, '') + '/index.html';
    if (path.startsWith('/data/')) { res.writeHead(403); res.end(); return; } // logged events are not public
    const file = normalize(join(root, path));
    const rel = relative(root, file);
    const segments = rel.split(/[\\/]+/);
    if (!rel || rel.startsWith('..' + sep) || isAbsolute(rel) || segments.some((segment) => segment.startsWith('.'))) {
      res.writeHead(403); res.end(); return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache', // always revalidate — stale app code must never draw a techum
    });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(port, () => console.log(`techum calculator on http://localhost:${port}`));
