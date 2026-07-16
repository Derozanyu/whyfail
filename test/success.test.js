import test from 'node:test';
import assert from 'node:assert/strict';
import { assessSuccess, parseJsonOutput } from '../src/success.js';

test('extracts key fields from successful structured output', () => {
  const stdout = JSON.stringify({
    status: 'ok',
    platforms: ['ios'],
    checked: ['atomic.md', 'layout.md', 'interaction.md'],
    errors: []
  }, null, 2);
  const result = assessSuccess({ stdout });
  assert.equal(result.code, 'command_succeeded');
  assert.equal(result.confidence, 1);
  assert.equal(result.verification.status, 'partial');
  assert.deepEqual(result.evidence, [
    'status: ok',
    'platforms: ios',
    'checked: 3 files',
    'errors: 0'
  ]);
});

test('extracts JSON embedded in surrounding output', () => {
  assert.deepEqual(parseJsonOutput('starting\n{"status":"ok"}\ndone'), { status: 'ok' });
});

test('reports successful commands with no output without inventing evidence', () => {
  const result = assessSuccess({ stdout: '' });
  assert.equal(result.confidence, 0.9);
  assert.equal(result.verification.status, 'partial');
  assert.deepEqual(result.evidence, ['exitCode: 0']);
});
