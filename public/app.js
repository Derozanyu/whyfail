const dict = {
  'zh-CN': { local: '本地诊断台', private: '数据保留在本机', history: '诊断历史', workspace: '工作台', export: '导出 Markdown', emptyTitle: '还没有诊断记录', emptyText: '运行一条命令，失败现场会安全地显示在这里。', confidence: '诊断置信度', successConfidence: '结果可信度', rootCause: '最可能原因', resultAssessment: '结果判断', source: '诊断来源', environment: '执行环境', projectType: '项目类型', evidence: '现场证据', keyOutput: '关键输出', nextSteps: '建议排查步骤', confirmation: '确认建议', verification: '验证状态', verifyCommand: '修复后运行', unverified: '尚未验证', rawLogs: '原始日志', copy: '复制', failed: '执行失败', passed: '执行成功', exit: '退出码', evidenceItems: '条', noOutput: '没有输出', copied: '已复制', checks: '项目检查', relatedSource: '相关源码', sourceNote: '按照错误堆栈顺序排列。行号均为源文件的真实行号，不是片段内部编号。', openReport: '打开报告', sourceLine: '源文件第 {line} 行', sourceColumn: '第 {column} 列', snippetRange: '显示源文件第 {start}–{end} 行', errorLocation: '错误位置', darkTheme: '深色', lightTheme: '亮色' },
  en: { local: 'Local diagnostics', private: 'Data stays on this device', history: 'Diagnosis history', workspace: 'Workspace', export: 'Export Markdown', emptyTitle: 'No diagnosis records yet', emptyText: 'Run a command and its failure evidence will appear here.', confidence: 'diagnostic confidence', successConfidence: 'result confidence', rootCause: 'Most likely cause', resultAssessment: 'Result assessment', source: 'Diagnosis source', environment: 'Environment', projectType: 'Project type', evidence: 'Captured evidence', keyOutput: 'Key output', nextSteps: 'Suggested investigation', confirmation: 'Confirmation guidance', verification: 'Verification status', verifyCommand: 'After fixing, run', unverified: 'Unverified', rawLogs: 'Raw logs', copy: 'Copy', failed: 'Command failed', passed: 'Command passed', exit: 'Exit code', evidenceItems: 'items', noOutput: 'No output', copied: 'Copied', checks: 'Project checks', relatedSource: 'Related source', sourceNote: 'Ordered by stack trace. Line numbers are the real source-file lines, not positions inside the snippet.', openReport: 'Open report', sourceLine: 'Source line {line}', sourceColumn: 'column {column}', snippetRange: 'Showing source lines {start}–{end}', errorLocation: 'Error location', darkTheme: 'Dark', lightTheme: 'Light' }
};

const state = { lang: localStorage.getItem('whyfail-lang') || 'zh-CN', theme: document.documentElement.dataset.theme || 'light', runs: [], current: null, stream: 'stderr', animatedRunId: null };
const $ = (id) => document.getElementById(id);

$('language').value = state.lang;
$('language').addEventListener('change', (event) => { state.lang = event.target.value; localStorage.setItem('whyfail-lang', state.lang); renderAll(); });
$('refresh').addEventListener('click', loadRuns);
$('export').addEventListener('click', exportRun);
$('theme-toggle').addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('whyfail-theme', state.theme); applyTheme(); });
$('copy-log').addEventListener('click', async () => { await navigator.clipboard.writeText(state.current?.[state.stream] || ''); $('copy-log').textContent = t('copied'); setTimeout(() => $('copy-log').textContent = t('copy'), 1200); });
document.querySelectorAll('[data-stream]').forEach((button) => button.addEventListener('click', () => { state.stream = button.dataset.stream; document.querySelectorAll('[data-stream]').forEach((item) => item.classList.toggle('active', item === button)); renderLogs(); }));

await loadRuns();

async function loadRuns() {
  state.runs = await fetch('/api/runs').then((response) => response.json());
  const requested = new URLSearchParams(location.search).get('run');
  const id = requested || state.current?.id || state.runs[0]?.id;
  if (id) await selectRun(id, false);
  renderAll();
}

