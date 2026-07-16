#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { runCommand, analyzeLog } from './runner.js';
import { startServer } from './server.js';
import { dataDir } from './storage.js';
import { runCheck } from './check-runner.js';
import { runAutoCheck } from './auto-runner.js';
import { detectAutoPlan } from './auto-detect.js';
import { verifyRun } from './verify.js';

const args = process.argv.slice(2);
const command = args[0];

try {
  if (!command || ['help', '--help', '-h'].includes(command)) {
    help();
  } else if (command === 'run') {
    await handleRun(args.slice(1));
  } else if (command === 'analyze') {
    await handleAnalyze(args.slice(1));
  } else if (command === 'check') {
    await handleCheck(args.slice(1));
  } else if (command === 'auto') {
    await handleAuto(args.slice(1));
  } else if (command === 'verify') {
    await handleVerify(args.slice(1));
  } else if (command === 'ui') {
    await serve(args.slice(1));
  } else if (command === 'data-dir') {
    console.log(dataDir());
  } else {
    console.error(`Unknown command: ${command}\n`);
    help(1);
  }
} catch (error) {
  console.error(`WhyFail error: ${error.message}`);
  process.exitCode = 1;
}

async function handleVerify(values) {
  const id = values.find((value) => !value.startsWith('--'));
  if (!id) throw new Error('Usage: whyfail verify <run-id> [--no-web]');
  const noWeb = values.includes('--no-web');
  console.log(`WhyFail · verifying: ${id}\n`);
  const { rerun, result } = await verifyRun(id);
  console.log(`\nWhyFail · verification ${result.outcome} · exit ${rerun.exitCode ?? 'N/A'}`);
  console.log(`New run ID: ${rerun.id}`);
  if (!noWeb) await serve([], rerun.id);
  else console.log('Open the report later with: whyfail ui');
  process.exitCode = rerun.exitCode ?? (rerun.status === 'failed' ? 1 : 0);
}

async function handleRun(values) {
  const delimiter = values.indexOf('--');
  const optionParts = delimiter >= 0 ? values.slice(0, delimiter) : [];
  const commandParts = delimiter >= 0 ? values.slice(delimiter + 1) : values;
  const noWeb = optionParts.includes('--no-web');
  const cwdIndex = optionParts.indexOf('--cwd');
  const cwd = cwdIndex >= 0 ? path.resolve(optionParts[cwdIndex + 1]) : process.cwd();
  console.log(`WhyFail · running: ${commandParts.join(' ')}\n`);
  const run = await runCommand(commandParts, { cwd });
  console.log(`\nWhyFail · ${run.status} · exit ${run.exitCode ?? 'N/A'} · ${run.durationMs}ms`);
  console.log(`Run ID: ${run.id}`);
  if (run.status === 'failed' && !noWeb) await serve([], run.id);
  else console.log(`Open the report later with: whyfail ui`);
  process.exitCode = run.exitCode ?? (run.status === 'failed' ? 1 : 0);
}

async function handleAnalyze(values) {
  const target = values[0];
  if (!target) throw new Error('Usage: whyfail analyze <log-file|->');
  const content = target === '-' ? await readStdin() : fs.readFileSync(path.resolve(target), 'utf8');
  const run = await analyzeLog(content, { label: target === '-' ? 'stdin' : path.basename(target) });
  console.log(`Imported diagnosis: ${run.id}`);
  await serve([], run.id);
}

async function handleCheck(values) {
  const noWeb = values.includes('--no-web');
  const configFile = values.find((value) => !value.startsWith('--')) || 'whyfail.yaml';
  console.log(`WhyFail · project check: ${configFile}\n`);
  const run = await runCheck(configFile, { onCommand: (item) => console.log(`\n── ${item.name}: ${item.run.join(' ')}`) });
  const failed = run.children.filter((item) => item.status === 'failed').length;
  console.log(`\nWhyFail · ${run.children.length - failed} passed · ${failed} failed`);
  console.log(`Run ID: ${run.id}`);
  if (!noWeb) await serve([], run.id);
  else console.log('Open the report later with: whyfail ui');
  process.exitCode = failed ? 1 : 0;
}

async function handleAuto(values) {
  const noWeb = values.includes('--no-web');
  const planOnly = values.includes('--plan');
  const cwdIndex = values.indexOf('--cwd');
  const cwd = cwdIndex >= 0 ? path.resolve(values[cwdIndex + 1]) : process.cwd();
  console.log(`WhyFail · auto-detecting project: ${cwd}\n`);
  if (planOnly) {
    const plan = detectAutoPlan(cwd);
    console.log(`Detected: ${plan.languages.join(', ') || 'none'}`);
    for (const item of plan.commands) console.log(`- ${item.name} [${item.cwd}]: ${item.run.join(' ')}`);
    if (!plan.commands.length) console.log('No automatic checks selected.');
    return;
  }
  const { plan, run } = await runAutoCheck(cwd, {
    onCommand: (item) => console.log(`\n── ${item.name}: ${item.run.join(' ')}`)
  });
  const failed = run.children.filter((item) => item.status === 'failed').length;
  console.log(`\nDetected: ${plan.languages.join(', ')}`);
  console.log(`Selected ${plan.commands.length} automatic check${plan.commands.length === 1 ? '' : 's'}.`);
  console.log(`WhyFail · ${run.children.length - failed} passed · ${failed} failed`);
  console.log(`Run ID: ${run.id}`);
  if (!noWeb) await serve([], run.id);
  else console.log('Open the report later with: whyfail ui');
  process.exitCode = failed ? 1 : 0;
}

async function serve(values = [], selectedId = '') {
  const portIndex = values.indexOf('--port');
  const port = portIndex >= 0 ? Number(values[portIndex + 1]) : 3967;
  const { url } = await startServer({ port });
  const reportUrl = selectedId ? `${url}/?run=${encodeURIComponent(selectedId)}` : url;
  console.log(`WhyFail UI: ${reportUrl}`);
  console.log('Press Ctrl+C to stop the local server.');
  await new Promise(() => {});
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let value = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => value += chunk);
    process.stdin.on('end', () => resolve(value));
    process.stdin.on('error', reject);
  });
}

function help(exitCode = 0) {
  console.log(`WhyFail 0.5.0\n\nUsage:\n  whyfail auto [--cwd PATH] [--plan] [--no-web]\n  whyfail run [--no-web] [--cwd PATH] -- <command> [args...]\n  whyfail check [whyfail.yaml|whyfail.json] [--no-web]\n  whyfail verify <run-id> [--no-web]\n  whyfail analyze <log-file|->\n  whyfail ui [--port 3967]\n  whyfail data-dir\n\nAI provider (optional):\n  WHYFAIL_API_KEY, WHYFAIL_BASE_URL, WHYFAIL_MODEL\n`);
  process.exitCode = exitCode;
}
