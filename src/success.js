const localized = (en, zh) => ({ en, 'zh-CN': zh });

export function assessSuccess(run) {
  const output = String(run.stdout || '').trim();
  const parsed = parseJsonOutput(output);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const evidence = jsonHighlights(parsed);
    const reportedOk = isReportedSuccess(parsed);
    return {
      source: 'successful-output',
      code: 'command_succeeded',
      confidence: reportedOk ? 1 : 0.96,
      title: localized('The command completed successfully', '命令执行成功'),
      explanation: localized(
        `The process exited with code 0${reportedOk ? ' and its structured output explicitly reports success' : ''}. Key output fields are preserved below for semantic confirmation.`,
        `进程以退出码 0 完成${reportedOk ? '，并且结构化输出明确报告成功' : ''}。下方保留关键输出字段，便于进一步确认业务结果。`),
      evidence: evidence.length ? evidence : ['exitCode: 0'],
      suggestions: [],
      verification: {
        status: 'partial',
        title: localized('Process result verified', '进程结果已验证'),
        explanation: localized('Exit code 0 and the structured success fields confirm process completion. Business correctness still depends on whether those fields match the command contract.', '退出码 0 与结构化成功字段已确认进程完成；业务结果是否正确，仍取决于这些字段是否符合命令约定。')
      },
      unverified: [localized('Process success does not by itself prove every business expectation; compare the highlighted fields with the command contract.', '进程成功不等于所有业务预期都正确；请将高亮字段与该命令约定的成功结果进行比较。')],
      outputSummary: { format: 'json', highlights: evidence }
    };
  }

  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const preferred = lines.filter((line) => /\b(?:ok|pass(?:ed)?|success(?:ful)?|complete(?:d)?|checked|warning|error)\b/i.test(line));
  const evidence = [...new Set((preferred.length ? preferred : lines).slice(0, 8))];
  return {
    source: output ? 'successful-output' : 'exit-status',
    code: 'command_succeeded',
    confidence: output ? 0.96 : 0.9,
    title: localized('The command completed successfully', '命令执行成功'),
    explanation: output
      ? localized('The process exited with code 0. Relevant output lines are highlighted below for confirmation.', '进程以退出码 0 完成。下方提取了相关输出行，便于确认执行结果。')
      : localized('The process exited with code 0 but produced no standard output.', '进程以退出码 0 完成，但没有产生标准输出。'),
    evidence: evidence.length ? evidence : ['exitCode: 0'],
    suggestions: [],
    verification: {
      status: 'partial',
      title: localized('Process completion verified', '进程完成已验证'),
      explanation: output
        ? localized('Exit code 0 confirms process completion; compare the highlighted output with the expected business result.', '退出码 0 已确认进程完成；请继续将高亮输出与预期业务结果对照。')
        : localized('Exit code 0 confirms process completion, but no semantic output was available to verify the business result.', '退出码 0 已确认进程完成，但没有可用于验证业务结果的语义输出。')
    },
    unverified: [output
      ? localized('Review the highlighted output against the expected behavior of this command.', '请将高亮输出与该命令的预期行为进行比较。')
      : localized('No semantic result was printed, so only process completion can be confirmed.', '没有打印业务结果，因此目前只能确认进程成功结束。')],
    outputSummary: { format: output ? 'text' : 'none', highlights: evidence }
  };
}

export function parseJsonOutput(output) {
  const text = String(output || '').trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}

function isReportedSuccess(value) {
  const status = String(value.status ?? '').toLowerCase();
  const errorsEmpty = Array.isArray(value.errors) && value.errors.length === 0;
  return value.ok === true || value.success === true || ['ok', 'pass', 'passed', 'success', 'successful'].includes(status) || errorsEmpty;
}

function jsonHighlights(value) {
  const preferred = ['status', 'ok', 'success', 'platform', 'platforms', 'checked', 'errors', 'warnings', 'count', 'message', 'result'];
  const keys = [...preferred.filter((key) => key in value), ...Object.keys(value).filter((key) => !preferred.includes(key))].slice(0, 8);
  return keys.map((key) => `${key}: ${displayValue(key, value[key])}`);
}

function displayValue(key, value) {
  if (Array.isArray(value)) {
    if (!value.length) return '0';
    if (key === 'checked') return `${value.length} file${value.length === 1 ? '' : 's'}`;
    if (key === 'errors' || key === 'warnings') return `${value.length}`;
    if (key === 'platforms' || value.every((item) => ['string', 'number', 'boolean'].includes(typeof item)) && value.length <= 4) return value.join(', ');
    return `${value.length} item${value.length === 1 ? '' : 's'}`;
  }
  if (value && typeof value === 'object') return `${Object.keys(value).length} fields`;
  const text = String(value);
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}
