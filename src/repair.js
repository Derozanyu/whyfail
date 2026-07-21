import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { dataDir, loadRun, saveRun } from './storage.js';
import { runCommand } from './runner.js';
import { redact } from './redact.js';
import { restoreLocalPath } from './verify.js';

const activeRepairs = new Map();
const SKIP_DIRECTORIES = new Set([
  '.git', '.hg', '.svn', '.whyfail', 'coverage', 'dist', 'build', 'out', 'target',
  '.next', '.nuxt', '__pycache__', '.pytest_cache'
]);
const SHARED_RUNTIME_DIRECTORIES = ['node_modules', '.venv', 'venv'];
const MAX_INVENTORY_FILES = 5000;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const ENVIRONMENT_CODES = new Set(['address_in_use', 'permission_denied']);

export function repairEligibility(run) {
  if (!run) return { ok: false, reason: 'Run not found.' };
  if (run.status !== 'failed') return { ok: false, reason: 'Only failed runs can start an Agent repair.' };
  if (run.kind !== 'command' || !Array.isArray(run.commandParts) || !run.commandParts.length) {
    return { ok: false, reason: 'Open a failed child command report. Imported logs and suite summaries cannot be repaired directly.' };
  }
  if (run.blackBox?.repairSession?.status === 'running') return { ok: false, reason: 'A repair is already running for this report.' };
  const cwd = restoreLocalPath(run.cwd);
  if (!cwd || !fs.existsSync(cwd)) return { ok: false, reason: `Original working directory is unavailable: ${run.cwd}` };
  return { ok: true, cwd };
}

export function isRepairActive(runId) {
  return activeRepairs.has(runId);
}

export function startRepairSession(runId, options = {}) {
  if (activeRepairs.has(runId)) return activeRepairs.get(runId);
  const promise = executeRepairSession(runId, options).finally(() => activeRepairs.delete(runId));
  activeRepairs.set(runId, promise);
  return promise;
}

async function executeRepairSession(runId, options) {
  const original = loadRun(runId);
  const eligibility = repairEligibility(original);
  if (!eligibility.ok) throw new Error(eligibility.reason);

  const instruction = redact(String(options.instruction || '').trim()).slice(0, 4000);
  const maxAttempts = clamp(Number(options.maxAttempts || 3), 1, 5);
  const repairId = makeRepairId();
  const root = path.join(dataDir(), 'repairs', repairId);
  const workspace = path.join(root, 'workspace');
  fs.mkdirSync(root, { recursive: true });
  copyProject(eligibility.cwd, workspace, root);

  const session = {
    id: repairId,
    status: 'running',
    originalRunId: original.id,
    startedAt: new Date().toISOString(),
    endedAt: null,
    mode: 'isolated-copy',
    workspace: redact(workspace),
    originalProjectUntouched: true,
    userInstruction: instruction,
    maxAttempts,
    agent: agentDescriptor(options),
    attempts: [],
    finalRunId: null,
    stopReason: null
  };
  attachSession(original, session);

  let inventory = captureInventory(workspace);
  let previousDiagnosis = original.diagnosis?.code || 'unknown';
  try {
    for (let number = 1; number <= maxAttempts; number += 1) {
      const attempt = {
        number,
        status: 'agent-running',
        startedAt: new Date().toISOString(),
        endedAt: null,
        diagnosisBefore: previousDiagnosis,
        agentOutput: '',
        agentError: '',
        agentExitCode: null,
        changedFiles: [],
        verificationRunId: null,
        verificationStatus: null,
        diagnosisAfter: null
      };
      session.attempts.push(attempt);
      attachSession(original, session);

      const prompt = buildAgentPrompt(original, session, attempt);
      const agentResult = await invokeAgent(workspace, prompt, options);
      attempt.agentExitCode = agentResult.exitCode;
      attempt.agentOutput = redact(agentResult.stdout).slice(-20000);
      attempt.agentError = redact(agentResult.stderr).slice(-12000);
      if (agentResult.spawnError || agentResult.exitCode !== 0) {
        attempt.status = agentResult.spawnError ? 'agent-unavailable' : 'agent-failed';
        attempt.endedAt = new Date().toISOString();
        session.status = agentResult.spawnError ? 'agent_unavailable' : 'agent_failed';
        session.stopReason = redact(agentResult.spawnError || `Agent exited with code ${agentResult.exitCode}.`);
        break;
      }

      const nextInventory = captureInventory(workspace);
      attempt.changedFiles = compareInventories(inventory, nextInventory);
      inventory = nextInventory;
      attempt.status = 'verifying';
      attachSession(original, session);

      const validationParts = remapCommandParts(original.commandParts, eligibility.cwd, workspace);
      linkRuntimeDirectories(eligibility.cwd, workspace);
      let validation;
      try {
        validation = await runCommand(validationParts, { cwd: workspace, quiet: true });
      } finally {
        unlinkRuntimeDirectories(workspace);
      }
      attempt.verificationRunId = validation.id;
      attempt.verificationStatus = validation.status;
      attempt.diagnosisAfter = validation.diagnosis?.code || 'unknown';
      attempt.endedAt = new Date().toISOString();
      session.finalRunId = validation.id;

      if (validation.status === 'passed') {
        attempt.status = 'resolved';
        session.status = 'resolved';
        session.stopReason = 'The exact saved command completed successfully in the isolated workspace.';
        break;
      }

      if (!attempt.changedFiles.length) {
        attempt.status = 'no-progress';
        session.status = ENVIRONMENT_CODES.has(attempt.diagnosisAfter) ? 'blocked_environment' : 'agent_stalled';
        session.stopReason = ENVIRONMENT_CODES.has(attempt.diagnosisAfter)
          ? `The failure remained ${attempt.diagnosisAfter} and no project files changed.`
          : 'The Agent made no project-file changes, so another automatic attempt would repeat the same state.';
        break;
      }

      attempt.status = 'failed-verification';
      previousDiagnosis = attempt.diagnosisAfter;
      if (number === maxAttempts) {
        session.status = 'attempts_exhausted';
        session.stopReason = `The verification command still failed after ${maxAttempts} attempts.`;
      }
      attachSession(original, session);
    }
  } catch (error) {
    session.status = 'internal_error';
    session.stopReason = redact(error.message);
  }

  session.endedAt = new Date().toISOString();
  attachSession(original, session);
  return session;
}

