import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assessSuccess } from './success.js';

export function dataDir() {
  if (process.env.WHYFAIL_DATA_DIR) return path.resolve(process.env.WHYFAIL_DATA_DIR);
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'WhyFail');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'WhyFail');
  }
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'whyfail');
}

export function ensureDataDirs() {
  const root = dataDir();
  fs.mkdirSync(path.join(root, 'runs'), { recursive: true });
  return root;
}

export function makeRunId(date = new Date()) {
  const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
  return `run_${stamp}_${Math.random().toString(36).slice(2, 6)}`;
}

export function saveRun(run) {
  const root = ensureDataDirs();
  const dir = path.join(root, 'runs', run.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify(run, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'stdout.log'), run.stdout || '', 'utf8');
  fs.writeFileSync(path.join(dir, 'stderr.log'), run.stderr || '', 'utf8');
  return dir;
}

export function listRuns() {
  const root = ensureDataDirs();
  return fs.readdirSync(path.join(root, 'runs'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => loadRun(entry.name))
    .filter(Boolean)
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
}

export function loadRun(id) {
  const file = path.join(ensureDataDirs(), 'runs', id, 'run.json');
  if (!fs.existsSync(file)) return null;
  try {
    const run = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (run.status === 'passed' && !run.diagnosis) run.diagnosis = assessSuccess(run);
    return run;
  } catch {
    return null;
  }
}
