import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { captureBlackBox, compareSnapshots } from '../src/black-box.js';

test('captures a local black-box snapshot without storing environment values', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whyfail-blackbox-'));
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"black-box-test"}');
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'a-value-that-must-not-be-stored';
  try {
    const snapshot = captureBlackBox(root, 'before');
    assert.equal(snapshot.phase, 'before');
    assert.ok(snapshot.environment.present.includes('NODE_ENV'));
    assert.equal(snapshot.environment.valuesStored, false);
    assert.equal(JSON.stringify(snapshot).includes('a-value-that-must-not-be-stored'), false);
    assert.equal(snapshot.projectFiles[0].path, 'package.json');
    assert.match(snapshot.projectFiles[0].hash, /^[a-f0-9]{12}$/);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test('compares project file hashes and safe environment presence', () => {
  const previous = {
    host: { nodeVersion: 'v20.0.0', platform: 'win32' },
    environment: { present: ['CI', 'NODE_ENV'] },
    git: { available: true, branch: 'main', commit: '1234567890abcdef', dirty: false },
    projectFiles: [{ path: 'package-lock.json', hash: 'aaaaaaaaaaaa' }]
  };
  const current = {
    host: { nodeVersion: 'v22.0.0', platform: 'win32' },
    environment: { present: ['NODE_ENV', 'VIRTUAL_ENV'] },
    git: { available: true, branch: 'feature', commit: 'fedcba0987654321', dirty: true },
    projectFiles: [{ path: 'package-lock.json', hash: 'bbbbbbbbbbbb' }]
  };
  const changes = compareSnapshots(previous, current);
  assert.ok(changes.some((item) => item.key === 'Node.js'));
  assert.ok(changes.some((item) => item.key === 'CI' && item.after === 'missing'));
  assert.ok(changes.some((item) => item.key === 'VIRTUAL_ENV' && item.after === 'present'));
  assert.ok(changes.some((item) => item.key === 'package-lock.json'));
});
