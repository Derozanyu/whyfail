import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runCommand, analyzeLog } from '../src/runner.js';
import { verifyRun } from '../src/verify.js';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'whyfail-verify-test-'));
process.env.WHYFAIL_DATA_DIR = path.join(temp, 'data');

test('verifies that an original failure is resolved by rerunning the exact command', async () => {
  const marker = path.join(temp, 'fixed.marker');
  const original = await runCommand([
    process.execPath,
    '-e',
    'process.exit(require("fs").existsSync(process.argv[1]) ? 0 : 1)',
    marker
  ], { cwd: temp, quiet: true });
  assert.equal(original.status, 'failed');
  fs.writeFileSync(marker, 'fixed');
  const { rerun, result } = await verifyRun(original.id, { quiet: true });
  assert.equal(result.outcome, 'resolved');
  assert.equal(rerun.status, 'passed');
  assert.equal(rerun.verificationOf, original.id);
  assert.equal(rerun.diagnosis.verification.status, 'verified');
});

test('verifies when the same diagnosed failure remains reproducible', async () => {
  const original = await runCommand([process.execPath, '-e', 'throw new Error("still broken")'], { cwd: temp, quiet: true });
  const { rerun, result } = await verifyRun(original.id, { quiet: true });
  assert.equal(result.outcome, 'reproduced');
  assert.equal(rerun.diagnosis.code, original.diagnosis.code);
  assert.equal(rerun.diagnosis.verification.status, 'verified');
});

test('does not pretend an imported log can be rerun', async () => {
  const imported = await analyzeLog('synthetic failure log', { cwd: temp });
  await assert.rejects(() => verifyRun(imported.id, { quiet: true }), /cannot be rerun directly/i);
});
