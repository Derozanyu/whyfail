import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectSourceContext, extractFrames } from '../src/source-context.js';

test('extracts Python, Node, Rust and compiler stack frames', () => {
  const frames = extractFrames(`File "src/app.py", line 12, in main\n    at run (file:///tmp/app.mjs:7:4)\n --> src/main.rs:9:2\nsrc/main.c:14:3: error: broken`);
  assert.deepEqual(frames.map((item) => item.line), [12, 7, 9, 14]);
});

test('extracts .NET/MSVC and PHP source locations', () => {
  const frames = extractFrames(`src\\Program.cs(18,7): error CS0103: name does not exist\nsrc/main.cpp(22,5): error C2065: undeclared identifier\nPHP Fatal error: boom in src/index.php on line 31`);
  assert.deepEqual(frames.map((item) => [item.file, item.line, item.column]), [
    ['src\\Program.cs', 18, 7],
    ['src/main.cpp', 22, 5],
    ['src/index.php', 31, null]
  ]);
});

test('extracts Cangjie compiler and runtime source locations', () => {
  const frames = extractFrames(`src/main.cj:12:4: error: undeclared identifier foo\n    at demo.main()(src/main.cj:20)`);
  assert.deepEqual(frames.map((item) => [item.file, item.line, item.column]), [
    ['src/main.cj', 12, 4],
    ['src/main.cj', 20, null]
  ]);
});

test('collects only source files inside the project and marks target lines', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whyfail-source-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'app.py'), 'one\ntwo\nraise RuntimeError("boom")\nfour\n');
  const outside = path.join(os.tmpdir(), 'outside-secret.py');
  fs.writeFileSync(outside, 'secret');
  const log = `File "${path.join(root, 'src', 'app.py')}", line 3, in main\nFile "${outside}", line 1, in other`;
  const sources = collectSourceContext(root, log);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].file, 'src/app.py');
  assert.match(sources[0].code, /> 3 \| raise RuntimeError/);
  assert.deepEqual(sources[0].lines.find((item) => item.isTarget), {
    number: 3,
    text: 'raise RuntimeError("boom")',
    isTarget: true
  });
});
