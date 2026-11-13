// Local stand-in for Vercel's routing in vercel.json: existing files come from public/,
// /api/* goes to the API function, and /app* and /admin* get index.html.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import api from '../api/index.js';

const PUBLIC_DIR = new URL('../public/', import.meta.url).pathname;
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
const port = Number(process.env.PORT) || 3000;

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith('/api/')) {
      const hasBody = !['GET', 'HEAD'].includes(req.method);
      const request = new Request(url, { method: req.method, headers: req.headers, body: hasBody ? req : undefined, duplex: 'half' });
      const response = await api.fetch(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    let file = join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
    let content = await readFile(file).catch(() => null);
    if (!content && /^\/(app|admin)(\/|$)/.test(url.pathname)) {
      file = join(PUBLIC_DIR, 'index.html');
      content = await readFile(file);
    }
    if (!content) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES[extname(file)] || 'application/octet-stream' });
    res.end(content);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Dev server error: ${error.message}`);
  }
}).listen(port, () => console.log(`XORVAI dev server on http://localhost:${port}`));