function attachSession(run, session) {
  run.blackBox ||= { version: 1 };
  const existing = run.blackBox.repairSession;
  if (existing && existing.id !== session.id) {
    run.blackBox.repairHistory ||= [];
    if (!run.blackBox.repairHistory.some((item) => item.id === existing.id)) {
      run.blackBox.repairHistory.push(existing);
    }
  }
  run.blackBox.repairSession = session;
  saveRun(run);
}

function copyProject(source, destination, repairRoot) {
  const resolvedRepairRoot = path.resolve(repairRoot);
  const resolvedDataRoot = path.resolve(dataDir());
  fs.cpSync(source, destination, {
    recursive: true,
    force: true,
    filter: (item) => {
      const resolved = path.resolve(item);
      if (resolved === resolvedRepairRoot || resolved.startsWith(`${resolvedRepairRoot}${path.sep}`)) return false;
      if (resolved === resolvedDataRoot || resolved.startsWith(`${resolvedDataRoot}${path.sep}`)) return false;
      const name = path.basename(item);
      if (name.startsWith('.whyfail')) return false;
      if (isSensitiveFile(name)) return false;
      if (SKIP_DIRECTORIES.has(name) || SHARED_RUNTIME_DIRECTORIES.includes(name)) return false;
      try { if (fs.lstatSync(item).isSymbolicLink()) return false; } catch {}
      return true;
    }
  });
}

function linkRuntimeDirectories(source, destination) {
  for (const name of SHARED_RUNTIME_DIRECTORIES) {
    const sourceRuntime = path.join(source, name);
    const targetRuntime = path.join(destination, name);
    if (!fs.existsSync(sourceRuntime) || fs.existsSync(targetRuntime)) continue;
    try { fs.symlinkSync(sourceRuntime, targetRuntime, 'junction'); } catch {}
  }
}

function unlinkRuntimeDirectories(workspace) {
  for (const name of SHARED_RUNTIME_DIRECTORIES) {
    const target = path.join(workspace, name);
    try {
      if (fs.lstatSync(target).isSymbolicLink()) fs.unlinkSync(target);
    } catch {}
  }
}

function isSensitiveFile(name) {
  const lower = name.toLowerCase();
  if (lower === '.env' || (lower.startsWith('.env.') && !lower.endsWith('.example') && !lower.endsWith('.sample'))) return true;
  if (['.npmrc', '.pypirc', 'id_rsa', 'id_ed25519', 'credentials', 'credentials.json'].includes(lower)) return true;
  return /\.(?:pem|p12|pfx|key)$/i.test(lower) || /^(?:secret|secrets|credentials)\./i.test(lower);
}

function captureInventory(root) {
  const result = new Map();
  const queue = [root];
  let visited = 0;
  while (queue.length && visited < MAX_INVENTORY_FILES) {
    const directory = queue.shift();
    let entries;
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (++visited > MAX_INVENTORY_FILES) break;
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name) && !SHARED_RUNTIME_DIRECTORIES.includes(entry.name)) queue.push(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        const stat = fs.statSync(absolute);
        if (stat.size > MAX_TEXT_BYTES) continue;
        const buffer = fs.readFileSync(absolute);
        if (buffer.includes(0)) continue;
        const relative = path.relative(root, absolute);
        result.set(relative, {
          hash: crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 12),
          sizeBytes: stat.size
        });
      } catch {}
    }
  }
  return result;
}

