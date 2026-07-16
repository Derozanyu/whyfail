import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listRuns, loadRun } from './storage.js';

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };

export function startServer({ port = 3967, host = '127.0.0.1' } = {}) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || host}`);
    if (url.pathname === '/api/runs') return json(res, listRuns().map(summary));
    if (url.pathname.startsWith('/api/runs/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/runs/'.length));
      const run = loadRun(id);
      return run ? json(res, run) : json(res, { error: 'Not found' }, 404);
    }
    let requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (requested.includes('..')) return json(res, { error: 'Invalid path' }, 400);
    let file = path.join(publicDir, requested);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(publicDir, 'index.html');
    try {
      res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    } catch {
      json(res, { error: 'Not found' }, 404);
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve({ server, url: `http://${host}:${server.address().port}` }));
  });
}

function summary(run) {
  return { id: run.id, command: run.command, status: run.status, startedAt: run.startedAt, durationMs: run.durationMs, ecosystem: run.context?.ecosystem, diagnosis: run.diagnosis ? { code: run.diagnosis.code, confidence: run.diagnosis.confidence, title: run.diagnosis.title } : null };
}

function json(res, value, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}
