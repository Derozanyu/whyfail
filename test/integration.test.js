import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runCommand, analyzeLog } from '../src/runner.js';
import { loadRun } from '../src/storage.js';
import { startServer } from '../src/server.js';
import { runCheck } from '../src/check-runner.js';
import { loadCheckConfig } from '../src/check-config.js';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'whyfail-test-'));
process.env.WHYFAIL_DATA_DIR = temp;

test('captures, diagnoses and stores a failed arbitrary command', async () => {
  const run = await runCommand([process.execPath, '-e', 'require("missing-whyfail-package")'], { quiet: true, cwd: temp });
  assert.equal(run.status, 'failed');
  assert.equal(run.diagnosis.code, 'missing_dependency');
  assert.equal(run.diagnosis.verification.status, 'verified');
  assert.equal(loadRun(run.id).id, run.id);
});

test('imports an existing log', async () => {
  const run = await analyzeLog('Error: listen EADDRINUSE: address already in use :::3000', { cwd: temp });
  assert.equal(run.diagnosis.code, 'address_in_use');
});

test('serves runs through the local API', async (t) => {
  const { server, url } = await startServer({ port: 0 });
  t.after(() => server.close());
  const response = await fetch(`${url}/api/runs`);
  assert.equal(response.status, 200);
  const runs = await response.json();
  assert.ok(runs.length >= 2);
});

test('parses a zero-dependency YAML check configuration', () => {
  const file = path.join(temp, 'whyfail.yaml');
  fs.writeFileSync(file, 'name: sample\ncommands:\n  - name: quoted\n    run: ["node", "--version"]\n');
  const config = loadCheckConfig(file);
  assert.equal(config.name, 'sample');
  assert.deepEqual(config.commands[0].run, ['node', '--version']);
});

test('runs multiple project checks and stores a suite summary', async () => {
  const file = path.join(temp, 'whyfail.json');
  fs.writeFileSync(file, JSON.stringify({ name: 'integration-suite', commands: [
    { name: 'passing', run: [process.execPath, '-e', 'process.exit(0)'] },
    { name: 'failing', run: [process.execPath, '-e', 'throw new Error("suite boom")'] }
  ] }));
  const suite = await runCheck(file, { quiet: true });
  assert.equal(suite.kind, 'check');
  assert.equal(suite.status, 'failed');
  assert.equal(suite.children.length, 2);
  assert.equal(suite.children.filter((item) => item.status === 'failed').length, 1);
  assert.equal(loadRun(suite.id).diagnosis.code, 'check_suite_failed');
  assert.equal(loadRun(suite.id).diagnosis.verification.status, 'verified');
});