function compareInventories(before, after) {
  const changes = [];
  const files = [...new Set([...before.keys(), ...after.keys()])].sort();
  for (const file of files) {
    const oldValue = before.get(file);
    const newValue = after.get(file);
    if (!oldValue) changes.push({ path: redact(file), kind: 'added', beforeHash: null, afterHash: newValue.hash });
    else if (!newValue) changes.push({ path: redact(file), kind: 'deleted', beforeHash: oldValue.hash, afterHash: null });
    else if (oldValue.hash !== newValue.hash) changes.push({ path: redact(file), kind: 'modified', beforeHash: oldValue.hash, afterHash: newValue.hash });
  }
  return changes.slice(0, 200);
}

function invokeAgent(cwd, prompt, options) {
  const command = options.agentCommand || process.env.WHYFAIL_AGENT_COMMAND || 'codex';
  const args = resolveAgentArgs(cwd, options.agentArgs);
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let child;
    let timer;
    try {
      child = spawn(command, args, {
        cwd,
        shell: false,
        windowsHide: true,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (error) {
      resolve({ exitCode: null, stdout, stderr, spawnError: error.message });
      return;
    }
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    child.stdout.on('data', (chunk) => { stdout = appendBounded(stdout, chunk.toString(), 200000); });
    child.stderr.on('data', (chunk) => { stderr = appendBounded(stderr, chunk.toString(), 120000); });
    child.on('error', (error) => finish({ exitCode: null, stdout, stderr, spawnError: error.message }));
    child.on('close', (exitCode) => finish({ exitCode, stdout, stderr, spawnError: null }));
    child.stdin.on('error', () => {});
    child.stdin.end(prompt);
    const timeoutMs = clamp(Number(options.agentTimeoutMs || 5 * 60 * 1000), 1000, 30 * 60 * 1000);
    timer = setTimeout(() => {
      child.kill();
      finish({ exitCode: null, stdout, stderr: `${stderr}\nAgent timed out after ${timeoutMs}ms.`, spawnError: 'Agent timeout' });
    }, timeoutMs);
  });
}

function resolveAgentArgs(cwd, provided) {
  let args = provided;
  if (!args && process.env.WHYFAIL_AGENT_ARGS) {
    try { args = JSON.parse(process.env.WHYFAIL_AGENT_ARGS); } catch {
      throw new Error('WHYFAIL_AGENT_ARGS must be a JSON array.');
    }
  }
  if (!args) args = ['exec', '--sandbox', 'workspace-write', '--skip-git-repo-check', '-C', '{cwd}', '-'];
  if (!Array.isArray(args)) throw new Error('Agent arguments must be an array.');
  return args.map((value) => String(value).replaceAll('{cwd}', cwd));
}

function buildAgentPrompt(original, session, attempt) {
  const diagnosis = original.diagnosis || {};
  const evidence = (diagnosis.evidence || []).join('\n');
  const previous = session.attempts.slice(0, -1).map((item) =>
    `Attempt ${item.number}: changed ${item.changedFiles.length} file(s), verification=${item.verificationStatus}, diagnosis=${item.diagnosisAfter}`
  ).join('\n');
  return `You are repairing a project inside an isolated workspace created by WhyFail.

Modify files only inside the current workspace. Do not install or uninstall dependencies, do not change files inside node_modules/.venv/venv, do not use network access, do not publish, and do not run git push. WhyFail will run the saved verification command after you finish.

User instructions:
${session.userInstruction || 'Use the smallest safe source-code change that fixes the captured failure. Avoid unrelated refactors.'}

Saved command:
${original.command}

Diagnosis code:
${attempt.diagnosisBefore}

Diagnosis:
${textOf(diagnosis.title)}
${textOf(diagnosis.explanation)}

Captured evidence:
${evidence}

Relevant source locations:
${(original.context?.sourceFrames || []).map((item) => `${item.file}:${item.line}:${item.column || 1}`).join('\n') || '(none captured)'}

Previous repair attempts:
${previous || '(none)'}

Inspect the workspace, make the repair, and finish. Keep changes minimal and do not merely hide or delete failing checks.`;
}

function remapCommandParts(parts, originalRoot, workspace) {
  const normalizedRoot = path.resolve(originalRoot);
  return parts.map((part) => {
    const value = String(part);
    if (!path.isAbsolute(value)) return value;
    const absolute = path.resolve(value);
    const relative = path.relative(normalizedRoot, absolute);
    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) return path.join(workspace, relative);
    if (absolute === normalizedRoot) return workspace;
    return value;
  });
}

function agentDescriptor(options) {
  return {
    command: redact(options.agentCommand || process.env.WHYFAIL_AGENT_COMMAND || 'codex'),
    configuredBy: options.agentCommand || process.env.WHYFAIL_AGENT_COMMAND ? 'custom' : 'builtin-codex-adapter'
  };
}

function textOf(value) {
  if (typeof value === 'string') return value;
  return value?.en || value?.['zh-CN'] || '';
}

function appendBounded(current, addition, limit) {
  const value = current + addition;
  return value.length > limit ? value.slice(-limit) : value;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

function makeRepairId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
  return `repair_${stamp}_${Math.random().toString(36).slice(2, 7)}`;
}
