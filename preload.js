const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('data:load'),
  save: (data) => ipcRenderer.invoke('data:save', data),
  close: () => ipcRenderer.send('win:close'),
  hide: () => ipcRenderer.send('win:hide'),
  minimize: () => ipcRenderer.send('win:minimize'),
  toggleCollapse: () => ipcRenderer.invoke('win:toggle-collapse'),
  getWindowState: () => ipcRenderer.invoke('win:get-state'),
  setAlwaysOnTop: (v) => ipcRenderer.invoke('win:set-top', v),
});