async function selectRun(id, updateUrl = true) {
  state.current = await fetch(`/api/runs/${encodeURIComponent(id)}`).then((response) => response.json());
  state.stream = state.current.stderr?.trim() ? 'stderr' : 'stdout';
  syncStreamTabs();
  if (updateUrl) history.replaceState({}, '', `/?run=${encodeURIComponent(id)}`);
  renderAll();
}

function renderAll() {
  document.documentElement.lang = state.lang;
  applyTheme();
  document.querySelectorAll('[data-i18n]').forEach((node) => node.textContent = t(node.dataset.i18n));
  renderList();
  renderReport();
}

function renderList() {
  $('run-count').textContent = `${state.runs.length} runs`;
  $('run-list').innerHTML = state.runs.map((run) => {
    const title = run.diagnosis?.title?.[state.lang] || run.command;
    return `<button class="run-item ${state.current?.id === run.id ? 'selected' : ''}" data-id="${escapeHtml(run.id)}"><span class="run-state ${run.status}"></span><span class="run-copy"><strong>${escapeHtml(run.command)}</strong><small>${escapeHtml(title || '')}</small></span><time>${relative(run.startedAt)}</time></button>`;
  }).join('');
  document.querySelectorAll('.run-item').forEach((item) => item.addEventListener('click', () => selectRun(item.dataset.id)));
}

function renderReport() {
  const run = state.current;
  $('empty').classList.toggle('hidden', Boolean(run));
  $('report').classList.toggle('hidden', !run);
  if (!run) return;
  if (state.animatedRunId !== run.id) {
    $('report').classList.remove('is-entering');
    void $('report').offsetWidth;
    $('report').classList.add('is-entering');
    state.animatedRunId = run.id;
  }
  const d = run.diagnosis;
  document.querySelector('.diagnosis-card')?.setAttribute('data-code', d?.code ? d.code.slice(0, 2).toUpperCase() : 'WF');
  $('crumb').textContent = run.id;
  $('command').textContent = run.command;
  $('status').textContent = t(run.status);
  $('status-dot').className = run.status;
  $('ecosystem').textContent = run.context?.ecosystem || 'generic';
  $('started').textContent = new Date(run.startedAt).toLocaleString(state.lang);
  $('duration').textContent = formatDuration(run.durationMs);
  $('exit-code').textContent = `${t('exit')}: ${run.exitCode ?? 'N/A'}`;
  const confidence = Math.round((d?.confidence || 0) * 100);
  $('confidence').textContent = `${confidence}%`;
  $('confidence-wrap').style.setProperty('--score', confidence);
  $('confidence-label').textContent = run.status === 'passed' ? t('successConfidence') : t('confidence');
  $('diagnosis-label').textContent = run.status === 'passed' ? t('resultAssessment') : t('rootCause');
  $('evidence-label').textContent = run.status === 'passed' ? t('keyOutput') : t('evidence');
  $('suggestions-label').textContent = run.status === 'passed' ? t('confirmation') : t('nextSteps');
  $('diagnosis-title').textContent = local(d?.title) || (run.status === 'passed' ? t('passed') : '—');
  $('diagnosis-explanation').textContent = local(d?.explanation) || '—';
  $('source').textContent = d?.source || '—';
  $('platform').textContent = run.context?.platform || '—';
  $('runtime').textContent = run.context?.runtime || run.context?.nodeVersion || '—';
  $('project-type').textContent = run.context?.ecosystem || 'generic';
  $('cwd').textContent = run.cwd || '—';
  const evidence = d?.evidence || [];
  $('evidence-count').textContent = `${evidence.length} ${t('evidenceItems')}`;
  $('evidence').innerHTML = evidence.length ? evidence.map((item, i) => `<div class="evidence"><span>${String(i + 1).padStart(2, '0')}</span><code>${escapeHtml(item)}</code></div>`).join('') : '<div class="muted">—</div>';
  $('suggestions').innerHTML = (d?.suggestions || []).map((item, i) => `<div class="step"><span>${i + 1}</span><p>${escapeHtml(local(item))}</p></div>`).join('') || '<div class="muted">—</div>';
  const verification = resolveVerification(d, run);
  $('verification-panel').dataset.status = verification.status;
  $('verification-title').textContent = local(verification.title);
  $('verification-explanation').textContent = local(verification.explanation);
  const pendingChecks = verification.status === 'verified' ? [] : (d?.unverified || []);
  $('unverified').innerHTML = pendingChecks.map((item) => `<p class="verification-check">${escapeHtml(local(item))}</p>`).join('');
  const canRerun = run.kind === 'command' && Array.isArray(run.commandParts) && run.commandParts.length;
  $('verification-command').classList.toggle('hidden', !canRerun);
  $('verification-command-label').textContent = t('verifyCommand');
  $('verification-command-code').textContent = canRerun ? `whyfail verify ${run.id}` : '';
  $('provider-error').classList.toggle('hidden', !d?.providerError);
  $('provider-error').textContent = d?.providerError ? `AI provider: ${d.providerError}` : '';
  renderChecks(run.children || []);
  renderSources(run.context?.sourceFrames || []);
  renderLogs();
}

