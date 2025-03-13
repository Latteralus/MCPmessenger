// electron-client/main.js
const { app, BrowserWindow, ipcMain, Menu, shell, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const logger = require('./utils/logger');
const errorHandler = require('./utils/errorHandler');

// Keep a global reference of the window objects to prevent garbage collection
let mainWindow = null;
let keyGenWindow = null;

// User's key storage path
const userDataPath = path.join(app.getPath('userData'), 'user_data');
const keyStoragePath = path.join(userDataPath, 'keys');

// Ensure user data directory exists
try {
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
    logger.info(`Created user data directory: ${userDataPath}`);
  }
  if (!fs.existsSync(keyStoragePath)) {
    fs.mkdirSync(keyStoragePath, { recursive: true });
    logger.info(`Created key storage directory: ${keyStoragePath}`);
  }
} catch (error) {
  logger.error('Failed to create data directories', error);
  dialog.showErrorBox(
    'Initialization Error',
    'Failed to create application data directories. The application may not function correctly.'
  );
}

function createMainWindow() {
  logger.info('Creating main window');
  
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
      logger.debug('Restored window settings', savedSettings);
    }
  } catch (error) {
    logger.error('Error loading saved window settings', error);
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
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'login.html'))
    .catch(error => {
      logger.error('Failed to load login page', error);
      dialog.showErrorBox(
        'Application Error',
        'Failed to load the application. Please restart.'
      );
    });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
    logger.debug('Opened DevTools in development mode');
  }

  // Handle window resizing and save dimensions
  mainWindow.on('resize', () => {
    const { width, height } = mainWindow.getBounds();
    try {
      localStorage.setItem('windowSettings', JSON.stringify({ width, height }));
    } catch (error) {
      logger.error('Error saving window settings', error);
    }
  });

  // Create application menu
  try {
    const template = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Logout',
            click: () => {
              try {
                // Clear any stored auth tokens
                mainWindow.webContents.executeJavaScript(`
                  localStorage.removeItem('token');
                  localStorage.removeItem('user');
                  window.location.href = 'login.html';
                `);
                logger.info('User logged out');
              } catch (error) {
                logger.error('Error during logout', error);
              }
            }
          },
          { type: 'separator' },
          { 
            role: 'quit',
            click: () => {
              logger.info('Application quit requested');
              app.quit();
            }
          }
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
              try {
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
                logger.info('About window opened');
              } catch (error) {
                logger.error('Error opening about window', error);
              }
            }
          },
          {
            label: 'Open Logs Directory',
            click: async () => {
              try {
                const logDir = path.join(app.getPath('userData'), 'logs');
                if (fs.existsSync(logDir)) {
                  shell.openPath(logDir);
                  logger.info('Opened logs directory');
                } else {
                  dialog.showMessageBox({
                    type: 'info',
                    title: 'Logs Directory',
                    message: 'Logs directory does not exist yet.'
                  });
                }
              } catch (error) {
                logger.error('Error opening logs directory', error);
              }
            }
          }
        ]
      }
    ];

    // Check if user is admin (for dynamic admin menu)
    mainWindow.webContents.on('did-finish-load', () => {
      try {
        mainWindow.webContents.executeJavaScript(`
          const userIsAdmin = localStorage.getItem('userIsAdmin') === 'true';
          userIsAdmin;
        `).then(isAdmin => {
          if (isAdmin) {
            const adminMenu = {
              label: 'Admin',
              submenu: [
                {
                  label: 'Admin Dashboard',
                  click: () => {
                    mainWindow.loadFile(path.join(__dirname, 'renderer', 'admin.html'))
                      .catch(error => {
                        logger.error('Failed to load admin dashboard', error);
                      });
                  }
                }
              ]
            };
            
            template.splice(template.length - 1, 0, adminMenu);
            const menu = Menu.buildFromTemplate(template);
            Menu.setApplicationMenu(menu);
            logger.info('Admin menu added');
          }
        }).catch(error => {
          logger.error('Error checking admin status', error);
        });
      } catch (error) {
        logger.error('Error setting up dynamic menu', error);
      }
    });

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  } catch (error) {
    logger.error('Failed to create application menu', error);
  }

  // Window event handlers
  mainWindow.on('closed', () => {
    logger.info('Main window closed');
    mainWindow = null;
  });
}

