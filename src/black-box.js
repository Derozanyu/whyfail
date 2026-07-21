import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { redact } from './redact.js';

const PROJECT_FILES = new Set([
  'package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock',
  'pyproject.toml', 'requirements.txt', 'poetry.lock', 'Pipfile', 'Pipfile.lock',
  'Cargo.toml', 'Cargo.lock', 'go.mod', 'go.sum', 'pom.xml', 'build.gradle', 'build.gradle.kts',
  'gradle.properties', 'Gemfile', 'Gemfile.lock', 'composer.json', 'composer.lock',
  'Package.swift', 'Package.resolved', 'CMakeLists.txt', 'cjpm.toml', 'cjpm.lock',
  'Dockerfile', 'docker-compose.yml', 'compose.yml'
]);

const SOURCE_EXTENSIONS = new Set([
  '.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx', '.py', '.rs', '.go', '.java', '.kt', '.kts',
  '.c', '.cc', '.cpp', '.cxx', '.h', '.hpp', '.cs', '.rb', '.php', '.swift', '.cj',
  '.json', '.yaml', '.yml', '.toml', '.xml'
]);

const IGNORED_DIRECTORIES = new Set([
  '.git', '.hg', '.svn', 'node_modules', 'vendor', 'target', 'dist', 'build', 'out',
  '.next', '.nuxt', '.venv', 'venv', '__pycache__', '.idea', '.vscode'
]);

const SAFE_ENV_NAMES = new Set([
  'CI', 'NODE_ENV', 'BABEL_ENV', 'PYTHONPATH', 'PYTHONHOME', 'VIRTUAL_ENV', 'CONDA_PREFIX',
  'JAVA_HOME', 'GRADLE_HOME', 'MAVEN_HOME', 'CARGO_HOME', 'RUSTUP_HOME', 'GOROOT', 'GOPATH',
  'DOTNET_ROOT', 'CJ_HOME', 'CANGJIE_HOME', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY',
  'npm_config_registry', 'NPM_CONFIG_REGISTRY'
]);

export function captureBlackBox(cwd, phase = 'after') {
  const capturedAt = new Date();
  return {
    version: 1,
    phase,
    capturedAt: capturedAt.toISOString(),
    host: captureHost(),
    disk: captureDisk(cwd),
    environment: captureEnvironment(),
    git: captureGit(cwd),
    projectFiles: captureProjectFiles(cwd),
    recentFiles: captureRecentFiles(cwd, capturedAt.getTime())
  };
}

export function buildBlackBox(before, after, baselineRun = null) {
  const baseline = baselineRun?.blackBox?.after || baselineRun?.blackBox?.before || null;
  return {
    version: 1,
    before,
    after,
    executionDelta: compareExecution(before, after),
    baseline: baselineRun && baseline ? {
      runId: baselineRun.id,
      capturedAt: baseline.capturedAt,
      changes: compareSnapshots(baseline, before)
    } : null
  };
}

export function compareSnapshots(previous, current) {
  if (!previous || !current) return [];
  const changes = [];
  addChange(changes, 'runtime', 'Node.js', previous.host?.nodeVersion, current.host?.nodeVersion);
  addChange(changes, 'runtime', 'OS', previous.host?.platform, current.host?.platform);
  addChange(changes, 'git', 'branch', previous.git?.branch, current.git?.branch);
  addChange(changes, 'git', 'commit', short(previous.git?.commit), short(current.git?.commit));
  addChange(changes, 'git', 'working tree', dirtyLabel(previous.git), dirtyLabel(current.git));

  const previousEnv = new Set(previous.environment?.present || []);
  const currentEnv = new Set(current.environment?.present || []);
  for (const name of [...currentEnv].filter((item) => !previousEnv.has(item)).sort()) {
    changes.push({ category: 'environment', key: name, before: 'missing', after: 'present' });
  }
  for (const name of [...previousEnv].filter((item) => !currentEnv.has(item)).sort()) {
    changes.push({ category: 'environment', key: name, before: 'present', after: 'missing' });
  }

  const previousFiles = new Map((previous.projectFiles || []).map((item) => [item.path, item]));
  const currentFiles = new Map((current.projectFiles || []).map((item) => [item.path, item]));
  for (const name of [...new Set([...previousFiles.keys(), ...currentFiles.keys()])].sort()) {
    const oldFile = previousFiles.get(name);
    const newFile = currentFiles.get(name);
    if (!oldFile) changes.push({ category: 'project-file', key: name, before: 'missing', after: `added (${newFile.hash})` });
    else if (!newFile) changes.push({ category: 'project-file', key: name, before: `present (${oldFile.hash})`, after: 'missing' });
    else if (oldFile.hash !== newFile.hash) changes.push({ category: 'project-file', key: name, before: oldFile.hash, after: newFile.hash });
  }
  return changes.slice(0, 40);
}