function resolveVerification(d, run) {
  if (d?.verification?.status) return d.verification;
  if (d?.source === 'builtin-rule' || d?.source === 'check-summary') {
    return {
      status: 'verified',
      title: { en: 'Failure type verified', 'zh-CN': '错误类型已验证' },
      explanation: { en: 'The captured tool output directly confirms this failure class.', 'zh-CN': '已捕获的工具输出直接确认了此错误类型。' }
    };
  }
  if (run?.status === 'passed') {
    return {
      status: 'partial',
      title: { en: 'Process completion verified', 'zh-CN': '进程完成已验证' },
      explanation: { en: 'Exit code 0 confirms process completion; business correctness may still require comparison with expected output.', 'zh-CN': '退出码 0 已确认进程完成；业务结果仍可能需要与预期输出对照。' }
    };
  }
  return {
    status: 'needs-confirmation',
    title: { en: 'Further verification required', 'zh-CN': '需要进一步验证' },
    explanation: { en: 'This diagnosis is still a hypothesis. Use the narrowest relevant compiler, test, or type-check command to confirm it.', 'zh-CN': '当前诊断仍是推测。请使用范围最小的相关编译、测试或类型检查命令进行确认。' }
  };
}

function renderChecks(checks) {
  $('checks-card').classList.toggle('hidden', !checks.length);
  $('checks-count').textContent = `${checks.filter((item) => item.status === 'passed').length}/${checks.length}`;
  $('checks').innerHTML = checks.map((item, index) => `<button class="check-row" data-child-id="${escapeHtml(item.id)}"><span class="check-index">${String(index + 1).padStart(2, '0')}</span><span class="check-status ${item.status}">${item.status === 'passed' ? '✓' : '×'}</span><span class="check-copy"><strong>${escapeHtml(item.name)}</strong><code>${escapeHtml(item.command)}</code></span><span class="check-meta">${formatDuration(item.durationMs)}<small>${item.sourceFrames || 0} files</small></span><span class="check-open">${t('openReport')} →</span></button>`).join('');
  document.querySelectorAll('[data-child-id]').forEach((button) => button.addEventListener('click', () => selectRun(button.dataset.childId)));
}

function renderSources(frames) {
  $('sources-card').classList.toggle('hidden', !frames.length);
  $('sources-count').textContent = `${frames.length} files`;
  $('sources').innerHTML = frames.map((item, index) => {
    const location = formatMessage('sourceLine', { line: item.line });
    const column = item.column ? ` · ${formatMessage('sourceColumn', { column: item.column })}` : '';
    const range = formatMessage('snippetRange', { start: item.startLine, end: item.endLine });
    const lines = item.lines?.length
      ? `<div class="source-code">${item.lines.map((line) => `<div class="source-code-line ${line.isTarget ? 'target' : ''}"><span class="line-number">${line.number}</span><span class="line-marker">${line.isTarget ? '●' : ''}</span><code>${escapeHtml(line.text || ' ')}</code>${line.isTarget ? `<span class="error-label">${t('errorLocation')}</span>` : ''}</div>`).join('')}</div>`
      : `<pre class="legacy-source">${escapeHtml(item.code)}</pre>`;
    return `<details class="source-file" ${index === 0 ? 'open' : ''}><summary><span class="source-order">${String(item.order).padStart(2, '0')}</span><span class="source-summary"><strong>${escapeHtml(item.file)}</strong><span class="source-location">${escapeHtml(location + column)}</span></span><span class="line-pill">${escapeHtml(location)}</span><span class="range-label">${escapeHtml(range)}</span></summary>${lines}</details>`;
  }).join('');
}

