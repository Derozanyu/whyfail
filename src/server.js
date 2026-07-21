import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listRuns, loadRun } from './storage.js';
import { repairEligibility, startRepairSession } from './repair.js';

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };

export function startServer({ port = 3967, host = '127.0.0.1' } = {}) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || host}`);
    const repairMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/repair$/);
    if (req.method === 'POST' && repairMatch) {
      return handleRepair(req, res, decodeURIComponent(repairMatch[1]), host);
    }
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
  return { id: run.id, command: run.command, status: run.status, startedAt: run.startedAt, durationMs: run.durationMs, ecosystem: run.context?.ecosystem, repairStatus: run.blackBox?.repairSession?.status || null, diagnosis: run.diagnosis ? { code: run.diagnosis.code, confidence: run.diagnosis.confidence, title: run.diagnosis.title } : null };
}

async function handleRepair(req, res, runId, host) {
  const expectedOrigin = `http://${req.headers.host || host}`;
  if (req.headers.origin && req.headers.origin !== expectedOrigin) return json(res, { error: 'Invalid origin' }, 403);
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    return json(res, { error: 'Content-Type must be application/json' }, 415);
  }
  const run = loadRun(runId);
  const eligibility = repairEligibility(run);
  if (!eligibility.ok) return json(res, { error: eligibility.reason }, 409);
  try {
    const body = await readJson(req);
    const instruction = String(body.instruction || '');
    if (instruction.length > 4000) return json(res, { error: 'Instruction is limited to 4000 characters.' }, 400);
    const maxAttempts = Math.min(5, Math.max(1, Number(body.maxAttempts || 3)));
    startRepairSession(runId, { instruction, maxAttempts }).catch(() => {});
    return json(res, { accepted: true, runId }, 202);
  } catch (error) {
    return json(res, { error: error.message }, 400);
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 16 * 1024) {
        req.destroy();
        reject(new Error('Request body is too large.'));
      }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('Invalid JSON body.')); }
    });
    req.on('error', reject);
  });
}

function json(res, value, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}
