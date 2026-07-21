const dict = {
  'zh-CN': { local: '本地诊断台', private: '数据保留在本机', history: '诊断历史', workspace: '工作台', export: '导出 Markdown', emptyTitle: '还没有诊断记录', emptyText: '运行一条命令，失败现场会安全地显示在这里。', confidence: '诊断置信度', successConfidence: '结果可信度', rootCause: '最可能原因', resultAssessment: '结果判断', source: '诊断来源', environment: '执行环境', projectType: '项目类型', evidence: '现场证据', keyOutput: '关键输出', nextSteps: '建议排查步骤', confirmation: '确认建议', verification: '验证状态', verifyCommand: '修复后运行', unverified: '尚未验证', rawLogs: '原始日志', copy: '复制', failed: '执行失败', passed: '执行成功', exit: '退出码', evidenceItems: '条', noOutput: '没有输出', copied: '已复制', checks: '项目检查', relatedSource: '相关源码', sourceNote: '按照错误堆栈顺序排列。行号均为源文件的真实行号，不是片段内部编号。', openReport: '打开报告', sourceLine: '源文件第 {line} 行', sourceColumn: '第 {column} 列', snippetRange: '显示源文件第 {start}–{end} 行', errorLocation: '错误位置', darkTheme: '深色', lightTheme: '亮色' },
  en: { local: 'Local diagnostics', private: 'Data stays on this device', history: 'Diagnosis history', workspace: 'Workspace', export: 'Export Markdown', emptyTitle: 'No diagnosis records yet', emptyText: 'Run a command and its failure evidence will appear here.', confidence: 'diagnostic confidence', successConfidence: 'result confidence', rootCause: 'Most likely cause', resultAssessment: 'Result assessment', source: 'Diagnosis source', environment: 'Environment', projectType: 'Project type', evidence: 'Captured evidence', keyOutput: 'Key output', nextSteps: 'Suggested investigation', confirmation: 'Confirmation guidance', verification: 'Verification status', verifyCommand: 'After fixing, run', unverified: 'Unverified', rawLogs: 'Raw logs', copy: 'Copy', failed: 'Command failed', passed: 'Command passed', exit: 'Exit code', evidenceItems: 'items', noOutput: 'No output', copied: 'Copied', checks: 'Project checks', relatedSource: 'Related source', sourceNote: 'Ordered by stack trace. Line numbers are the real source-file lines, not positions inside the snippet.', openReport: 'Open report', sourceLine: 'Source line {line}', sourceColumn: 'column {column}', snippetRange: 'Showing source lines {start}–{end}', errorLocation: 'Error location', darkTheme: 'Dark', lightTheme: 'Light' }
};

const state = { lang: localStorage.getItem('whyfail-lang') || 'zh-CN', theme: document.documentElement.dataset.theme || 'light', runs: [], current: null, stream: 'stderr', animatedRunId: null, repairFormRunId: null, repairPoll: null };
const $ = (id) => document.getElementById(id);
let settingsOriginal = null;
let desktopSettingsView = null;

if (window.whyfailDesktop) {
  document.documentElement.dataset.desktop = 'true';
  $('desktop-project').classList.remove('hidden');
  $('desktop-project').addEventListener('click', chooseAndCheckProject);
}