function renderLogs() { $('logs').textContent = state.current?.[state.stream] || t('noOutput'); }
function syncStreamTabs() { document.querySelectorAll('[data-stream]').forEach((item) => item.classList.toggle('active', item.dataset.stream === state.stream)); }
function applyTheme() { document.documentElement.dataset.theme = state.theme; $('theme-icon').textContent = state.theme === 'dark' ? '☀' : '☾'; $('theme-label').textContent = state.theme === 'dark' ? t('lightTheme') : t('darkTheme'); $('theme-toggle').setAttribute('aria-label', $('theme-label').textContent); }
function local(value) { return value?.[state.lang] || value?.en || (typeof value === 'string' ? value : ''); }
function t(key) { return dict[state.lang]?.[key] || dict.en[key] || key; }
function formatMessage(key, values) { return Object.entries(values).reduce((message, [name, value]) => message.replace(`{${name}}`, value), t(key)); }
function formatDuration(ms) { return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`; }
function relative(value) { const minutes = Math.floor((Date.now() - new Date(value)) / 60000); return minutes < 1 ? 'now' : minutes < 60 ? `${minutes}m` : new Date(value).toLocaleDateString(state.lang, { month: 'short', day: 'numeric' }); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
function exportRun() {
  if (!state.current) return;
  const run = state.current;
  const d = run.diagnosis || {};
  const verification = resolveVerification(d, run);
  const labels = state.lang === 'zh-CN'
    ? { report: 'WhyFail 诊断报告', command: '命令', result: '结果', cause: '最可能原因', confidence: '置信度', evidence: '证据', steps: '建议排查步骤', verification: '验证状态', environment: '执行环境' }
    : { report: 'WhyFail Diagnostic Report', command: 'Command', result: 'Result', cause: 'Most likely cause', confidence: 'Confidence', evidence: 'Evidence', steps: 'Suggested investigation', verification: 'Verification status', environment: 'Environment' };
  const bullet = (items, mapper = (item) => item) => items?.length ? items.map((item) => `- ${mapper(item)}`).join('\n') : '- —';
  const sources = run.context?.sourceFrames || [];
  const children = run.children || [];
  const markdown = `# ${labels.report}\n\n## ${labels.command}\n\n\`${run.command}\`\n\n## ${labels.result}\n\n- ${t(run.status)}\n- ${t('exit')}: ${run.exitCode ?? 'N/A'}\n- Duration: ${formatDuration(run.durationMs)}\n${children.length ? `\n### ${t('checks')}\n\n${children.map((item) => `- ${item.status === 'passed' ? '✓' : '✗'} ${item.name}: \`${item.command}\``).join('\n')}\n` : ''}\n## ${labels.cause}\n\n**${local(d.title) || '—'}**\n\n${local(d.explanation) || '—'}\n\n${labels.confidence}: ${Math.round((d.confidence || 0) * 100)}%\n\n## ${labels.evidence}\n\n${bullet(d.evidence)}\n\n## ${labels.steps}\n\n${bullet(d.suggestions, local)}\n\n## ${labels.verification}\n\n**${local(verification.title)}**\n\n${local(verification.explanation)}${verification.status !== 'verified' && d.unverified?.length ? `\n\n${bullet(d.unverified, local)}` : ''}\n${sources.length ? `\n## ${t('relatedSource')}\n\n${sources.map((item) => `### ${item.file}:${item.line}\n\n\`\`\`\n${item.code}\n\`\`\``).join('\n\n')}\n` : ''}\n## ${labels.environment}\n\n- OS: ${run.context?.platform || '—'}\n- Runtime: ${run.context?.nodeVersion || '—'}\n- Project: ${run.context?.ecosystem || 'generic'}\n`;
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${run.id}.${state.lang}.md`;
  link.click();
  URL.revokeObjectURL(link.href);
}
