import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { redact } from './redact.js';
import { collectSourceContext } from './source-context.js';

const MANIFESTS = [
  ['package.json', 'node'], ['pyproject.toml', 'python'], ['requirements.txt', 'python'],
  ['pom.xml', 'java'], ['build.gradle', 'gradle'], ['build.gradle.kts', 'gradle'],
  ['Cargo.toml', 'rust'], ['go.mod', 'go'], ['CMakeLists.txt', 'cpp'],
  ['Gemfile', 'ruby'], ['composer.json', 'php'], ['Package.swift', 'swift'], ['cjpm.toml', 'cangjie'],
  ['docker-compose.yml', 'docker'], ['compose.yml', 'docker']
];

export function detectProject(cwd, command = '') {
  const found = [];
  for (const [name, ecosystem] of MANIFESTS) {
    if (fs.existsSync(path.join(cwd, name))) found.push({ name, ecosystem });
  }
  const hint = command.split(/\s+/)[0].toLowerCase();
  const commandMap = {
    node: 'node', npm: 'node', npx: 'node', pnpm: 'node', yarn: 'node',
    python: 'python', python3: 'python', pytest: 'python', pip: 'python',
    java: 'java', mvn: 'java', gradle: 'gradle', './gradlew': 'gradle', gradlew: 'gradle',
    cargo: 'rust', rustc: 'rust', go: 'go', gcc: 'cpp', 'g++': 'cpp', cmake: 'cpp',
    dotnet: 'csharp', csc: 'csharp', ruby: 'ruby', bundle: 'ruby', php: 'php', composer: 'php',
    swift: 'swift', swiftc: 'swift', kotlinc: 'kotlin', cjpm: 'cangjie', cjc: 'cangjie', docker: 'docker'
  };
  const dotnetManifest = safeEntries(cwd).find((name) => /\.(?:sln|csproj)$/i.test(name));
  if (dotnetManifest) found.push({ name: dotnetManifest, ecosystem: 'csharp' });
  return {
    ecosystem: found[0]?.ecosystem || commandMap[hint] || 'generic',
    manifests: found.map((item) => item.name)
  };
}

export function collectContext(cwd, command, log = '') {
  const project = detectProject(cwd, command);
  const manifests = {};
  for (const name of project.manifests) {
    try {
      const content = fs.readFileSync(path.join(cwd, name), 'utf8').slice(0, 16000);
      manifests[name] = redact(content);
    } catch {}
  }
  return {
    cwd: redact(cwd),
    platform: `${os.platform()} ${os.release()} (${os.arch()})`,
    nodeVersion: process.version,
    runtime: runtimeLabel(project.ecosystem),
    ecosystem: project.ecosystem,
    manifests,
    sourceFrames: collectSourceContext(cwd, log)
  };
}

function safeEntries(cwd) { try { return fs.readdirSync(cwd); } catch { return []; } }
function runtimeLabel(ecosystem) {
  const labels = { node: `Node ${process.version}`, python: 'Python', java: 'JVM', gradle: 'JVM / Gradle', rust: 'Rust', go: 'Go', cpp: 'C / C++', csharp: '.NET', ruby: 'Ruby', php: 'PHP', swift: 'Swift', kotlin: 'Kotlin', cangjie: 'Cangjie', docker: 'Docker' };
  return labels[ecosystem] || ecosystem || 'generic';
}
