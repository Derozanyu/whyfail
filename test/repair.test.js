import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from '../src/runner.js';
import { startRepairSession } from '../src/repair.js';
import { loadRun } from '../src/storage.js';
import { startServer } from '../src/server.js';

const here = path.dirname(fileURLToPath(import.meta.url));

test('runs an Agent repair only after an explicit request and preserves the original project', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whyfail-repair-test-'));
  const project = path.join(root, 'project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'app.js'), 'throw new Error("broken before repair");\n');
  fs.writeFileSync(path.join(project, '.env'), 'SECRET_VALUE=must-not-reach-agent\n');
  fs.mkdirSync(path.join(project, 'node_modules'));
  fs.writeFileSync(path.join(project, 'node_modules', 'marker.txt'), 'installed dependency');
  process.env.WHYFAIL_DATA_DIR = path.join(root, 'data');

  const original = await runCommand([process.execPath, 'app.js'], { cwd: project, quiet: true });
  assert.equal(original.status, 'failed');
  assert.equal(loadRun(original.id).blackBox.repairSession, undefined);

  const session = await startRepairSession(original.id, {
    instruction: 'keep the output readable',
    maxAttempts: 2,
    agentCommand: process.execPath,
    agentArgs: [path.resolve(here, '..', 'test-support', 'fake-repair-agent.cjs')],
    agentTimeoutMs: 10000
  });

  assert.equal(session.status, 'resolved');
  assert.equal(session.userInstruction, 'keep the output readable');
  assert.equal(session.originalProjectUntouched, true);
  assert.equal(session.attempts.length, 1);
  assert.equal(session.attempts[0].verificationStatus, 'passed');
  assert.deepEqual(session.attempts[0].changedFiles.map((item) => item.path), ['app.js']);
  assert.match(fs.readFileSync(path.join(project, 'app.js'), 'utf8'), /broken before repair/);
  assert.match(fs.readFileSync(path.join(session.workspace.replace(/^~/, os.homedir()), 'app.js'), 'utf8'), /fixed by fake agent/);

  const stored = loadRun(original.id);
  assert.equal(stored.blackBox.repairSession.status, 'resolved');
  assert.equal(stored.blackBox.repairSession.attempts[0].agentOutput.includes('receivedUserInstruction'), true);
  assert.equal(stored.blackBox.repairSession.attempts[0].agentOutput.includes('"sawEnvironmentFile":false'), true);
  assert.equal(stored.blackBox.repairSession.attempts[0].agentOutput.includes('"sawNodeModules":false'), true);
  assert.equal(fs.existsSync(path.join(session.workspace.replace(/^~/, os.homedir()), '.env')), false);
  assert.equal(fs.existsSync(path.join(session.workspace.replace(/^~/, os.homedir()), 'node_modules')), false);
});

test('starts a prompted repair from the local web API and blocks cross-origin requests', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whyfail-repair-api-test-'));
  const project = path.join(root, 'project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'app.js'), 'throw new Error("repair through API");\n');
  process.env.WHYFAIL_DATA_DIR = path.join(root, 'data');
  process.env.WHYFAIL_AGENT_COMMAND = process.execPath;
  process.env.WHYFAIL_AGENT_ARGS = JSON.stringify([path.resolve(here, '..', 'test-support', 'fake-repair-agent.cjs')]);
  t.after(() => {
    delete process.env.WHYFAIL_AGENT_COMMAND;
    delete process.env.WHYFAIL_AGENT_ARGS;
  });

  const original = await runCommand([process.execPath, 'app.js'], { cwd: project, quiet: true });
  const { server, url } = await startServer({ port: 0 });
  t.after(() => server.close());

  const rejected = await fetch(`${url}/api/runs/${original.id}/repair`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://malicious.example' },
    body: '{}'
  });
  assert.equal(rejected.status, 403);

  const response = await fetch(`${url}/api/runs/${original.id}/repair`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ instruction: 'keep the output readable', maxAttempts: 2 })
  });
  assert.equal(response.status, 202);

  const session = await waitForRepair(original.id);
  assert.equal(session.status, 'resolved');
  assert.equal(session.userInstruction, 'keep the output readable');
});

async function waitForRepair(runId) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const session = loadRun(runId)?.blackBox?.repairSession;
    if (session && session.status !== 'running') return session;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for repair session.');
}
