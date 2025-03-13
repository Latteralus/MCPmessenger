// electron-client/preload.js

const { contextBridge, ipcRenderer } = require('electron');
// In your preload.js file, add this to the electronAPI object
updateAdminStatus: (data) => ipcRenderer.invoke('update-admin-status', data);

// Create a simple console logger for the renderer process
const rendererLogger = {
  log: (level, message, data) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    // Pass to main process for file logging
    ipcRenderer.invoke('log', { level, message, data });
    
    // Also log to console
    switch (level) {
      case 'error':
        console.error(logMessage, data || '');
        break;
      case 'warn':
        console.warn(logMessage, data || '');
        break;
      case 'info':
        console.info(logMessage, data || '');
        break;
      case 'debug':
        console.debug(logMessage, data || '');
        break;
      default:
        console.log(logMessage, data || '');
    }
  },
  info: (message, data) => rendererLogger.log('info', message, data),
  warn: (message, data) => rendererLogger.log('warn', message, data),
  error: (message, data) => rendererLogger.log('error', message, data),
  debug: (message, data) => rendererLogger.log('debug', message, data)
};

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI', {
    saveKeys: (data) => ipcRenderer.invoke('save-keys', data),
    loadKeys: (data) => ipcRenderer.invoke('load-keys', data),
    checkKeysExist: (data) => ipcRenderer.invoke('check-keys-exist', data),
    deleteKeys: (data) => ipcRenderer.invoke('delete-keys', data),
    showNotification: (data) => ipcRenderer.invoke('show-notification', data),
    navigate: (data) => ipcRenderer.invoke('navigate', data),
    logger: rendererLogger
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