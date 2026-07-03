const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  newProject: () => ipcRenderer.invoke('project:new'),
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (data) => ipcRenderer.invoke('project:save', data),
  saveProjectAs: (data) => ipcRenderer.invoke('project:saveAs', data),
  exportExcel: (data, orientation) => ipcRenderer.invoke('project:exportExcel', data, orientation),
  importExcel: (currentAssignees) => ipcRenderer.invoke('project:importExcel', currentAssignees),
  fetchHolidays: (opts) => ipcRenderer.invoke('holidays:fetch', opts || {}),
  loadLastState: () => ipcRenderer.invoke('state:loadLast'),
  saveLastState: (data) => ipcRenderer.invoke('state:saveLast', data),
  getVersion: () => ipcRenderer.invoke('app:version'),
  listTemplates: () => ipcRenderer.invoke('template:list'),
  saveTemplate: (template) => ipcRenderer.invoke('template:save', template),
  deleteTemplate: (id) => ipcRenderer.invoke('template:delete', id),
  onMenu: (cb) => ipcRenderer.on('menu-action', (_e, action, payload) => cb(action, payload)),
});
