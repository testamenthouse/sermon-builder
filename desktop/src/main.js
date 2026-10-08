const { app, BrowserWindow, Menu, dialog, ipcMain, nativeTheme, net, protocol, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { pathToFileURL } = require('url');
const { autoUpdater } = require('electron-updater');
const dictate = require('./dictate.js');

app.setName('Sermon Builder');
const SCHEME = 'app';
const ORIGIN = `${SCHEME}://sermon`;
const APP_DIR = path.join(__dirname, '..', 'app');
const SMOKE = !!process.env.SERMON_SMOKE;
const CONFIG = () => path.join(app.getPath('userData'), 'config.json');

protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

function serveApp() {
  protocol.handle(SCHEME, (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(APP_DIR, rel));
    if (!file.startsWith(APP_DIR)) return new Response('', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

// ---- library: one folder, remembered in userData/config.json (which the MCP server also reads)
let library = null, watcher = null, win = null;
function readConfig() { try { return JSON.parse(fs.readFileSync(CONFIG(), 'utf8')) || {}; } catch (e) { return {}; } }
function writeConfig(patch) { const cfg = { ...readConfig(), ...patch }; fs.mkdirSync(path.dirname(CONFIG()), { recursive: true }); fs.writeFileSync(CONFIG(), JSON.stringify(cfg, null, 2) + '\n'); }
function inside(rel) {
  if (!library) throw new Error('no library');
  const abs = path.resolve(library, rel || '.');
  if (abs !== library && !abs.startsWith(library + path.sep)) throw new Error('outside library');
  return abs;
}
let changeTimer = null;
function startWatch() {
  stopWatch(); if (!library) return;
  try { watcher = fs.watch(library, { recursive: true }, () => { clearTimeout(changeTimer); changeTimer = setTimeout(() => { if (win && !win.isDestroyed()) win.webContents.send('lib:changed'); }, 250); }); watcher.on('error', () => {}); } catch (e) { watcher = null; }
}
function stopWatch() { if (watcher) { watcher.close(); watcher = null; } }
function setLibrary(dir) { library = dir ? path.resolve(dir) : null; writeConfig({ library }); startWatch(); return library ? { name: path.basename(library) } : null; }
async function walk(dir, rel, out) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const p = rel ? rel + '/' + e.name : e.name, abs = path.join(dir, e.name);
    if (e.isDirectory()) { out.push({ path: p, kind: 'dir', mtime: 0, size: 0 }); await walk(abs, p, out); }
    else if (e.isFile()) { const st = await fsp.stat(abs); out.push({ path: p, kind: 'file', mtime: Math.round(st.mtimeMs), size: st.size }); }
  }
}
function mcpCommand() {
  const server = app.isPackaged ? path.join(process.resourcesPath, 'bundle', 'mcp', 'server.js') : path.resolve(__dirname, '..', '..', 'mcp', 'server.js');
  return 'claude mcp add sermon-builder -- node ' + JSON.stringify(server);
}
function wireIpc() {
  ipcMain.handle('lib:pick', async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    return setLibrary(r.filePaths[0]);
  });
  ipcMain.handle('lib:resume', async () => {
    const cfg = readConfig(); if (!cfg.library) return null;
    try { const st = await fsp.stat(cfg.library); if (!st.isDirectory()) throw new Error('x'); } catch (e) { writeConfig({ library: null }); return { error: 'Folder not found' }; }
    return setLibrary(cfg.library);
  });
  ipcMain.handle('lib:forget', async () => { stopWatch(); library = null; writeConfig({ library: null }); });
  ipcMain.handle('lib:path', async () => library || '');
  ipcMain.handle('lib:mcp', async () => mcpCommand());
  ipcMain.handle('lib:reveal', async (e, p) => { shell.showItemInFolder(inside(p)); });
  ipcMain.handle('fs:list', async () => { const out = []; await walk(inside(''), '', out); return out; });
  ipcMain.handle('fs:read', (e, p) => fsp.readFile(inside(p), 'utf8'));
  ipcMain.handle('fs:write', async (e, p, text) => { const abs = inside(p); await fsp.mkdir(path.dirname(abs), { recursive: true }); const tmp = abs + '.tmp-' + process.pid; await fsp.writeFile(tmp, text, 'utf8'); await fsp.rename(tmp, abs); });
  ipcMain.handle('fs:remove', (e, p) => fsp.rm(inside(p), { recursive: true, force: true }));
  ipcMain.handle('fs:rename', async (e, a, b) => { const to = inside(b); await fsp.mkdir(path.dirname(to), { recursive: true }); await fsp.rename(inside(a), to); });
  ipcMain.handle('fs:mkdir', (e, p) => fsp.mkdir(inside(p), { recursive: true }));
}

// ---- updates
let updateReady = false, checking = false;
autoUpdater.autoDownload = true; autoUpdater.autoInstallOnAppQuit = true; autoUpdater.logger = null;
autoUpdater.on('update-downloaded', () => { updateReady = true; buildMenu(); });
autoUpdater.on('error', () => { checking = false; });
async function checkForUpdates(manual) {
  if (!app.isPackaged || checking) return; checking = true;
  try { const r = await autoUpdater.checkForUpdates(); if (manual && !(r && r.isUpdateAvailable) && !updateReady) await dialog.showMessageBox({ message: 'Up to date', buttons: ['OK'] }); }
  catch (e) { if (manual) await dialog.showMessageBox({ type: 'error', message: 'Could not check for updates', buttons: ['OK'] }); }
  finally { checking = false; }
}
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const updateItems = [updateReady ? { label: 'Restart to Update', click: () => autoUpdater.quitAndInstall() } : { label: 'Check for Updates…', click: () => checkForUpdates(true) }, { type: 'separator' }];
  const template = [
    ...(isMac ? [{ label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, ...updateItems, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    { label: 'File', submenu: [{ label: 'Open Library…', accelerator: 'CmdOrCtrl+O', click: () => win && win.webContents.send('menu:open') }, { type: 'separator' }, { label: 'Print…', accelerator: 'CmdOrCtrl+P', click: () => win && win.webContents.send('menu:print') }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }])] },
    ...(isMac ? [] : [{ label: 'Help', submenu: updateItems }])
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1320, height: 880, minWidth: 760, minHeight: 500, title: 'Sermon Builder',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1f1f1f' : '#ffffff', show: false, titleBarStyle: 'hiddenInset',
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') }
  });
  win.once('ready-to-show', () => { if (!SMOKE) win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(ORIGIN)) { e.preventDefault(); shell.openExternal(url); } });
  win.on('closed', () => { win = null; });
  if (SMOKE) {
    win.webContents.on('console-message', (e, level, msg) => { if (level >= 2) console.log('SMOKE console: ' + msg); });
    win.webContents.on('did-finish-load', async () => {
      await new Promise(r => setTimeout(r, 2500));
      try {
        const r = await win.webContents.executeJavaScript(`(async () => ({ title: document.title, origin: location.origin, text: document.body.innerText.trim().replace(/\\s+/g, ' ').slice(0, 80), bridge: typeof window.sermon, font: document.fonts.check('600 20px Inter'), kjv: !!(window.SB && window.SB.kjv && window.SB.lib.bible.lookupNow('John 3:16')) }))()`);
        console.log('SMOKE ' + JSON.stringify(r));
        if (process.env.DICTATE_BIN) {
          const d = await win.webContents.executeJavaScript(`new Promise(res => { const evs = []; window.dictate.on(ev => { evs.push(ev.t + (ev.text ? ':' + ev.text : '')); if (ev.t === 'exit') res(evs); }); window.dictate.start('en-US').then(ok => { if (!ok) res(['start:false']); setTimeout(() => window.dictate.stop(), 1200); }); setTimeout(() => res(evs.concat('timeout')), 6000); })`);
          console.log('SMOKE dictate ' + JSON.stringify(d));
        }
      } catch (e) { console.log('SMOKE ERROR ' + e.message); }
      app.exit(0);
    });
  }
  win.loadURL(`${ORIGIN}/index.html`);
}

app.whenReady().then(() => {
  serveApp(); wireIpc(); dictate.wire(() => win); buildMenu(); createWindow();
  checkForUpdates(false); setInterval(() => checkForUpdates(false), 60 * 60 * 1000);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
