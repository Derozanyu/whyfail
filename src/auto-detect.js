import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const IGNORED_DIRS = new Set(['.git', '.hg', '.svn', 'node_modules', 'vendor', 'dist', 'build', 'out', 'target', '.venv', 'venv', '__pycache__', '.idea', '.vscode']);
const MANIFEST_NAMES = new Set([
  'package.json', 'pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile',
  'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'build.gradle.kts',
  'CMakeLists.txt', 'Gemfile', 'composer.json', 'Package.swift', 'cjpm.toml'
]);
const SOURCE_LANGUAGES = new Map([
  ['.js', 'javascript'], ['.mjs', 'javascript'], ['.cjs', 'javascript'], ['.jsx', 'javascript'],
  ['.ts', 'typescript'], ['.tsx', 'typescript'], ['.py', 'python'], ['.java', 'java'],
  ['.kt', 'kotlin'], ['.kts', 'kotlin'], ['.rs', 'rust'], ['.go', 'go'],
  ['.c', 'c'], ['.h', 'c'], ['.cc', 'cpp'], ['.cpp', 'cpp'], ['.cxx', 'cpp'], ['.hpp', 'cpp'],
  ['.cs', 'csharp'], ['.rb', 'ruby'], ['.php', 'php'], ['.swift', 'swift'],
  ['.cj', 'cangjie']
]);