function captureHost() {
  const cpus = os.cpus();
  return {
    platform: `${os.platform()} ${os.release()} (${os.arch()})`,
    nodeVersion: process.version,
    cpuCount: cpus.length,
    cpuModel: redact(cpus[0]?.model || 'unknown'),
    totalMemoryBytes: os.totalmem(),
    freeMemoryBytes: os.freemem(),
    loadAverage: os.loadavg().map((value) => Number(value.toFixed(2))),
    uptimeSeconds: Math.round(os.uptime())
  };
}

function captureDisk(cwd) {
  try {
    const stat = fs.statfsSync(cwd);
    return {
      path: redact(path.resolve(cwd)),
      totalBytes: stat.blocks * stat.bsize,
      freeBytes: stat.bavail * stat.bsize
    };
  } catch {
    return { path: redact(path.resolve(cwd)), unavailable: true };
  }
}

function captureEnvironment() {
  const present = [...SAFE_ENV_NAMES].filter((name) => process.env[name] !== undefined).sort();
  return {
    present,
    valuesStored: false,
    pathEntryCount: String(process.env.PATH || '').split(path.delimiter).filter(Boolean).length,
    ci: Boolean(process.env.CI),
    proxyConfigured: Boolean(process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.https_proxy)
  };
}

function captureGit(cwd) {
  const rootResult = git(cwd, ['rev-parse', '--show-toplevel']);
  if (!rootResult.ok) return { available: false };
  const root = rootResult.stdout;
  const branch = git(cwd, ['branch', '--show-current']);
  const commit = git(cwd, ['rev-parse', 'HEAD']);
  const status = git(cwd, ['status', '--porcelain=v1', '--untracked-files=normal']);
  const changedFiles = status.ok
    ? status.stdout.split(/\r?\n/).filter(Boolean).slice(0, 50).map((line) => redact(line))
    : [];
  return {
    available: true,
    root: redact(root),
    branch: branch.ok ? branch.stdout || '(detached)' : 'unknown',
    commit: commit.ok ? commit.stdout : 'unknown',
    dirty: changedFiles.length > 0,
    changedFiles,
    truncated: status.ok && status.stdout.split(/\r?\n/).filter(Boolean).length > changedFiles.length
  };
}

function captureProjectFiles(cwd) {
  let entries = [];
  try { entries = fs.readdirSync(cwd, { withFileTypes: true }); } catch { return []; }
  return entries
    .filter((entry) => entry.isFile() && (PROJECT_FILES.has(entry.name) || /\.(?:sln|csproj)$/i.test(entry.name)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 40)
    .map((entry) => fileRecord(cwd, entry.name))
    .filter(Boolean);
}

function captureRecentFiles(cwd, now) {
  const files = [];
  const queue = [{ dir: cwd, depth: 0 }];
  let visited = 0;
  while (queue.length && visited < 1500) {
    const { dir, depth } = queue.shift();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (++visited > 1500) break;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory() && depth < 4 && !IGNORED_DIRECTORIES.has(entry.name) && !entry.name.startsWith('.whyfail')) {
        queue.push({ dir: absolute, depth: depth + 1 });
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        try {
          const stat = fs.statSync(absolute);
          if (now - stat.mtimeMs <= 24 * 60 * 60 * 1000) {
            files.push({ path: redact(path.relative(cwd, absolute)), modifiedAt: stat.mtime.toISOString(), sizeBytes: stat.size });
          }
        } catch {}
      }
    }
  }
  return files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)).slice(0, 20);
}

function fileRecord(cwd, name) {
  try {
    const absolute = path.join(cwd, name);
    const stat = fs.statSync(absolute);
    if (stat.size > 8 * 1024 * 1024) {
      return { path: redact(name), sizeBytes: stat.size, modifiedAt: stat.mtime.toISOString(), hash: 'too-large' };
    }
    const hash = crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex').slice(0, 12);
    return { path: redact(name), sizeBytes: stat.size, modifiedAt: stat.mtime.toISOString(), hash };
  } catch {
    return null;
  }
}

function compareExecution(before, after) {
  return {
    freeMemoryBytes: numberDelta(before?.host?.freeMemoryBytes, after?.host?.freeMemoryBytes),
    freeDiskBytes: numberDelta(before?.disk?.freeBytes, after?.disk?.freeBytes),
    projectFilesChanged: compareSnapshots(before, after).filter((item) => item.category === 'project-file')
  };
}

function git(cwd, args) {
  try {
    const result = spawnSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 2000,
      maxBuffer: 256 * 1024
    });
    return { ok: result.status === 0, stdout: String(result.stdout || '').trim() };
  } catch {
    return { ok: false, stdout: '' };
  }
}

function addChange(changes, category, key, before, after) {
  if (before !== undefined && after !== undefined && String(before) !== String(after)) {
    changes.push({ category, key, before: String(before), after: String(after) });
  }
}

function numberDelta(before, after) {
  return Number.isFinite(before) && Number.isFinite(after) ? after - before : null;
}

function short(value) {
  return value && value !== 'unknown' ? String(value).slice(0, 10) : value;
}

function dirtyLabel(value) {
  if (!value?.available) return 'unavailable';
  return value.dirty ? 'modified' : 'clean';
}
