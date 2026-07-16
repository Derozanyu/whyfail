import test from 'node:test';
import assert from 'node:assert/strict';
import { ruleDiagnosis } from '../src/diagnose.js';
import { redact } from '../src/redact.js';

test('detects an ESM/CommonJS mismatch', () => {
  const result = ruleDiagnosis({ stderr: 'ReferenceError: require is not defined in ES module scope', stdout: '' });
  assert.equal(result.code, 'module_system_mismatch');
  assert.ok(result.confidence > 0.9);
  assert.match(result.title['zh-CN'], /CommonJS/);
  assert.equal(result.verification.status, 'verified');
  assert.deepEqual(result.unverified, []);
});

test('keeps an unclassified failure explicitly awaiting verification', () => {
  const result = ruleDiagnosis({ stderr: 'something unusual happened', stdout: '' });
  assert.equal(result.code, 'unclassified_failure');
  assert.equal(result.verification.status, 'needs-confirmation');
  assert.equal(result.unverified.length, 1);
});

test('classifies language-specific compiler and runtime failures', () => {
  const cases = [
    ['error[E0382]: borrow of moved value: `name`', 'rust_ownership_error'],
    ['main.go:8:2: undefined: missing', 'go_compile_error'],
    ['Main.java:4: error: cannot find symbol', 'jvm_compile_error'],
    ['main.cpp:7: undefined reference to `render()`', 'native_compile_or_link_error'],
    ['Program.cs(3,4): error CS0103: name does not exist', 'dotnet_error'],
    ['app.rb:4:in `run`: undefined method `call` (NoMethodError)', 'ruby_error'],
    ['PHP Fatal error: Uncaught TypeError in index.php on line 9', 'php_error'],
    ['Sources/App.swift:5:8: error: cannot find value in scope', 'swift_compile_error'],
    ['error: undeclared identifier foo\n  ==> src/main.cj:8:3:', 'cangjie_compile_error'],
    ['cjpm Error: cyclic dependency found', 'cangjie_dependency_error'],
    ['[ FAILED ] CASE: testAdd\nSummary: TOTAL: 1\nFAILED: 1', 'cangjie_test_failure']
  ];
  for (const [stderr, code] of cases) {
    const result = ruleDiagnosis({ stderr, stdout: '' });
    assert.equal(result.code, code, stderr);
    assert.equal(result.verification.status, 'verified', code);
    assert.deepEqual(result.unverified, [], code);
  }
});

test('redacts common secrets and home directories', () => {
  const result = redact(`token=abc123secret password=hunter2 ${process.env.USERPROFILE || ''}`);
  assert.doesNotMatch(result, /hunter2/);
  assert.match(result, /\[REDACTED\]/);
});

test('redacts a Windows home path written with URL separators', () => {
  if (!process.env.USERPROFILE) return;
  const urlPath = process.env.USERPROFILE.replaceAll('\\', '/');
  assert.doesNotMatch(redact(`file:///${urlPath}/project/app.js`), new RegExp(urlPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
