const port = Number(process.argv[2] || 9333);
const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const page = pages.find((item) => item.type === 'page');
if (!page) throw new Error('No Electron page was exposed by the debugging port.');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});

const expression = `(() => {
  const open = document.getElementById('settings-open');
  open.click();
  return {
    settingsButton: Boolean(open),
    drawerOpened: !document.getElementById('settings-layer').classList.contains('hidden'),
    themeInTopbar: Boolean(document.querySelector('.topbar #theme-toggle')),
    languageInTopbar: Boolean(document.querySelector('.topbar #language')),
    themeInSettings: Boolean(document.querySelector('.settings-panel #theme-toggle')),
    languageInSettings: Boolean(document.querySelector('.settings-panel #language')),
    apiKeyInSettings: Boolean(document.querySelector('.settings-panel #settings-api-key'))
  };
})()`;

const response = await new Promise((resolve) => {
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id === 1) resolve(message);
  };
  socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
});
socket.close();

const result = response.result?.result?.value;
console.log(JSON.stringify(result, null, 2));
if (!result?.settingsButton || !result.drawerOpened || result.themeInTopbar || result.languageInTopbar || !result.themeInSettings || !result.languageInSettings || !result.apiKeyInSettings) {
  throw new Error('Desktop settings layout validation failed.');
}