$('language').value = state.lang;
$('language').addEventListener('change', (event) => { state.lang = event.target.value; localStorage.setItem('whyfail-lang', state.lang); renderAll(); });
$('refresh').addEventListener('click', loadRuns);
$('export').addEventListener('click', exportRun);
$('theme-toggle').addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('whyfail-theme', state.theme); applyTheme(); });
$('settings-open').addEventListener('click', openSettings);
$('settings-close').addEventListener('click', cancelSettings);
$('settings-cancel').addEventListener('click', cancelSettings);
$('settings-backdrop').addEventListener('click', cancelSettings);
$('settings-save').addEventListener('click', saveSettings);
$('settings-key-toggle').addEventListener('click', toggleKeyVisibility);
$('settings-clear-key').addEventListener('change', (event) => { $('settings-api-key').disabled = event.target.checked; });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('settings-layer').classList.contains('hidden')) cancelSettings(); });
$('copy-log').addEventListener('click', async () => { await navigator.clipboard.writeText(state.current?.[state.stream] || ''); $('copy-log').textContent = t('copied'); setTimeout(() => $('copy-log').textContent = t('copy'), 1200); });
$('repair-open').addEventListener('click', async () => {
  const childId = $('repair-open').dataset.childId;
  if (childId) {
    await selectRun(childId);
    state.repairFormRunId = childId;
    $('repair-instruction').value = '';
    $('repair-confirm').checked = false;
    $('repair-start').disabled = true;
    renderRepair(state.current);
    $('repair-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  state.repairFormRunId = state.current?.id || null;
  $('repair-instruction').value = '';
  $('repair-confirm').checked = false;
  $('repair-start').disabled = true;
  $('repair-error').classList.add('hidden');
  renderRepair(state.current);
});
$('repair-cancel').addEventListener('click', () => { state.repairFormRunId = null; $('repair-confirm').checked = false; renderRepair(state.current); });
$('repair-confirm').addEventListener('change', () => { $('repair-start').disabled = !$('repair-confirm').checked; });
$('repair-start').addEventListener('click', startRepairFromUi);
document.querySelectorAll('[data-stream]').forEach((button) => button.addEventListener('click', () => { state.stream = button.dataset.stream; document.querySelectorAll('[data-stream]').forEach((item) => item.classList.toggle('active', item === button)); renderLogs(); }));

await loadDesktopSettings();
await loadRuns();

async function loadDesktopSettings() {
  if (!window.whyfailDesktop) {
    $('settings-base-url').disabled = true;
    $('settings-model').disabled = true;
    $('settings-api-key').disabled = true;
    $('settings-clear-key').disabled = true;
    return;
  }
  try {
    desktopSettingsView = await window.whyfailDesktop.getSettings();
    state.lang = desktopSettingsView.language || state.lang;
    state.theme = desktopSettingsView.theme || state.theme;
    localStorage.setItem('whyfail-lang', state.lang);
    localStorage.setItem('whyfail-theme', state.theme);
    $('language').value = state.lang;
    $('settings-base-url').value = desktopSettingsView.baseUrl || '';
    $('settings-model').value = desktopSettingsView.model || '';
    updateApiStatus();
  } catch (error) {
    showDesktopToast(`设置读取失败：${error.message}`, 'failed', 7000);
  }
}

function openSettings() {
  settingsOriginal = { lang: state.lang, theme: state.theme };
  $('settings-api-key').value = '';
  $('settings-api-key').type = 'password';
  $('settings-api-key').disabled = !window.whyfailDesktop;
  $('settings-clear-key').checked = false;
  $('settings-key-toggle').textContent = state.lang === 'zh-CN' ? '显示' : 'Show';
  $('settings-layer').classList.remove('hidden');
  $('settings-layer').setAttribute('aria-hidden', 'false');
  document.body.classList.add('settings-visible');
  renderSettingsCopy();
  setTimeout(() => $('settings-close').focus(), 0);
}

function closeSettings() {
  $('settings-layer').classList.add('hidden');
  $('settings-layer').setAttribute('aria-hidden', 'true');
  document.body.classList.remove('settings-visible');
  settingsOriginal = null;
  $('settings-open').focus();
}

function cancelSettings() {
  if (settingsOriginal) {
    state.lang = settingsOriginal.lang;
    state.theme = settingsOriginal.theme;
    localStorage.setItem('whyfail-lang', state.lang);
    localStorage.setItem('whyfail-theme', state.theme);
    $('language').value = state.lang;
    renderAll();
  }
  closeSettings();
}

async function saveSettings() {
  const zh = state.lang === 'zh-CN';
  const button = $('settings-save');
  try {
    button.disabled = true;
    if (window.whyfailDesktop) {
      desktopSettingsView = await window.whyfailDesktop.saveSettings({
        theme: state.theme,
        language: state.lang,
        baseUrl: $('settings-base-url').value.trim(),
        model: $('settings-model').value.trim(),
        apiKey: $('settings-api-key').value,
        clearApiKey: $('settings-clear-key').checked
      });
      $('settings-api-key').value = '';
      updateApiStatus();
    }
    closeSettings();
    showDesktopToast(zh ? '设置已保存' : 'Settings saved', 'passed');
  } catch (error) {
    showDesktopToast(`${zh ? '设置保存失败' : 'Could not save settings'}：${error.message}`, 'failed', 7000);
  } finally {
    button.disabled = false;
  }
}

function toggleKeyVisibility() {
  const visible = $('settings-api-key').type === 'text';
  $('settings-api-key').type = visible ? 'password' : 'text';
  $('settings-key-toggle').textContent = state.lang === 'zh-CN' ? (visible ? '显示' : '隐藏') : (visible ? 'Show' : 'Hide');
}

function updateApiStatus() {
  const status = $('settings-api-status');
  const configured = Boolean(desktopSettingsView?.apiKeyConfigured);
  status.dataset.status = configured ? 'configured' : 'none';
  status.textContent = state.lang === 'zh-CN'
    ? (configured ? 'API Key 已安全配置' : (window.whyfailDesktop ? '尚未配置 API Key' : 'API 配置仅在桌面 App 中提供'))
    : (configured ? 'API key is securely configured' : (window.whyfailDesktop ? 'No API key configured' : 'API setup is available in the desktop app'));
}

function renderSettingsCopy() {
  const zh = state.lang === 'zh-CN';
  const values = zh ? {
    open: '设置', kicker: 'WhyFail 偏好', title: '设置', appearance: '外观与语言', appearanceCopy: '调整报告的阅读方式，只影响本机。', theme: '颜色主题', language: '界面语言', ai: 'AI 深度分析', aiCopy: '可选。未配置时继续使用本地规则诊断。', clear: '删除已保存的 API Key', security: '桌面版使用 Windows 安全存储加密 Key；Key 不会写入诊断报告或黑匣子。', cancel: '取消', save: '保存设置'
  } : {
    open: 'Settings', kicker: 'WhyFail preferences', title: 'Settings', appearance: 'Appearance & language', appearanceCopy: 'Change how reports are presented on this device.', theme: 'Color theme', language: 'Interface language', ai: 'AI deep analysis', aiCopy: 'Optional. Local rule-based diagnosis remains available without it.', clear: 'Delete the saved API key', security: 'The desktop app encrypts the key with Windows secure storage. It is never written to reports or black-box records.', cancel: 'Cancel', save: 'Save settings'
  };
  const ids = { 'settings-open-label': 'open', 'settings-kicker': 'kicker', 'settings-title': 'title', 'settings-appearance-title': 'appearance', 'settings-appearance-copy': 'appearanceCopy', 'settings-theme-label': 'theme', 'settings-language-label': 'language', 'settings-ai-title': 'ai', 'settings-ai-copy': 'aiCopy', 'settings-clear-key-label': 'clear', 'settings-security-note': 'security', 'settings-cancel': 'cancel', 'settings-save': 'save' };
  for (const [id, key] of Object.entries(ids)) $(id).textContent = values[key];
  $('settings-api-key').placeholder = zh ? '输入新 Key；留空则保持不变' : 'Enter a new key; leave blank to keep it';
  $('settings-key-toggle').textContent = zh ? ($('settings-api-key').type === 'text' ? '隐藏' : '显示') : ($('settings-api-key').type === 'text' ? 'Hide' : 'Show');
  updateApiStatus();
}

async function chooseAndCheckProject() {
  const button = $('desktop-project');
  const label = $('desktop-project-label');
  const zh = state.lang === 'zh-CN';
  try {
    const project = await window.whyfailDesktop.selectProject();
    if (!project) return;
    button.disabled = true;
    label.textContent = zh ? '正在检查…' : 'Checking…';
    showDesktopToast(zh ? `正在自动识别并检查：${project}` : `Detecting and checking: ${project}`, 'working');
    const result = await window.whyfailDesktop.runAutoCheck(project);
    await loadRuns();
    await selectRun(result.runId);
    const languageText = result.languages.join(', ');
    showDesktopToast(
      zh
        ? `检查完成：${languageText}，${result.checks} 项中 ${result.failed} 项失败`
        : `Finished: ${languageText}; ${result.failed} of ${result.checks} checks failed`,
      result.failed ? 'failed' : 'passed'
    );
  } catch (error) {
    showDesktopToast(`${zh ? '检查失败' : 'Check failed'}：${error.message}`, 'failed', 7000);
  } finally {
    button.disabled = false;
    label.textContent = zh ? '选择项目' : 'Choose project';
  }
}

function showDesktopToast(message, status = 'working', timeout = 4500) {
  const toast = $('desktop-toast');
  toast.textContent = message;
  toast.dataset.status = status;
  toast.classList.remove('hidden');
  clearTimeout(showDesktopToast.timer);
  if (status !== 'working') showDesktopToast.timer = setTimeout(() => toast.classList.add('hidden'), timeout);
}

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
  renderSettingsCopy();
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
  renderRepair(run);
  renderBlackBox(run.blackBox);
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

function renderRepair(run) {
  clearTimeout(state.repairPoll);
  state.repairPoll = null;
  const card = $('repair-card');
  const eligible = run?.status === 'failed' && run.kind === 'command' && Array.isArray(run.commandParts) && run.commandParts.length;
  const failedChildren = run?.status === 'failed' ? (run.children || []).filter((item) => item.status === 'failed') : [];
  const failedChild = failedChildren[0];
  const suiteEntry = !eligible && Boolean(failedChild);
  card.classList.toggle('hidden', !eligible && !suiteEntry);
  if (!eligible && !suiteEntry) return;

  const zh = state.lang === 'zh-CN';
  const session = run.blackBox?.repairSession;
  $('repair-open').dataset.childId = suiteEntry ? failedChild.id : '';
  $('repair-kicker').textContent = zh ? 'Agent 修复' : 'Agent repair';
  $('repair-title').textContent = suiteEntry
    ? (zh ? `修复失败项：${failedChild.name}` : `Repair failed check: ${failedChild.name}`)
    : (zh ? '让 Agent 在隔离副本中尝试修复' : 'Let an Agent repair an isolated copy');
  $('repair-description').textContent = suiteEntry
    ? (zh ? '当前是多命令汇总报告。点击后会自动打开失败的子报告，并展开修改要求输入框。' : 'This is a multi-command summary. Continue to the failed child report and open its repair instructions.')
    : (zh ? 'WhyFail 不会自动修改代码。只有你明确确认后，Agent 才会收到诊断证据和你的修改要求。' : 'WhyFail never edits code automatically. The Agent receives the evidence and your instructions only after explicit confirmation.');
  $('repair-open').textContent = suiteEntry ? (zh ? '打开失败项并修复' : 'Open failed check and repair') : (zh ? '交给 Agent 修复' : 'Ask an Agent to repair');
  $('repair-instruction-label').textContent = zh ? '你希望 Agent 怎么修改？' : 'How should the Agent approach the repair?';
  $('repair-instruction').placeholder = zh
    ? '例如：尽量只做最小修改；不要重构登录模块；保持现有函数名称。'
    : 'For example: make the smallest change; do not refactor authentication; keep existing function names.';
  $('repair-attempts-label').textContent = zh ? '最多尝试次数' : 'Maximum attempts';
  $('repair-agent-label').textContent = 'Agent';
  $('repair-confirm-label').textContent = zh
    ? '我确认开始修复。修改发生在隔离副本中，原项目不会被自动覆盖。'
    : 'I confirm this repair. Changes stay in an isolated copy and never overwrite the original project automatically.';
  $('repair-cancel').textContent = zh ? '取消' : 'Cancel';
  $('repair-start').textContent = zh ? '开始修复' : 'Start repair';

  $('repair-idle').classList.toggle('hidden', !suiteEntry && (Boolean(session) || state.repairFormRunId === run.id));
  $('repair-form').classList.toggle('hidden', suiteEntry || Boolean(session) || state.repairFormRunId !== run.id);
  $('repair-session').classList.toggle('hidden', !session);
  if (!session) {
    $('repair-status-badge').textContent = suiteEntry
      ? (zh ? `${failedChildren.length} 个失败项` : `${failedChildren.length} failed check${failedChildren.length === 1 ? '' : 's'}`)
      : (zh ? '等待用户决定' : 'Awaiting user');
    return;
  }

  const statusLabels = {
    running: zh ? '修复中' : 'Repairing',
    resolved: zh ? '修复成功' : 'Resolved',
    blocked_environment: zh ? '环境阻塞' : 'Environment blocked',
    agent_stalled: zh ? 'Agent 无进展' : 'Agent stalled',
    agent_unavailable: zh ? 'Agent 不可用' : 'Agent unavailable',
    agent_failed: zh ? 'Agent 执行失败' : 'Agent failed',
    attempts_exhausted: zh ? '达到尝试上限' : 'Attempts exhausted',
    internal_error: zh ? '内部错误' : 'Internal error'
  };
  $('repair-status-badge').textContent = statusLabels[session.status] || session.status;
  $('repair-summary').innerHTML = `<strong>${escapeHtml(statusLabels[session.status] || session.status)}</strong><span>${escapeHtml(session.id)}</span><p>${zh ? '隔离工作目录' : 'Isolated workspace'}: <code>${escapeHtml(session.workspace)}</code></p>`;
  $('repair-user-prompt').innerHTML = `<span>${zh ? '用户修改要求' : 'User instructions'}</span><p>${escapeHtml(session.userInstruction || (zh ? '未填写，使用最小安全修改原则。' : 'None supplied; use the smallest safe change.'))}</p>`;
  $('repair-timeline').innerHTML = session.attempts.map((attempt) => {
    const changed = attempt.changedFiles?.length
      ? `<div class="repair-files">${attempt.changedFiles.map((item) => `<code>${escapeHtml(item.kind)} · ${escapeHtml(item.path)}</code>`).join('')}</div>`
      : '';
    const verification = attempt.verificationRunId
      ? `<button class="repair-verification" data-validation-id="${escapeHtml(attempt.verificationRunId)}">${zh ? '查看验证报告' : 'Open verification report'} →</button>`
      : '';
    const output = attempt.agentOutput || attempt.agentError
      ? `<details><summary>${zh ? 'Agent 输出' : 'Agent output'}</summary><pre>${escapeHtml([attempt.agentOutput, attempt.agentError].filter(Boolean).join('\n'))}</pre></details>`
      : '';
    return `<article class="repair-attempt" data-status="${escapeHtml(attempt.status)}"><div class="repair-attempt-number">${String(attempt.number).padStart(2, '0')}</div><div><h3>${zh ? `第 ${attempt.number} 次尝试` : `Attempt ${attempt.number}`}</h3><p>${escapeHtml(attempt.status)} · ${escapeHtml(attempt.diagnosisBefore || 'unknown')} → ${escapeHtml(attempt.diagnosisAfter || 'pending')}</p>${changed}${output}${verification}</div></article>`;
  }).join('');
  document.querySelectorAll('[data-validation-id]').forEach((button) => button.addEventListener('click', () => selectRun(button.dataset.validationId)));
  $('repair-result').innerHTML = session.status === 'running'
    ? `<p>${zh ? 'WhyFail 正在等待 Agent 或执行验证。页面会自动更新。' : 'WhyFail is waiting for the Agent or running verification. This page updates automatically.'}</p>`
    : `<strong>${escapeHtml(session.stopReason || '')}</strong><p>${zh ? '原项目没有被自动覆盖；隔离副本和全部尝试记录均已保留。' : 'The original project was not overwritten; the isolated copy and every attempt remain available.'}</p>`;
  if (session.status === 'running') {
    state.repairPoll = setTimeout(() => selectRun(run.id, false), 1400);
  }
}

async function startRepairFromUi() {
  const run = state.current;
  if (!run || !$('repair-confirm').checked) return;
  $('repair-start').disabled = true;
  $('repair-error').classList.add('hidden');
  try {
    const response = await fetch(`/api/runs/${encodeURIComponent(run.id)}/repair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        instruction: $('repair-instruction').value,
        maxAttempts: Number($('repair-attempts').value)
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    state.repairFormRunId = null;
    await selectRun(run.id, false);
  } catch (error) {
    $('repair-error').textContent = error.message;
    $('repair-error').classList.remove('hidden');
    $('repair-start').disabled = false;
  }
}

function renderBlackBox(blackBox) {
  const card = $('blackbox-card');
  card.classList.toggle('hidden', !blackBox);
  if (!blackBox) return;
  const zh = state.lang === 'zh-CN';
  card.querySelector('.card-kicker').textContent = zh ? '黑匣子记录' : 'Black-box recording';
  const snapshot = blackBox.after || blackBox.before || {};
  const host = snapshot.host || {};
  const disk = snapshot.disk || {};
  const git = snapshot.git || {};
  const environment = snapshot.environment || {};
  const baseline = blackBox.baseline;
  const changes = baseline?.changes || [];
  const recentFiles = snapshot.recentFiles || [];
  const executionFiles = blackBox.executionDelta?.projectFilesChanged || [];

  $('blackbox-badge').textContent = zh ? '本地快照' : 'Local snapshot';
  $('blackbox-baseline').innerHTML = baseline
    ? `<strong>${zh ? '与最近一次成功运行对比' : 'Compared with the latest successful run'}</strong><button data-baseline-id="${escapeHtml(baseline.runId)}">${escapeHtml(baseline.runId)} →</button><p>${changes.length ? (zh ? `发现 ${changes.length} 项环境变化。` : `${changes.length} environment changes found.`) : (zh ? '环境与上次成功时没有发现可见差异。' : 'No visible environment differences from the last success.')}</p>`
    : `<strong>${zh ? '首次基线' : 'First baseline'}</strong><p>${zh ? '同一命令成功运行后，后续失败会自动与它比较。' : 'After this command succeeds, later failures will be compared with it automatically.'}</p>`;

  const facts = [
    { label: 'Git', value: git.available ? `${git.branch || '(detached)'} @ ${String(git.commit || '').slice(0, 10)}${git.dirty ? ` · ${zh ? '有未提交修改' : 'modified'}` : ` · ${zh ? '干净' : 'clean'}`}` : (zh ? '不可用或不是 Git 项目' : 'Unavailable or not a Git project') },
    { label: zh ? '内存' : 'Memory', value: `${formatBytes(host.freeMemoryBytes)} ${zh ? '可用 /' : 'free /'} ${formatBytes(host.totalMemoryBytes)}` },
    { label: zh ? '磁盘' : 'Disk', value: disk.unavailable ? (zh ? '无法读取' : 'Unavailable') : `${formatBytes(disk.freeBytes)} ${zh ? '可用 /' : 'free /'} ${formatBytes(disk.totalBytes)}` },
    { label: zh ? 'CPU' : 'CPU', value: `${host.cpuCount || '—'} × ${host.cpuModel || '—'}` },
    { label: zh ? '环境标记' : 'Environment', value: environment.present?.length ? environment.present.join(', ') : (zh ? '未发现常用运行环境变量' : 'No common runtime variables found') },
    { label: zh ? '代理 / CI' : 'Proxy / CI', value: `${environment.proxyConfigured ? (zh ? '已配置代理' : 'proxy configured') : (zh ? '无代理' : 'no proxy')} · ${environment.ci ? 'CI' : (zh ? '本地' : 'local')}` }
  ];
  $('blackbox-facts').innerHTML = facts.map((item) => `<div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join('');

  const sections = [];
  if (changes.length) {
    sections.push(`<details open><summary>${zh ? '上次成功后发生的变化' : 'Changes since the last success'} <span>${changes.length}</span></summary><div class="blackbox-change-list">${changes.map((item) => `<div><code>${escapeHtml(item.category)} · ${escapeHtml(item.key)}</code><span>${escapeHtml(item.before)} → ${escapeHtml(item.after)}</span></div>`).join('')}</div></details>`);
  }
  if (executionFiles.length) {
    sections.push(`<details><summary>${zh ? '本次命令执行期间变化的项目文件' : 'Project files changed during this command'} <span>${executionFiles.length}</span></summary><div class="blackbox-change-list">${executionFiles.map((item) => `<div><code>${escapeHtml(item.key)}</code><span>${escapeHtml(item.before)} → ${escapeHtml(item.after)}</span></div>`).join('')}</div></details>`);
  }
  if (git.changedFiles?.length) {
    sections.push(`<details><summary>${zh ? 'Git 未提交文件' : 'Uncommitted Git files'} <span>${git.changedFiles.length}${git.truncated ? '+' : ''}</span></summary><div class="blackbox-file-list">${git.changedFiles.map((item) => `<code>${escapeHtml(item)}</code>`).join('')}</div></details>`);
  }
  if (recentFiles.length) {
    sections.push(`<details><summary>${zh ? '最近 24 小时修改的源码' : 'Source files changed in the last 24 hours'} <span>${recentFiles.length}</span></summary><div class="blackbox-file-list">${recentFiles.map((item) => `<code>${escapeHtml(item.path)} <small>${escapeHtml(new Date(item.modifiedAt).toLocaleString(state.lang))}</small></code>`).join('')}</div></details>`);
  }
  $('blackbox-changes').innerHTML = sections.join('');
  document.querySelector('[data-baseline-id]')?.addEventListener('click', (event) => selectRun(event.currentTarget.dataset.baselineId));
}

function renderLogs() { $('logs').textContent = state.current?.[state.stream] || t('noOutput'); }
function syncStreamTabs() { document.querySelectorAll('[data-stream]').forEach((item) => item.classList.toggle('active', item.dataset.stream === state.stream)); }
function applyTheme() { document.documentElement.dataset.theme = state.theme; $('theme-icon').textContent = state.theme === 'dark' ? '☀' : '☾'; $('theme-label').textContent = state.theme === 'dark' ? t('lightTheme') : t('darkTheme'); $('theme-toggle').setAttribute('aria-label', $('theme-label').textContent); }
function local(value) { return value?.[state.lang] || value?.en || (typeof value === 'string' ? value : ''); }
function t(key) { return dict[state.lang]?.[key] || dict.en[key] || key; }
function formatMessage(key, values) { return Object.entries(values).reduce((message, [name, value]) => message.replace(`{${name}}`, value), t(key)); }
function formatDuration(ms) { return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`; }
function formatBytes(value) {
  if (!Number.isFinite(value)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = value;
  let unit = 0;
  while (Math.abs(amount) >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1; }
  return `${amount.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
}
function blackBoxMarkdown(blackBox) {
  if (!blackBox) return '';
  const zh = state.lang === 'zh-CN';
  const snapshot = blackBox.after || blackBox.before || {};
  const git = snapshot.git || {};
  const changes = blackBox.baseline?.changes || [];
  const lines = [
    `## ${zh ? '黑匣子记录' : 'Black-box recording'}`,
    '',
    `- ${blackBox.baseline ? `${zh ? '对比基线' : 'Compared baseline'}: ${blackBox.baseline.runId}` : (zh ? '首次基线' : 'First baseline')}`,
    `- Git: ${git.available ? `${git.branch || '(detached)'} @ ${String(git.commit || '').slice(0, 10)} · ${git.dirty ? 'modified' : 'clean'}` : 'unavailable'}`,
    `- ${zh ? '可用内存' : 'Free memory'}: ${formatBytes(snapshot.host?.freeMemoryBytes)}`,
    `- ${zh ? '可用磁盘' : 'Free disk'}: ${formatBytes(snapshot.disk?.freeBytes)}`,
    `- ${zh ? '环境变量值已保存' : 'Environment values stored'}: no`
  ];
  if (changes.length) {
    lines.push('', `### ${zh ? '上次成功后发生的变化' : 'Changes since the last success'}`, '');
    lines.push(...changes.map((item) => `- \`${item.category} · ${item.key}\`: ${item.before} → ${item.after}`));
  }
  return `\n${lines.join('\n')}\n`;
}
function repairSessionMarkdown(session) {
  if (!session) return '';
  const zh = state.lang === 'zh-CN';
  const lines = [
    `## ${zh ? 'Agent 修复记录' : 'Agent repair record'}`,
    '',
    `- Status: ${session.status}`,
    `- Repair ID: ${session.id}`,
    `- ${zh ? '隔离工作目录' : 'Isolated workspace'}: \`${session.workspace}\``,
    `- ${zh ? '原项目自动覆盖' : 'Original project overwritten'}: no`,
    '',
    `### ${zh ? '用户修改要求' : 'User instructions'}`,
    '',
    session.userInstruction || (zh ? '未填写。' : 'None supplied.')
  ];
  for (const attempt of session.attempts || []) {
    lines.push('', `### ${zh ? `第 ${attempt.number} 次尝试` : `Attempt ${attempt.number}`}`, '');
    lines.push(`- Status: ${attempt.status}`);
    lines.push(`- Diagnosis: ${attempt.diagnosisBefore || 'unknown'} → ${attempt.diagnosisAfter || 'pending'}`);
    lines.push(`- Verification run: ${attempt.verificationRunId || '—'}`);
    for (const file of attempt.changedFiles || []) lines.push(`- \`${file.kind} · ${file.path}\``);
  }
  if (session.stopReason) lines.push('', `**${zh ? '停止原因' : 'Stop reason'}:** ${session.stopReason}`);
  return `\n${lines.join('\n')}\n`;
}
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
  const exportedMarkdown = markdown + blackBoxMarkdown(run.blackBox) + repairSessionMarkdown(run.blackBox?.repairSession);
  const blob = new Blob([exportedMarkdown], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${run.id}.${state.lang}.md`;
  link.click();
  URL.revokeObjectURL(link.href);
}
