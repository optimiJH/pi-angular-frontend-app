const { app, BrowserWindow } = require('electron');
const path = require('path');

/** Simple flag: pass `--dev` when electron starts */
const isDev = process.argv.includes('--dev');

function createWindow () {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  if (isDev) {
    // Angular dev server
    win.loadURL('http://localhost:4200');
    win.webContents.openDevTools();          // optional, see live console
  } else {
    // Production bundle
    win.loadFile(path.join(__dirname, '../dist/sensor-dashboard/index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
