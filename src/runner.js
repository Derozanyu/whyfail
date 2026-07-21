import { spawn } from 'node:child_process';
import { buildBlackBox, captureBlackBox } from './black-box.js';
import { collectContext } from './context.js';
import { diagnose } from './diagnose.js';
import { findLastSuccessfulRun, makeRunId, saveRun } from './storage.js';
import { redact } from './redact.js';
import { assessSuccess } from './success.js';

export async function runCommand(commandParts, options = {}) {
  if (!commandParts.length) throw new Error('No command provided after --');
  const cwd = options.cwd || process.cwd();
  const startedAt = new Date();
  const blackBoxBefore = captureBlackBox(cwd, 'before');
  let stdout = '';
  let stderr = '';

  let child;
  let result;
  try {
    child = spawn(commandParts[0], commandParts.slice(1), {
      cwd,
      shell: false,
      env: process.env,
      windowsHide: true
    });

    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (!options.quiet) process.stdout.write(text);
    });
    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (!options.quiet) process.stderr.write(text);
    });

    result = await new Promise((resolve) => {
      child.on('error', (error) => resolve({ exitCode: null, signal: null, spawnError: error.message }));
      child.on('close', (exitCode, signal) => resolve({ exitCode, signal, spawnError: null }));
    });
  } catch (error) {
    result = { exitCode: null, signal: null, spawnError: error.message };
  }

  if (result.spawnError) stderr += `\nWhyFail runner: ${result.spawnError}\n`;
  const endedAt = new Date();
  const command = commandParts.map(quotePart).join(' ');
  const redactedCwd = redact(cwd);
  const blackBoxAfter = captureBlackBox(cwd, 'after');
  const baseline = findLastSuccessfulRun({ command, cwd: redactedCwd, before: startedAt.toISOString() });
  const run = {
    id: makeRunId(startedAt),
    kind: 'command',
    command,
    commandParts,
    cwd: redactedCwd,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: endedAt - startedAt,
    exitCode: result.exitCode,
    signal: result.signal,
    status: result.exitCode === 0 ? 'passed' : 'failed',
    stdout: redact(stdout),
    stderr: redact(stderr),
    context: collectContext(cwd, command, `${stderr}\n${stdout}`),
    blackBox: buildBlackBox(blackBoxBefore, blackBoxAfter, baseline)
  };
  run.diagnosis = run.status === 'failed' ? await diagnose(run) : assessSuccess(run);
  saveRun(run);
  return run;
}

export async function analyzeLog(content, options = {}) {
  const now = new Date();
  const cwd = options.cwd || process.cwd();
  const run = {
    id: makeRunId(now), kind: 'imported-log', command: options.label || 'Imported log', commandParts: [],
    cwd: redact(cwd), startedAt: now.toISOString(), endedAt: now.toISOString(), durationMs: 0,
    exitCode: null, signal: null, status: 'failed', stdout: '', stderr: redact(content),
    context: collectContext(cwd, options.label || '', content),
    blackBox: buildBlackBox(captureBlackBox(cwd, 'imported-log'), null, null)
  };
  run.diagnosis = await diagnose(run);
  saveRun(run);
  return run;
}

function quotePart(part) {
  return /\s/.test(part) ? JSON.stringify(part) : part;
}
