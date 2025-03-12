// electron-client/main.js
const { app, BrowserWindow, ipcMain, Menu, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Keep a global reference of the window objects to prevent garbage collection
let mainWindow = null;
let keyGenWindow = null;

// User's key storage path
const userDataPath = path.join(app.getPath('userData'), 'user_data');
const keyStoragePath = path.join(userDataPath, 'keys');

// Ensure user data directory exists
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}
if (!fs.existsSync(keyStoragePath)) {
  fs.mkdirSync(keyStoragePath, { recursive: true });
}

function createMainWindow() {
  // Try to restore previous window size if available
  let windowSettings = {
    width: 1024,
    height: 768
  };

  try {
    const savedSettings = JSON.parse(localStorage.getItem('windowSettings') || '{}');
    if (savedSettings.width && savedSettings.height) {
      windowSettings.width = savedSettings.width;
      windowSettings.height = savedSettings.height;
    }
  } catch (error) {
    console.error('Error loading saved window settings:', error);
  }

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: windowSettings.width,
    height: windowSettings.height,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the login page
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'login.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Handle window resizing and save dimensions
  mainWindow.on('resize', () => {
    const { width, height } = mainWindow.getBounds();
    try {
      localStorage.setItem('windowSettings', JSON.stringify({ width, height }));
    } catch (error) {
      console.error('Error saving window settings:', error);
    }
  });

  // Create application menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Logout',
          click: () => {
            // Clear any stored auth tokens
            mainWindow.webContents.executeJavaScript(`
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = 'login.html';
            `);
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'About MCP Messenger',
          click: async () => {
            const aboutWindow = new BrowserWindow({
              width: 400,
              height: 300,
              parent: mainWindow,
              modal: true,
              resizable: false,
              webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
              }
            });
            aboutWindow.loadFile(path.join(__dirname, 'renderer', 'about.html'));
            aboutWindow.setMenu(null);
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Window event handlers
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App event handlers
app.on('ready', createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

// IPC handlers for the renderer process

// Save user's keys to disk
ipcMain.handle('save-keys', async (event, { userId, privateKey, publicKey }) => {
  const userKeyPath = path.join(keyStoragePath, `user_${userId}`);
  
  try {
    fs.writeFileSync(`${userKeyPath}.priv`, privateKey);
    fs.writeFileSync(`${userKeyPath}.pub`, publicKey);
    return { success: true };
  } catch (error) {
    console.error('Error saving keys:', error);
    return { success: false, error: error.message };
  }
});

// Load user's keys from disk
ipcMain.handle('load-keys', async (event, { userId }) => {
  const userKeyPath = path.join(keyStoragePath, `user_${userId}`);
  
  try {
    // Check if keys exist
    if (!fs.existsSync(`${userKeyPath}.priv`) || !fs.existsSync(`${userKeyPath}.pub`)) {
      return { success: false, error: 'Keys not found' };
    }
    
    const privateKey = fs.readFileSync(`${userKeyPath}.priv`, 'utf8');
    const publicKey = fs.readFileSync(`${userKeyPath}.pub`, 'utf8');
    
    return { success: true, privateKey, publicKey };
  } catch (error) {
    console.error('Error loading keys:', error);
    return { success: false, error: error.message };
  }
});

// Check if keys exist for a user
ipcMain.handle('check-keys-exist', async (event, { userId }) => {
  const userKeyPath = path.join(keyStoragePath, `user_${userId}`);
  
  try {
    const privateKeyExists = fs.existsSync(`${userKeyPath}.priv`);
    const publicKeyExists = fs.existsSync(`${userKeyPath}.pub`);
    
    return { 
      success: true, 
      exists: privateKeyExists && publicKeyExists 
    };
  } catch (error) {
    console.error('Error checking keys:', error);
    return { success: false, error: error.message };
  }
});

// Delete user's keys from disk
ipcMain.handle('delete-keys', async (event, { userId }) => {
  const userKeyPath = path.join(keyStoragePath, `user_${userId}`);
  
  try {
    if (fs.existsSync(`${userKeyPath}.priv`)) {
      fs.unlinkSync(`${userKeyPath}.priv`);
    }
    if (fs.existsSync(`${userKeyPath}.pub`)) {
      fs.unlinkSync(`${userKeyPath}.pub`);
    }
    return { success: true };
  } catch (error) {
    console.error('Error deleting keys:', error);
    return { success: false, error: error.message };
  }
});

// Show a desktop notification
ipcMain.handle('show-notification', async (event, { title, body }) => {
  if (!Notification.isSupported()) {
    return { success: false, error: 'Notifications not supported' };
  }
  
  const notification = new Notification({
    title,
    body,
  });
  
  notification.show();
  
  // Focus the window when notification is clicked
  notification.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  
  return { success: true };
});

// Navigate to a different page
ipcMain.handle('navigate', async (event, { page }) => {
  if (mainWindow) {
    mainWindow.loadFile(path.join(__dirname, 'renderer', page));
    return { success: true };
  }
  return { success: false, error: 'Main window not available' };
});