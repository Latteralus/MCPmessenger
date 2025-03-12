// electron-client/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI', {
    saveKeys: (data) => ipcRenderer.invoke('save-keys', data),
    loadKeys: (data) => ipcRenderer.invoke('load-keys', data),
    checkKeysExist: (data) => ipcRenderer.invoke('check-keys-exist', data),
    deleteKeys: (data) => ipcRenderer.invoke('delete-keys', data),
    showNotification: (data) => ipcRenderer.invoke('show-notification', data),
    navigate: (data) => ipcRenderer.invoke('navigate', data)
  }
);

// Expose Node.js process versions
contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
});

// Expose a minimal version of the tweetnacl library functions
contextBridge.exposeInMainWorld('cryptoAPI', {
  // This will be implemented in the renderer scripts where we'll import TweetNaCl
});

// Expose server connection settings
contextBridge.exposeInMainWorld('serverConfig', {
  baseUrl: 'http://localhost:3000',
  socketUrl: 'http://localhost:3000'
});