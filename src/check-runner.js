import path from 'node:path';
import { loadCheckConfig } from './check-config.js';
import { runCommand } from './runner.js';
import { collectContext } from './context.js';
import { makeRunId, saveRun } from './storage.js';
import { redact } from './redact.js';

const localized = (en, zh) => ({ en, 'zh-CN': zh });

export async function runCheck(configFile, options = {}) {
  const config = loadCheckConfig(configFile);
  return runCommandSuite(config, options);
}

export async function runCommandSuite(config, options = {}) {
  if (!config?.commands?.length) throw new Error('No commands were selected for this project.');
  const startedAt = new Date();
  const children = [];
  for (const item of config.commands) {
    options.onCommand?.(item);
    const cwd = path.resolve(config.root, item.cwd || '.');
    const run = await runCommand(item.run, { cwd, quiet: options.quiet });
    children.push({ id: run.id, name: item.name, command: run.command, status: run.status, exitCode: run.exitCode, durationMs: run.durationMs, diagnosis: run.diagnosis ? { code: run.diagnosis.code, confidence: run.diagnosis.confidence, title: run.diagnosis.title } : null, sourceFrames: run.context?.sourceFrames?.length || 0 });
  }
  const endedAt = new Date();
  const failed = children.filter((item) => item.status === 'failed');
  const run = {
    id: makeRunId(startedAt), kind: options.kind || 'check', name: config.name, command: `${options.commandPrefix || 'check'}:${config.name}`,
    commandParts: [], cwd: redact(config.root), startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(),
    durationMs: endedAt - startedAt, exitCode: failed.length ? 1 : 0, signal: null,
    status: failed.length ? 'failed' : 'passed', stdout: '', stderr: '', children,
    context: { ...collectContext(config.root, `${options.commandPrefix || 'check'}:${config.name}`), ...(options.context || {}) }
  };
  run.diagnosis = {
    source: 'check-summary', code: failed.length ? 'check_suite_failed' : 'check_suite_passed',
    confidence: 1,
    title: failed.length
      ? localized(`${failed.length} of ${children.length} checks failed`, `${children.length} 项检查中有 ${failed.length} 项失败`)
      : localized(`All ${children.length} checks passed`, `${children.length} 项检查全部通过`),
    explanation: failed.length
      ? localized('Open a failed child check to inspect its captured logs, related source files, and diagnosis.', '打开失败的子检查，可查看捕获日志、相关源码文件与诊断结果。')
      : localized('Every configured command completed successfully.', '所有配置的命令均已成功完成。'),
    evidence: children.map((item) => `${item.status === 'passed' ? 'PASS' : 'FAIL'} · ${item.name} · exit ${item.exitCode ?? 'N/A'} · ${item.durationMs}ms`),
    suggestions: failed.map((item) => localized(`Inspect the child report for “${item.name}”.`, `检查“${item.name}”的子报告。`)),
    verification: {
      status: 'verified',
      title: localized('Check results verified', '检查结果已验证'),
      explanation: localized('The pass/fail summary is calculated directly from the child commands and their exit codes.', '通过/失败汇总由各子命令及其退出码直接计算得出。')
    },
    unverified: []
  };
  saveRun(run);
  return run;
}
