import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../src/server.js';
import { runAutoCheck } from '../src/auto-runner.js';

const desktopDir = path.dirname(fileURLToPath(import.meta.url));
const allowedProjects = new Set();
let localServer;
let mainWindow;
let checkInProgress = false;

app.setAppUserModelId('com.derozanyu.whyfail');

app.whenReady().then(async () => {
  loadDesktopSettings();
  registerDesktopHandlers();
  const started = await startServer({ port: 0 });
  localServer = started.server;
  mainWindow = createWindow(started.url);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && localServer?.listening) {
    mainWindow = createWindow(`http://127.0.0.1:${localServer.address().port}`);
  }
});

app.on('before-quit', () => localServer?.close());

function createWindow(url) {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1050,
    minHeight: 680,
    backgroundColor: '#151515',
    show: false,
    autoHideMenuBar: true,
    title: 'WhyFail',
    icon: path.join(desktopDir, '..', 'public', 'icon.png'),
    webPreferences: {
      preload: path.join(desktopDir, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const localOrigin = new URL(url).origin;
  window.loadURL(`${url}/?desktop=1`);
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/i.test(target)) shell.openExternal(target);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, target) => {
    if (new URL(target).origin !== localOrigin) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  return window;
}

function registerDesktopHandlers() {
  ipcMain.handle('whyfail:get-settings', () => publicSettings());
  ipcMain.handle('whyfail:save-settings', (_event, value) => saveDesktopSettings(value));

  ipcMain.handle('whyfail:select-project', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择要检查的项目文件夹',
      buttonLabel: '选择此项目',
      properties: ['openDirectory']
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const project = path.resolve(result.filePaths[0]);
    allowedProjects.add(project);
    return project;
  });

  ipcMain.handle('whyfail:run-auto-check', async (_event, selectedPath) => {
    const project = path.resolve(String(selectedPath || ''));
    if (!allowedProjects.has(project)) throw new Error('请先通过“选择项目”按钮选择文件夹。');
    if (!fs.existsSync(project) || !fs.statSync(project).isDirectory()) throw new Error('所选项目文件夹已经不存在。');
    if (checkInProgress) throw new Error('另一个项目检查仍在运行，请稍候。');
    checkInProgress = true;
    try {
      const { plan, run } = await runAutoCheck(project, { quiet: true });
      const failed = run.children.filter((item) => item.status === 'failed').length;
      return { runId: run.id, languages: plan.languages, checks: run.children.length, failed, status: run.status };
    } finally {
      checkInProgress = false;
    }
  });
}

const environmentProvider = {
  apiKey: process.env.WHYFAIL_API_KEY || '',
  baseUrl: process.env.WHYFAIL_BASE_URL || '',
  model: process.env.WHYFAIL_MODEL || ''
};
const settingsDefaults = {
  theme: 'dark',
  language: 'zh-CN',
  baseUrl: environmentProvider.baseUrl || 'https://api.openai.com/v1',
  model: environmentProvider.model || 'gpt-4.1-mini'
};
let desktopSettings = { ...settingsDefaults };

function settingsFile() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadDesktopSettings() {
  try {
    const stored = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    desktopSettings = sanitizeSettings({ ...settingsDefaults, ...stored, encryptedApiKey: stored.encryptedApiKey });
  } catch {
    desktopSettings = { ...settingsDefaults };
  }
  applyProviderEnvironment();
}

function saveDesktopSettings(value = {}) {
  const next = sanitizeSettings({ ...desktopSettings, ...value });
  if (value.clearApiKey) delete next.encryptedApiKey;
  const apiKey = String(value.apiKey || '').trim();
  if (apiKey) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('当前系统安全存储不可用，API Key 未保存。');
    next.encryptedApiKey = safeStorage.encryptString(apiKey).toString('base64');
  }
  desktopSettings = next;
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  const temporary = `${settingsFile()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(desktopSettings, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, settingsFile());
  applyProviderEnvironment();
  return publicSettings();
}

function sanitizeSettings(value) {
  const theme = ['light', 'dark'].includes(value.theme) ? value.theme : settingsDefaults.theme;
  const language = ['zh-CN', 'en'].includes(value.language) ? value.language : settingsDefaults.language;
  const baseUrl = validateBaseUrl(value.baseUrl || settingsDefaults.baseUrl);
  const model = String(value.model || settingsDefaults.model).trim().slice(0, 100);
  return { theme, language, baseUrl, model, ...(value.encryptedApiKey ? { encryptedApiKey: String(value.encryptedApiKey) } : {}) };
}

function validateBaseUrl(value) {
  const text = String(value).trim().replace(/\/$/, '').slice(0, 2048);
  let url;
  try { url = new URL(text); } catch { throw new Error('Base URL 不是有效地址。'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Base URL 仅支持 HTTP 或 HTTPS。');
  return text;
}

function decryptedApiKey() {
  if (!desktopSettings.encryptedApiKey || !safeStorage.isEncryptionAvailable()) return '';
  try { return safeStorage.decryptString(Buffer.from(desktopSettings.encryptedApiKey, 'base64')); } catch { return ''; }
}

function applyProviderEnvironment() {
  const key = decryptedApiKey() || environmentProvider.apiKey;
  if (key) process.env.WHYFAIL_API_KEY = key;
  else delete process.env.WHYFAIL_API_KEY;
  process.env.WHYFAIL_BASE_URL = desktopSettings.baseUrl;
  process.env.WHYFAIL_MODEL = desktopSettings.model;
}

function publicSettings() {
  return {
    theme: desktopSettings.theme,
    language: desktopSettings.language,
    baseUrl: desktopSettings.baseUrl,
    model: desktopSettings.model,
    apiKeyConfigured: Boolean(decryptedApiKey() || environmentProvider.apiKey),
    secureStorage: safeStorage.isEncryptionAvailable()
  };
}
