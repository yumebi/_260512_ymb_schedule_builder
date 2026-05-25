const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  newProject: () => ipcRenderer.invoke('project:new'),
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (data) => ipcRenderer.invoke('project:save', data),
  saveProjectAs: (data) => ipcRenderer.invoke('project:saveAs', data),
  exportExcel: (data, orientation) => ipcRenderer.invoke('project:exportExcel', data, orientation),
  fetchHolidays: (opts) => ipcRenderer.invoke('holidays:fetch', opts || {}),
  loadLastState: () => ipcRenderer.invoke('state:loadLast'),
  saveLastState: (data) => ipcRenderer.invoke('state:saveLast', data),
  onMenu: (cb) => ipcRenderer.on('menu-action', (_e, action) => cb(action)),
});