export function detectAutoPlan(root = process.cwd(), options = {}) {
  const absoluteRoot = path.resolve(root);
  if (!fs.existsSync(absoluteRoot) || !fs.statSync(absoluteRoot).isDirectory()) throw new Error(`Project directory not found: ${absoluteRoot}`);
  const files = discoverFiles(absoluteRoot, options);
  const manifests = files.filter((file) => isManifest(file));
  const sources = files.filter((file) => SOURCE_LANGUAGES.has(path.extname(file).toLowerCase()));
  const languages = new Set(sources.map((file) => SOURCE_LANGUAGES.get(path.extname(file).toLowerCase())));
  const commands = [];
  const claimed = new Set();

  for (const manifest of manifests) addManifestPlan(absoluteRoot, manifest, files, languages, commands, claimed);
  addSourceFallbacks(absoluteRoot, sources, languages, commands, claimed);

  const unique = [];
  const seen = new Set();
  for (const item of commands) {
    const key = `${item.cwd}\0${item.run.join('\0')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return {
    root: absoluteRoot,
    languages: [...languages].sort(),
    manifests: manifests.map((file) => relative(absoluteRoot, file)),
    commands: unique
  };
}

function addManifestPlan(root, manifest, allFiles, languages, commands, claimed) {
  const dir = path.dirname(manifest);
  const name = path.basename(manifest);
  const localFiles = allFiles.filter((file) => path.dirname(file) === dir);
  const cwd = relative(root, dir) || '.';
  const claim = (language) => claimed.add(`${dir}\0${language}`);
  const add = (label, parts) => commands.push({ name: label, cwd, run: runnable(parts) });

  if (name === 'package.json') {
    languages.add('javascript');
    let pkg = {};
    try { pkg = JSON.parse(fs.readFileSync(manifest, 'utf8')); } catch {}
    if (localFiles.some((file) => ['.ts', '.tsx'].includes(path.extname(file).toLowerCase())) || fs.existsSync(path.join(dir, 'tsconfig.json'))) languages.add('typescript');
    const manager = fs.existsSync(path.join(dir, 'pnpm-lock.yaml')) ? 'pnpm' : fs.existsSync(path.join(dir, 'yarn.lock')) ? 'yarn' : 'npm';
    const scripts = pkg.scripts || {};
    let count = 0;
    for (const script of ['typecheck', 'test', 'lint', 'build']) {
      if (!scripts[script] || /no test specified/i.test(scripts[script]) || count >= 4) continue;
      add(`${manager} ${script}`, [commandName(manager), 'run', script]);
      count++;
    }
    if (!count && fs.existsSync(path.join(dir, 'tsconfig.json'))) { add('TypeScript type check', [commandName('npx'), '--no-install', 'tsc', '--noEmit']); count++; }
    if (count) { claim('javascript'); claim('typescript'); }
    return;
  }
  if (['pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile'].includes(name)) {
    languages.add('python');
    if (!claimed.has(`${dir}\0python`)) {
      const hasTests = fs.existsSync(path.join(dir, 'tests')) || fs.existsSync(path.join(dir, 'pytest.ini')) || fs.existsSync(path.join(dir, 'conftest.py')) || (name === 'pyproject.toml' && /\[tool\.pytest/i.test(safeRead(manifest)));
      if (hasTests) { add('Python tests', [pythonCommand(), '-m', 'pytest']); claim('python'); }
    }
    return;
  }
  if (name === 'Cargo.toml') { languages.add('rust'); add('Rust check', ['cargo', 'check', '--all-targets']); claim('rust'); return; }
  if (name === 'go.mod') { languages.add('go'); add('Go tests', ['go', 'test', './...']); claim('go'); return; }
  if (name === 'pom.xml') {
    languages.add('java');
    const wrapper = fs.existsSync(path.join(dir, process.platform === 'win32' ? 'mvnw.cmd' : 'mvnw')) ? (process.platform === 'win32' ? 'mvnw.cmd' : './mvnw') : commandName('mvn');
    add('Maven tests', [wrapper, 'test']); claim('java'); return;
  }
  if (name === 'build.gradle' || name === 'build.gradle.kts') {
    languages.add(name.endsWith('.kts') || allFiles.some((file) => path.dirname(file) === dir && ['.kt', '.kts'].includes(path.extname(file))) ? 'kotlin' : 'java');
    const wrapper = fs.existsSync(path.join(dir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')) ? (process.platform === 'win32' ? 'gradlew.bat' : './gradlew') : commandName('gradle');
    add('Gradle tests', [wrapper, 'test']); claim('java'); claim('kotlin'); return;
  }
  if (name === 'CMakeLists.txt') {
    languages.add('cpp');
    const existing = ['build', 'out/build'].find((candidate) => fs.existsSync(path.join(dir, candidate, 'CMakeCache.txt')));
    if (existing) add('CMake build', ['cmake', '--build', existing]);
    else {
      const target = path.join(os.tmpdir(), `whyfail-cmake-${shortHash(dir)}`);
      add('CMake configure', ['cmake', '-S', '.', '-B', target]);
      add('CMake build', ['cmake', '--build', target]);
    }
    claim('c'); claim('cpp'); return;
  }
  if (name === 'Gemfile') {
    languages.add('ruby');
    if (fs.existsSync(path.join(dir, 'Rakefile'))) { add('Ruby tests', [commandName('bundle'), 'exec', 'rake', 'test']); claim('ruby'); }
    return;
  }
  if (name === 'composer.json') {
    languages.add('php');
    let composer = {};
    try { composer = JSON.parse(fs.readFileSync(manifest, 'utf8')); } catch {}
    if (composer.scripts?.test) { add('PHP tests', [commandName('composer'), 'test']); claim('php'); }
    return;
  }
  if (name === 'Package.swift') { languages.add('swift'); add('Swift tests', ['swift', 'test']); claim('swift'); return; }
  if (name === 'cjpm.toml') {
    languages.add('cangjie');
    const nestedModuleDirs = allFiles
      .filter((file) => path.basename(file) === 'cjpm.toml' && path.dirname(file) !== dir && path.dirname(file).startsWith(`${dir}${path.sep}`))
      .map((file) => path.dirname(file));
    const moduleFiles = allFiles.filter((file) =>
      (file === manifest || file.startsWith(`${dir}${path.sep}`)) &&
      !nestedModuleDirs.some((nested) => file === path.join(nested, 'cjpm.toml') || file.startsWith(`${nested}${path.sep}`))
    );
    const hasTests = moduleFiles.some((file) => /_test\.cj$/i.test(path.basename(file)));
    add(hasTests ? 'Cangjie tests' : 'Cangjie build', hasTests ? ['cjpm', 'test', '--no-color', '--no-progress'] : ['cjpm', 'build']);
    claim('cangjie');
    return;
  }
  if (/\.(?:sln|csproj)$/i.test(name)) {
    languages.add('csharp');
    const isTest = /test/i.test(name) || /Microsoft\.NET\.Test\.Sdk/i.test(safeRead(manifest));
    add(isTest ? '.NET tests' : '.NET build', ['dotnet', isTest ? 'test' : 'build', name]);
    claim('csharp');
  }
}

function addSourceFallbacks(root, sources, languages, commands, claimed) {
  const grouped = new Map();
  for (const file of sources) {
    const language = SOURCE_LANGUAGES.get(path.extname(file).toLowerCase());
    const key = `${nearestProjectDir(root, path.dirname(file), claimed)}\0${language}`;
    if (!grouped.has(key)) grouped.set(key, { dir: key.split('\0')[0], language, files: [] });
    grouped.get(key).files.push(file);
  }
  for (const { dir, language, files } of grouped.values()) {
    if (claimed.has(`${dir}\0${language}`)) continue;
    const cwd = relative(root, dir) || '.';
    const relFiles = files.slice(0, 40).map((file) => relative(dir, file));
    const add = (name, parts) => commands.push({ name, cwd, run: runnable(parts) });
    if (language === 'javascript') for (const file of relFiles.filter((item) => !item.endsWith('.jsx'))) add(`JavaScript syntax · ${file}`, ['node', '--check', file]);
    else if (language === 'typescript') add('TypeScript type check', [commandName('npx'), '--no-install', 'tsc', '--noEmit']);
    else if (language === 'python') for (const file of relFiles) add(`Python syntax · ${file}`, [pythonCommand(), '-c', 'import pathlib,sys; p=pathlib.Path(sys.argv[1]); compile(p.read_text(encoding="utf-8"), str(p), "exec")', file]);
    else if (language === 'ruby') for (const file of relFiles) add(`Ruby syntax · ${file}`, ['ruby', '-c', file]);
    else if (language === 'php') for (const file of relFiles) add(`PHP syntax · ${file}`, ['php', '-l', file]);
    else if (language === 'swift') add('Swift type check', ['swiftc', '-typecheck', ...relFiles]);
    else if (language === 'c') add('C syntax check', ['gcc', '-fsyntax-only', ...relFiles]);
    else if (language === 'cpp') add('C++ syntax check', ['g++', '-fsyntax-only', ...relFiles]);
    else if (language === 'java') add('Java compile check', ['javac', '-d', path.join(os.tmpdir(), `whyfail-javac-${shortHash(dir)}`), ...relFiles]);
    else if (language === 'kotlin') add('Kotlin compile check', ['kotlinc', ...relFiles, '-d', path.join(os.tmpdir(), `whyfail-kotlin-${shortHash(dir)}.jar`)]);
    else if (language === 'rust') add('Rust compile check', ['rustc', '--emit=metadata', '-o', path.join(os.tmpdir(), `whyfail-rust-${shortHash(dir)}.rmeta`), relFiles[0]]);
    else if (language === 'go') add('Go tests', ['go', 'test', '.']);
    else if (language === 'csharp') add('C# compile check', ['csc', '/target:library', `/out:${path.join(os.tmpdir(), `whyfail-csharp-${shortHash(dir)}.dll`)}`, ...relFiles]);
    else if (language === 'cangjie') add('Cangjie compile check', ['cjc', '--diagnostic-format=noColor', ...relFiles, '-o', path.join(os.tmpdir(), `whyfail-cangjie-${shortHash(dir)}${process.platform === 'win32' ? '.exe' : ''}`)]);
    claimed.add(`${dir}\0${language}`);
  }
}

function discoverFiles(root, { maxDepth = 4, maxFiles = 5000 } = {}) {
  const result = [];
  const queue = [{ dir: root, depth: 0 }];
  while (queue.length && result.length < maxFiles) {
    const { dir, depth } = queue.shift();
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      if (entry.isFile() && (isManifest(absolute) || SOURCE_LANGUAGES.has(path.extname(entry.name).toLowerCase()) || ['tsconfig.json', 'pytest.ini', 'conftest.py', 'Rakefile', 'pnpm-lock.yaml', 'yarn.lock'].includes(entry.name))) result.push(absolute);
      else if (entry.isDirectory() && depth < maxDepth && !IGNORED_DIRS.has(entry.name)) queue.push({ dir: absolute, depth: depth + 1 });
    }
  }
  return result;
}

function isManifest(file) { const name = path.basename(file); return MANIFEST_NAMES.has(name) || /\.(?:sln|csproj)$/i.test(name); }
function safeRead(file) { try { return fs.readFileSync(file, 'utf8').slice(0, 64000); } catch { return ''; } }
function relative(root, file) { return path.relative(root, file).replaceAll('\\', '/'); }
function nearestProjectDir(root, dir, claimed) {
  const candidates = [...claimed].map((item) => item.split('\0')[0]).filter((candidate) => dir === candidate || dir.startsWith(`${candidate}${path.sep}`));
  return candidates.sort((a, b) => b.length - a.length)[0] || root;
}
function shortHash(value) { return crypto.createHash('sha1').update(value).digest('hex').slice(0, 10); }
function pythonCommand() { return process.platform === 'win32' ? 'python' : 'python3'; }
function commandName(name) { return process.platform === 'win32' && ['npm', 'npx', 'pnpm', 'yarn', 'mvn', 'gradle', 'bundle', 'composer'].includes(name) ? `${name}.cmd` : name; }
function runnable(parts) {
  if (process.platform !== 'win32' || !/\.(?:cmd|bat)$/i.test(parts[0])) return parts;
  return [process.env.ComSpec || 'cmd.exe', '/d', '/s', '/c', parts.map(shellQuote).join(' ')];
}
function shellQuote(value) { const text = String(value); return /[\s&|<>^()]/.test(text) ? `"${text.replaceAll('"', '\\"')}"` : text; }
