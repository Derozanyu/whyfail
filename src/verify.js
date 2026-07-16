import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadRun, saveRun } from './storage.js';
import { runCommand } from './runner.js';

const localized = (en, zh) => ({ en, 'zh-CN': zh });

export async function verifyRun(id, options = {}) {
  const original = loadRun(id);
  if (!original) throw new Error(`Run not found: ${id}`);
  if (original.kind !== 'command' || !Array.isArray(original.commandParts) || !original.commandParts.length) {
    throw new Error('This report cannot be rerun directly. Open a child command report, or rerun the original command for an imported log.');
  }
  const cwd = restoreLocalPath(original.cwd);
  if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw new Error(`Original working directory is unavailable: ${original.cwd}`);

  const rerun = await runCommand(original.commandParts, { cwd, quiet: options.quiet });
  rerun.verificationOf = original.id;
  rerun.verificationResult = compareRuns(original, rerun);
  rerun.diagnosis.verification = rerun.verificationResult.verification;
  saveRun(rerun);
  return { original, rerun, result: rerun.verificationResult };
}

export function compareRuns(original, rerun) {
  if (rerun.status === 'passed') {
    return {
      outcome: 'resolved',
      verification: {
        status: 'verified',
        title: localized('Original failure no longer reproduces', '原错误已不再复现'),
        explanation: localized(`The exact saved command was rerun in the original working directory and exited with code 0. This verifies that the original failure is resolved for this run.`, '已在原工作目录中重新执行完全相同的命令，并以退出码 0 完成；这验证了原错误在本次运行中已经解决。')
      }
    };
  }
  const sameCode = original.diagnosis?.code && original.diagnosis.code === rerun.diagnosis?.code;
  if (sameCode) {
    return {
      outcome: 'reproduced',
      verification: {
        status: 'verified',
        title: localized('The same failure was reproduced', '同一错误已再次复现'),
        explanation: localized(`The saved command failed again with the same diagnosis code: ${rerun.diagnosis.code}. The failure is verified as reproducible, but it is not fixed.`, `保存的命令再次失败，诊断代码仍为 ${rerun.diagnosis.code}。这说明错误可以稳定复现，但尚未修复。`)
      }
    };
  }
  return {
    outcome: 'changed',
    verification: {
      status: 'partial',
      title: localized('The verification outcome changed', '验证结果发生变化'),
      explanation: localized(`The command still failed, but the diagnosis changed from ${original.diagnosis?.code || 'unknown'} to ${rerun.diagnosis?.code || 'unknown'}. Inspect the new report before deciding whether the original issue is resolved.`, `命令仍然失败，但诊断已从 ${original.diagnosis?.code || 'unknown'} 变为 ${rerun.diagnosis?.code || 'unknown'}。请检查新报告，再判断原问题是否已经解决。`)
    }
  };
}

function restoreLocalPath(value) {
  const text = String(value || '');
  if (text.includes('[REDACTED')) return null;
  if (text === '~') return os.homedir();
  if (text.startsWith('~/') || text.startsWith('~\\')) return path.join(os.homedir(), text.slice(2));
  return path.resolve(text);
}
