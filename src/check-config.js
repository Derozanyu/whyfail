import fs from 'node:fs';
import path from 'node:path';

export function loadCheckConfig(file = 'whyfail.yaml') {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute)) throw new Error(`Check configuration not found: ${absolute}`);
  const content = fs.readFileSync(absolute, 'utf8');
  const config = path.extname(absolute).toLowerCase() === '.json' ? JSON.parse(content) : parseSimpleYaml(content);
  validate(config);
  return { ...config, file: absolute, root: path.dirname(absolute) };
}

export function splitCommand(value) {
  const parts = [];
  let current = '';
  let quote = null;
  let escaping = false;
  for (const char of String(value)) {
    if (escaping) { current += char; escaping = false; continue; }
    if (char === '\\' && quote !== "'") { escaping = true; continue; }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (/\s/.test(char)) {
      if (current) { parts.push(current); current = ''; }
      continue;
    }
    current += char;
  }
  if (escaping || quote) throw new Error(`Invalid quoted command: ${value}`);
  if (current) parts.push(current);
  return parts;
}

function parseSimpleYaml(content) {
  const config = { commands: [] };
  let current = null;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '').trimEnd();
    if (!line.trim()) continue;
    let match;
    if ((match = line.match(/^name:\s*(.+)$/)) && !/^\s/.test(raw)) { config.name = scalar(match[1]); continue; }
    if (/^commands:\s*$/.test(line)) continue;
    if ((match = line.match(/^\s*-\s+name:\s*(.+)$/))) {
      current = { name: scalar(match[1]) };
      config.commands.push(current);
      continue;
    }
    if (!current) continue;
    if ((match = line.match(/^\s+run:\s*(.+)$/))) { current.run = commandValue(match[1]); continue; }
    if ((match = line.match(/^\s+cwd:\s*(.+)$/))) { current.cwd = scalar(match[1]); continue; }
  }
  return config;
}

function commandValue(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) return JSON.parse(trimmed);
  return splitCommand(scalar(trimmed));
}

function scalar(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) return trimmed.slice(1, -1);
  return trimmed;
}

function validate(config) {
  if (!config || !Array.isArray(config.commands) || !config.commands.length) throw new Error('Check configuration must contain at least one command.');
  config.name ||= 'project-check';
  for (const [index, item] of config.commands.entries()) {
    item.name ||= `command-${index + 1}`;
    if (typeof item.run === 'string') item.run = splitCommand(item.run);
    if (!Array.isArray(item.run) || !item.run.length || item.run.some((part) => typeof part !== 'string')) throw new Error(`Invalid run value for command: ${item.name}`);
  }
}
