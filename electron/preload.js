// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('discover', {
  list: () => ipcRenderer.invoke('discover:list'),
  onSnapshot: (handler) => {
    // handler receives { at, count, list }
    const wrapped = (_evt, payload) => handler?.(payload);
    ipcRenderer.on('discover:snapshot', wrapped);
    // return an unsubscribe for cleanup
    return () => ipcRenderer.off('discover:snapshot', wrapped);
  }
});

contextBridge.exposeInMainWorld('deploy', {
  run: (params) => ipcRenderer.invoke('deploy:run', params)
});