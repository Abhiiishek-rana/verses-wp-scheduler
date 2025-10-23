const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Simple development check
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    show: false
  });

  // Load the app
  const startUrl = isDev 
    ? 'http://localhost:3001' 
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // DevTools can be opened manually with Ctrl+Shift+I if needed

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App event listeners
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for config management
ipcMain.handle('load-config', async () => {
  try {
    const configPath = path.join(__dirname, '..', 'shared', 'config', 'config.json');
    const configData = await fs.readFile(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Error loading config:', error);
    throw error;
  }
});

ipcMain.handle('save-config', async (event, configData) => {
  try {
    const configPath = path.join(__dirname, '..', 'shared', 'config', 'config.json');
    await fs.writeFile(configPath, JSON.stringify(configData, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Error saving config:', error);
    throw error;
  }
});

// IPC handlers for phone number management
ipcMain.handle('load-phone-numbers', async () => {
  try {
    const phonePath = path.join(__dirname, '..', 'outbound', 'target_numbers.json');
    const phoneData = await fs.readFile(phonePath, 'utf8');
    return JSON.parse(phoneData);
  } catch (error) {
    console.error('Error loading phone numbers:', error);
    throw error;
  }
});

ipcMain.handle('save-phone-numbers', async (event, phoneData) => {
  try {
    const phonePath = path.join(__dirname, '..', 'outbound', 'target_numbers.json');
    await fs.writeFile(phonePath, JSON.stringify(phoneData, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Error saving phone numbers:', error);
    throw error;
  }
});

// Bot GUI Bridge
const { spawn } = require('child_process');
let botProcess = null;

// IPC handlers for bot management
ipcMain.handle('start-bot', async () => {
  try {
    if (botProcess) {
      botProcess.kill();
      botProcess = null;
    }
    
    // Start the actual bot.js file as a child process
    const botPath = path.join(__dirname, '..', 'outbound', 'bot.js');
    botProcess = spawn('node', [botPath], {
      cwd: path.join(__dirname, '..', 'outbound'),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Handle bot output (logs)
    botProcess.stdout.on('data', (data) => {
      const logMessage = data.toString().trim();
      if (mainWindow && logMessage) {
        mainWindow.webContents.send('bot-log', { 
          level: 'info', 
          message: logMessage,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Handle bot errors
    botProcess.stderr.on('data', (data) => {
      const errorMessage = data.toString().trim();
      if (mainWindow && errorMessage) {
        mainWindow.webContents.send('bot-log', { 
          level: 'error', 
          message: errorMessage,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Handle process exit
    botProcess.on('close', (code) => {
      if (mainWindow) {
        mainWindow.webContents.send('bot-status', { 
          connected: false, 
          running: false,
          exitCode: code 
        });
        mainWindow.webContents.send('bot-log', { 
          level: 'info', 
          message: `Bot process exited with code ${code}`,
          timestamp: new Date().toISOString()
        });
      }
      botProcess = null;
    });
    
    // Handle process errors
    botProcess.on('error', (error) => {
      if (mainWindow) {
        mainWindow.webContents.send('bot-log', { 
          level: 'error', 
          message: `Failed to start bot: ${error.message}`,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Send initial status
    if (mainWindow) {
      mainWindow.webContents.send('bot-status', { 
        connected: false, 
        running: true,
        pid: botProcess.pid 
      });
      mainWindow.webContents.send('bot-log', { 
        level: 'info', 
        message: 'Bot process started successfully',
        timestamp: new Date().toISOString()
      });
    }
    
    return { success: true, pid: botProcess.pid };
  } catch (error) {
    console.error('Error starting bot:', error);
    throw error;
  }
});

ipcMain.handle('stop-bot', async () => {
  try {
    if (botProcess) {
      botProcess.kill('SIGTERM');
      botProcess = null;
      
      if (mainWindow) {
        mainWindow.webContents.send('bot-status', { 
          connected: false, 
          running: false 
        });
        mainWindow.webContents.send('bot-log', { 
          level: 'info', 
          message: 'Bot process stopped',
          timestamp: new Date().toISOString()
        });
      }
      
      return { success: true };
    }
    return { success: false, message: 'No bot process running' };
  } catch (error) {
    console.error('Error stopping bot:', error);
    throw error;
  }
});

ipcMain.handle('get-bot-status', async () => {
  if (botProcess && !botProcess.killed) {
    return {
      running: true,
      connected: true, // We'll assume connected if process is running
      pid: botProcess.pid
    };
  }
  return {
    running: false,
    connected: false,
    pid: null
  };
});

// QR Code handlers - removed since bot.js handles QR codes directly through console output

// File dialog handlers
ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// Export config
ipcMain.handle('export-config', async (event, configData) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Configuration',
      defaultPath: 'whatsapp-bot-config.json',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled) {
      await fs.writeFile(result.filePath, JSON.stringify(configData, null, 2), 'utf8');
      return { success: true, filePath: result.filePath };
    }
    
    return { success: false, canceled: true };
  } catch (error) {
    console.error('Error exporting config:', error);
    throw error;
  }
});

// Import config
ipcMain.handle('import-config', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Configuration',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const configData = await fs.readFile(result.filePaths[0], 'utf8');
      return { success: true, data: JSON.parse(configData) };
    }
    
    return { success: false, canceled: true };
  } catch (error) {
    console.error('Error importing config:', error);
    throw error;
  }
});

// Handle app closing
app.on('before-quit', async () => {
  try {
    if (botProcess) {
      console.log('Cleaning up bot process before quit...');
      botProcess.kill('SIGTERM');
      botProcess = null;
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
});