// electron/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');

const fs = require('fs');
const { NodeSSH } = require('node-ssh');

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

// Pick a local IPv4 to reach the Pi (prefer same /24)
function pickLocalIPv4ForPeer(peerIp) {
  const addrs = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name] || []) {
      if (i && i.family === 'IPv4' && !i.internal) addrs.push(i.address);
    }
  }
  if (!addrs.length) throw new Error('No non-internal IPv4 found on this machine');
  if (peerIp && /^\d+\.\d+\.\d+\.\d+$/.test(peerIp)) {
    const pfx = peerIp.split('.').slice(0, 3).join('.') + '.';
    const same24 = addrs.find(a => a.startsWith(pfx));
    if (same24) return same24;
  }
  return addrs[0];
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

/** ----------------- DEPLOY: copy agent_bundle to Pi and run installer ----------------- */
ipcMain.handle('deploy:run', async (_evt, params) => {
  const { ip, host, inviteKey, serverBase, user = 'jackwu', password = 'nowhere' } = params || {};
  if (!ip) throw new Error('Missing ip');
  if (!inviteKey) throw new Error('Missing inviteKey');

  // Derive SERVER_BASE automatically (prefer same /24 as the Pi)
  const localIPv4 = pickLocalIPv4ForPeer(ip);
  let serverBaseEffective = serverBase && /^https?:\/\//i.test(serverBase) ? serverBase : `http://${localIPv4}:5005`;
  if (/localhost|127\.0\.0\.1/i.test(serverBaseEffective)) {
    serverBaseEffective = `http://${localIPv4}:5005`;
  }
  log('serverBase (auto):', serverBaseEffective);

  // ----- resolve agent_bundle path robustly -----
  const envPath = process.env.AGENT_BUNDLE_PATH; // optional override
  const candidates = [
    envPath,
    path.resolve(__dirname, '..', '..', 'Pi-Backend', 'pi-dotnet-backend-app', 'agent_bundle'),
    path.resolve(__dirname, '..', '..', '..', 'Pi-Backend', 'pi-dotnet-backend-app', 'agent_bundle'),
    path.resolve(__dirname, '..', 'agent_bundle'),
    path.resolve(__dirname, '..', 'public', 'agent_bundle')
  ].filter(Boolean);

  let bundlePath = null;
  for (const p of candidates) { if (fs.existsSync(p)) { bundlePath = p; break; } }
  if (!bundlePath) {
    throw new Error(
      'agent_bundle not found.\nChecked:\n' + candidates.map(p => ' - ' + p).join('\n')
    );
  }
  console.log('[deploy] using agent_bundle =', bundlePath);
  // ----------------------------------------------

  const ssh = new NodeSSH();
  const logs = [];
  const logd = (...a) => { const s = a.join(' '); logs.push(s); console.log('[deploy]', s); };

  try {
    logd('connecting', `${user}@${ip}`);
    await ssh.connect({ host: ip, username: user, password, tryKeyboard: true });

    // Ensure tmp dir
    await ssh.execCommand('mkdir -p ~/pi-agent-tmp');
    // Upload bundle dir
    logd('uploading from', bundlePath);
    await ssh.putDirectory(bundlePath, `/home/${user}/pi-agent-tmp`, { recursive: true, concurrency: 5 });

    // Prepare /etc/pi-agent/agent.env with invite + server (newline-safe)
    logd('writing env');
    const envCmd = `printf "SERVER_BASE=${serverBaseEffective}\\nENROLLMENT_KEY=${inviteKey}\\n" | sudo tee /etc/pi-agent/agent.env`;
    await ssh.execCommand(`sudo mkdir -p /etc/pi-agent && ${envCmd}`);

    // Optional: quick preflight (install.sh also checks)
    try {
      const url = `${serverBaseEffective}/api/agent/version`;
      const r = await fetch(url, { signal: AbortSignal.timeout(1500) }).catch(() => null);
      logd('backend preflight', url, '->', r && r.status);
    } catch {}

    // Run installer
    logd('installing agent');
    const { stdout, stderr } = await ssh.execCommand('cd ~/pi-agent-tmp && sudo bash ./install.sh');
    if (stdout) logd(stdout);
    if (stderr) logd(stderr);

    ssh.dispose();
    return { ok: true, logs };
  } catch (e) {
    try { ssh.dispose(); } catch {}
    logd('ERROR', e.message || String(e));
    throw new Error(logs.join('\n') + '\n' + (e.stack || e.message || e));
  }
});

/** -------------------------------------------------------------------------- */


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