// Update menu based on admin status
function updateMenuForAdminStatus(isAdmin) {
  try {
    let template = Menu.getApplicationMenu().items.map(item => item);
    
    // Remove existing Admin menu if present
    template = template.filter(item => item.label !== 'Admin');
    
    // Add Admin menu if user is admin
    if (isAdmin) {
      const adminMenu = {
        label: 'Admin',
        submenu: [
          {
            label: 'Admin Dashboard',
            click: () => {
              if (mainWindow) {
                mainWindow.loadFile(path.join(__dirname, 'renderer', 'admin.html'))
                  .catch(error => {
                    logger.error('Failed to load admin dashboard', error);
                  });
              }
            }
          }
        ]
      };
      
      // Insert before Help menu (which is typically last)
      template.splice(template.length - 1, 0, adminMenu);
    }
    
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    logger.info(`Menu updated for admin status: ${isAdmin}`);
  } catch (error) {
    logger.error('Error updating menu for admin status', error);
  }
}

// App event handlers
app.on('ready', () => {
  logger.info('Application ready');
  createMainWindow();
});

app.on('window-all-closed', () => {
  logger.info('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  logger.info('Application activated');
  if (mainWindow === null) {
    createMainWindow();
  }
});

// IPC handlers for the renderer process with improved error handling

// Save user's keys to disk
ipcMain.handle('save-keys', async (event, { userId, privateKey, publicKey }) => {
  logger.info(`Saving keys for user ${userId}`);
  const userKeyPath = path.join(keyStoragePath, `user_${userId}`);
  
  try {
    fs.writeFileSync(`${userKeyPath}.priv`, privateKey);
    fs.writeFileSync(`${userKeyPath}.pub`, publicKey);
    logger.info(`Keys saved successfully for user ${userId}`);
    return { success: true };
  } catch (error) {
    logger.error(`Error saving keys for user ${userId}`, error);
    return { 
      success: false, 
      error: errorHandler.handleError(error, 'FILE_ERROR', { userId }) 
    };
  }
});

// Load user's keys from disk
ipcMain.handle('load-keys', async (event, { userId }) => {
  logger.info(`Loading keys for user ${userId}`);
  const userKeyPath = path.join(keyStoragePath, `user_${userId}`);
  
  try {
    // Check if keys exist
    if (!fs.existsSync(`${userKeyPath}.priv`) || !fs.existsSync(`${userKeyPath}.pub`)) {
      logger.warn(`Keys not found for user ${userId}`);
      return { success: false, error: 'Keys not found' };
    }
    
    const privateKey = fs.readFileSync(`${userKeyPath}.priv`, 'utf8');
    const publicKey = fs.readFileSync(`${userKeyPath}.pub`, 'utf8');
    
    logger.info(`Keys loaded successfully for user ${userId}`);
    return { success: true, privateKey, publicKey };
  } catch (error) {
    logger.error(`Error loading keys for user ${userId}`, error);
    return { 
      success: false, 
      error: errorHandler.handleError(error, 'FILE_ERROR', { userId }) 
    };
  }
});

// Check if keys exist for a user
ipcMain.handle('check-keys-exist', async (event, { userId }) => {
  logger.info(`Checking if keys exist for user ${userId}`);
  const userKeyPath = path.join(keyStoragePath, `user_${userId}`);
  
  try {
    const privateKeyExists = fs.existsSync(`${userKeyPath}.priv`);
    const publicKeyExists = fs.existsSync(`${userKeyPath}.pub`);
    
    logger.info(`Keys exist check for user ${userId}: ${privateKeyExists && publicKeyExists}`);
    
    return { 
      success: true, 
      exists: privateKeyExists && publicKeyExists 
    };
  } catch (error) {
    logger.error(`Error checking keys for user ${userId}`, error);
    return { 
      success: false, 
      error: errorHandler.handleError(error, 'FILE_ERROR', { userId }) 
    };
  }
});

// Delete user's keys from disk
ipcMain.handle('delete-keys', async (event, { userId }) => {
  logger.info(`Deleting keys for user ${userId}`);
  const userKeyPath = path.join(keyStoragePath, `user_${userId}`);
  
  try {
    if (fs.existsSync(`${userKeyPath}.priv`)) {
      fs.unlinkSync(`${userKeyPath}.priv`);
    }
    if (fs.existsSync(`${userKeyPath}.pub`)) {
      fs.unlinkSync(`${userKeyPath}.pub`);
    }
    
    logger.info(`Keys deleted successfully for user ${userId}`);
    return { success: true };
  } catch (error) {
    logger.error(`Error deleting keys for user ${userId}`, error);
    return { 
      success: false, 
      error: errorHandler.handleError(error, 'FILE_ERROR', { userId }) 
    };
  }
});

// Show a desktop notification
ipcMain.handle('show-notification', async (event, { title, body }) => {
  logger.debug('Showing notification', { title });
  
  if (!Notification.isSupported()) {
    logger.warn('Notifications not supported on this platform');
    return { success: false, error: 'Notifications not supported' };
  }
  
  try {
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
  } catch (error) {
    logger.error('Error showing notification', error);
    return { success: false, error: error.message };
  }
});

// Navigate to a different page
ipcMain.handle('navigate', async (event, { page }) => {
  logger.info(`Navigating to: ${page}`);
  
  if (mainWindow) {
    try {
      await mainWindow.loadFile(path.join(__dirname, 'renderer', page));
      return { success: true };
    } catch (error) {
      logger.error(`Navigation error to ${page}`, error);
      return { 
        success: false, 
        error: errorHandler.handleError(error, 'APP_ERROR', { page }) 
      };
    }
  }
  
  logger.error('Navigation failed: Main window not available');
  return { success: false, error: 'Main window not available' };
});

// Handle logging from renderer process
ipcMain.handle('log', async (event, { level, message, data }) => {
  if (level && message) {
    logger[level](message, data);
  }
  return true;
});

// Handle admin status change for menu updates
ipcMain.handle('update-admin-status', async (event, { isAdmin }) => {
  logger.info(`Updating admin status: ${isAdmin}`);
  
  // Store admin status locally
  try {
    mainWindow.webContents.executeJavaScript(`
      localStorage.setItem('userIsAdmin', '${isAdmin}');
    `);
  } catch (error) {
    logger.error('Error storing admin status', error);
  }
  
  // Update the menu
  updateMenuForAdminStatus(isAdmin);
  
  return { success: true };
});

// Access log files
ipcMain.handle('get-log-files', async () => {
  logger.info('Retrieving log files list');
  
  const logDir = path.join(app.getPath('userData'), 'logs');
  
  try {
    if (!fs.existsSync(logDir)) {
      return { success: true, logs: [] };
    }
    
    const files = fs.readdirSync(logDir);
    const logFiles = files
      .filter(file => file.endsWith('.log'))
      .map(file => {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        
        return {
          name: file,
          path: filePath,
          size: stats.size,
          date: stats.mtime
        };
      })
      .sort((a, b) => b.date - a.date); // Sort by date, newest first
    
    return { success: true, logs: logFiles };
  } catch (error) {
    logger.error('Error retrieving log files', error);
    return { 
      success: false, 
      error: errorHandler.handleError(error, 'FILE_ERROR'),
      logs: []
    };
  }
});

// Read log file content
ipcMain.handle('read-log-file', async (event, { filePath }) => {
  logger.info(`Reading log file: ${filePath}`);
  
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Log file not found' };
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    return { success: true, content };
  } catch (error) {
    logger.error(`Error reading log file: ${filePath}`, error);
    return { 
      success: false, 
      error: errorHandler.handleError(error, 'FILE_ERROR', { filePath })
    };
  }
});

