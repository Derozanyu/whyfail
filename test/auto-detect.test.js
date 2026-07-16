import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectAutoPlan } from '../src/auto-detect.js';

test('auto-detects mixed-language projects and selects ecosystem checks', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whyfail-auto-'));
  project(root, 'web', {
    'package.json': JSON.stringify({ scripts: { typecheck: 'tsc --noEmit', test: 'node --test' } }),
    'src/app.ts': 'export const ok: boolean = true;'
  });
  project(root, 'python', { 'pyproject.toml': '[tool.pytest.ini_options]\n', 'tests/test_app.py': 'def test_ok(): assert True\n' });
  project(root, 'rust', { 'Cargo.toml': '[package]\nname="demo"\nversion="0.1.0"\n', 'src/main.rs': 'fn main() {}\n' });
  project(root, 'go', { 'go.mod': 'module example.test/demo\n', 'main.go': 'package main\nfunc main() {}\n' });
  project(root, 'java', { 'pom.xml': '<project/>', 'src/Main.java': 'class Main {}\n' });
  project(root, 'kotlin', { 'build.gradle.kts': 'plugins {}\n', 'src/Main.kt': 'fun main() {}\n' });
  project(root, 'native', { 'CMakeLists.txt': 'cmake_minimum_required(VERSION 3.20)\n', 'main.cpp': 'int main(){return 0;}\n' });
  project(root, 'dotnet', { 'Demo.csproj': '<Project Sdk="Microsoft.NET.Sdk"/>', 'Program.cs': 'class Program {}\n' });
  project(root, 'ruby', { Gemfile: 'source "https://rubygems.org"\n', Rakefile: 'task :test\n', 'app.rb': 'puts :ok\n' });
  project(root, 'php', { 'composer.json': JSON.stringify({ scripts: { test: 'php -l app.php' } }), 'app.php': '<?php echo "ok";\n' });
  project(root, 'swift', { 'Package.swift': '// swift-tools-version: 5.9\n', 'Sources/App.swift': 'print("ok")\n' });
  project(root, 'cangjie', { 'cjpm.toml': '[package]\nname = "demo"\n', 'src/main.cj': 'main(): Unit {}\n', 'src/main_test.cj': '@Test\nclass MainTest {}\n' });

  const plan = detectAutoPlan(root);
  for (const language of ['typescript', 'python', 'rust', 'go', 'java', 'kotlin', 'cpp', 'csharp', 'ruby', 'php', 'swift', 'cangjie']) assert.ok(plan.languages.includes(language), language);
  const names = plan.commands.map((item) => item.name);
  for (const expected of ['npm typecheck', 'Python tests', 'Rust check', 'Go tests', 'Maven tests', 'Gradle tests', 'CMake configure', '.NET build', 'Ruby tests', 'PHP tests', 'Swift tests', 'Cangjie tests']) assert.ok(names.includes(expected), expected);
});

test('falls back to per-language syntax checks without manifests', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whyfail-auto-raw-'));
  project(root, '.', { 'tool.py': 'print("ok")\n', 'script.rb': 'puts :ok\n', 'index.php': '<?php echo "ok";\n', 'main.c': 'int main(){return 0;}\n', 'main.cj': 'main(): Unit {}\n' });
  const plan = detectAutoPlan(root);
  assert.ok(plan.commands.some((item) => item.name.startsWith('Python syntax')));
  assert.ok(plan.commands.some((item) => item.name.startsWith('Ruby syntax')));
  assert.ok(plan.commands.some((item) => item.name.startsWith('PHP syntax')));
  assert.ok(plan.commands.some((item) => item.name === 'C syntax check'));
  assert.ok(plan.commands.some((item) => item.name === 'Cangjie compile check'));
});

test('uses cjpm build when a Cangjie module has no unit tests', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whyfail-auto-cangjie-'));
  project(root, '.', { 'cjpm.toml': '[package]\nname = "demo"\n', 'src/main.cj': 'main(): Unit {}\n' });
  const plan = detectAutoPlan(root);
  const command = plan.commands.find((item) => item.name === 'Cangjie build');
  assert.ok(command);
  assert.deepEqual(command.run, ['cjpm', 'build']);
});

test('keeps nested Cangjie module tests scoped to their own cjpm.toml', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whyfail-auto-cangjie-nested-'));
  project(root, '.', {
    'cjpm.toml': '[package]\nname = "parent"\n',
    'src/main.cj': 'main(): Unit {}\n',
    'tests/cjpm.toml': '[package]\nname = "child"\n',
    'tests/src/child_test.cj': '@Test\nclass ChildTest {}\n'
  });
  const plan = detectAutoPlan(root);
  assert.ok(plan.commands.some((item) => item.name === 'Cangjie build' && item.cwd === '.'));
  assert.ok(plan.commands.some((item) => item.name === 'Cangjie tests' && item.cwd === 'tests'));
});

function project(root, directory, files) {
  const base = path.resolve(root, directory);
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(base, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}
