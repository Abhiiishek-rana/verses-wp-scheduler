const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Config management
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (configData) => ipcRenderer.invoke('save-config', configData),
  exportConfig: (configData) => ipcRenderer.invoke('export-config', configData),
  importConfig: () => ipcRenderer.invoke('import-config'),

  // Bot management
  startBot: () => ipcRenderer.invoke('start-bot'),
  stopBot: () => ipcRenderer.invoke('stop-bot'),
  getBotStatus: () => ipcRenderer.invoke('get-bot-status'),

  // Phone number management
  loadPhoneNumbers: () => ipcRenderer.invoke('load-phone-numbers'),
  savePhoneNumbers: (phoneData) => ipcRenderer.invoke('save-phone-numbers', phoneData),

  // QR Code management
  getQRCode: () => ipcRenderer.invoke('get-qr-code'),
  clearQRCode: () => ipcRenderer.invoke('clear-qr-code'),

  // File dialogs
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

  // Event listeners
  onQRCode: (callback) => {
    ipcRenderer.on('qr-code', (event, qrData) => callback(qrData));
  },
  
  onBotStatus: (callback) => {
    ipcRenderer.on('bot-status', (event, status) => callback(status));
  },

  onBotLog: (callback) => {
    ipcRenderer.on('bot-log', (event, log) => callback(log));
  },

  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});