// Clear old log files
ipcMain.handle('clear-old-logs', async () => {
  logger.info('Clearing old log files');
  
  const logDir = path.join(app.getPath('userData'), 'logs');
  
  try {
    if (!fs.existsSync(logDir)) {
      return { success: true, message: 'No logs directory found' };
    }
    
    const files = fs.readdirSync(logDir);
    const now = new Date();
    let deletedCount = 0;
    
    files.forEach(file => {
      if (file.endsWith('.log')) {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        const fileDate = new Date(stats.mtime);
        
        // Delete logs older than 7 days
        if ((now - fileDate) > 7 * 24 * 60 * 60 * 1000) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
    });
    
    logger.info(`Deleted ${deletedCount} old log files`);
    
    return { 
      success: true, 
      message: `Deleted ${deletedCount} old log files`,
      deletedCount
    };
  } catch (error) {
    logger.error('Error clearing old log files', error);
    return { 
      success: false, 
      error: errorHandler.handleError(error, 'FILE_ERROR')
    };
  }
});

// Add global error handler for renderer process crashes
app.on('render-process-gone', (event, webContents, details) => {
  logger.error('Renderer process crashed', {
    reason: details.reason,
    exitCode: details.exitCode
  });
  
  if (details.reason !== 'clean-exit') {
    dialog.showErrorBox(
      'Application Error',
      'The application encountered an error and needs to restart.'
    );
  }
});

// Log startup errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in main process', error);
  
  dialog.showErrorBox(
    'Fatal Error',
    'The application encountered a fatal error and will close. Please restart the application.'
  );
  
  app.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection in main process', { reason });
  
  // For unhandled rejections, we'll log but not necessarily exit
  if (mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Application Error',
      message: 'An unexpected error occurred. Some features may not work correctly.'
    });
  }
});