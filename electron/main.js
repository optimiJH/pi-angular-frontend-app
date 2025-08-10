// electron/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const hasDevFlag = process.argv.includes('--dev');
const startUrlEnv = process.env.ELECTRON_START_URL; // set by package.json script if used
const isDev = !!startUrlEnv || hasDevFlag;

const discovery = require('./discover');
discovery.start();

let win;

function log(...args){ console.log('[main]', ...args); }

function resolvePreload() {
  const p = path.join(__dirname, 'preload.js');
  log('preload path:', p);
  return p;
}

async function createWindow () {
  log('creating BrowserWindow… (isDev:', isDev, ')');

  try {
    win = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 960,
      minHeight: 640,
      show: false, // show after ready-to-show
      title: 'Pi Dashboard',
      webPreferences: {
        preload: resolvePreload(),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    win.once('ready-to-show', () => {
      log('ready-to-show → show()');
      win.show();
    });
    win.on('unresponsive', () => log('window unresponsive'));
    win.webContents.on('did-fail-load', (_e, ec, ed, vu, host) => {
      log('did-fail-load', { errorCode: ec, errorDesc: ed, validatedURL: vu, host });
    });
    win.webContents.on('crashed', () => log('webContents crashed'));

    const urlToLoad = startUrlEnv || (hasDevFlag ? 'http://localhost:4200' :
      `file://${path.join(__dirname, '../dist/sensor-dashboard/index.html')}`);

    log('loading URL:', urlToLoad);

    await win.loadURL(urlToLoad);

    if (isDev) {
      try { win.webContents.openDevTools({ mode: 'detach' }); } catch {}
    }
  } catch (err) {
    log('createWindow ERROR:', err && (err.stack || err.message || err));
  }

  // Push discovery snapshots to the renderer every 3s
  setInterval(() => {
    try {
      const list = discovery.list();
      if (win && !win.isDestroyed()) {
        win.webContents.send('discover:snapshot', { at: Date.now(), count: list.length, list });
      }
    } catch (e) {}
  }, 3000);

  return win;
}

// IPC for on-demand discovery
ipcMain.handle('discover:list', async () => discovery.list());

// App lifecycle
app.whenReady()
  .then(async () => {
    // Small delay helps if Angular dev server is still warming up
    if (isDev && !startUrlEnv) {
      log('dev flag without ELECTRON_START_URL; giving Angular 1s head-start…');
      await new Promise(r => setTimeout(r, 1000));
    }
    await createWindow();
  })
  .catch(err => log('app.whenReady ERROR:', err));

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
