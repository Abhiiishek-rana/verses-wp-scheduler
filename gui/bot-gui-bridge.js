const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');

class BotGUIBridge {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.qrCode = null;
    this.eventCallbacks = {
      qr: [],
      ready: [],
      authenticated: [],
      disconnected: [],
      message: [],
      log: []
    };
  }

  // Event listener management
  on(event, callback) {
    if (this.eventCallbacks[event]) {
      this.eventCallbacks[event].push(callback);
    }
  }

  emit(event, data) {
    if (this.eventCallbacks[event]) {
      this.eventCallbacks[event].forEach(callback => callback(data));
    }
  }

  // Initialize the WhatsApp client
  async initialize() {
    try {
      this.emit('log', { level: 'info', message: 'Initializing WhatsApp client...' });

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: path.join(__dirname, '..', 'auth_data')
        }),
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      });

      // Set up event listeners
      this.client.on('qr', (qr) => {
        this.qrCode = qr;
        this.emit('qr', qr);
        this.emit('log', { level: 'info', message: 'QR Code generated. Please scan with WhatsApp.' });
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        this.qrCode = null;
        this.emit('ready', { connected: true });
        this.emit('log', { level: 'success', message: 'WhatsApp client is ready!' });
      });

      this.client.on('authenticated', () => {
        this.emit('authenticated', { authenticated: true });
        this.emit('log', { level: 'success', message: 'WhatsApp client authenticated!' });
      });

      this.client.on('disconnected', (reason) => {
        this.isConnected = false;
        this.emit('disconnected', { reason });
        this.emit('log', { level: 'warning', message: `WhatsApp client disconnected: ${reason}` });
      });

      this.client.on('message', (message) => {
        this.emit('message', message);
        this.emit('log', { 
          level: 'info', 
          message: `Message received from ${message.from}: ${message.body.substring(0, 50)}...` 
        });
      });

      // Initialize the client
      await this.client.initialize();
      
      return { success: true };
    } catch (error) {
      this.emit('log', { level: 'error', message: `Error initializing client: ${error.message}` });
      throw error;
    }
  }

  // Get current status
  getStatus() {
    return {
      connected: this.isConnected,
      hasClient: !!this.client,
      qrCode: this.qrCode
    };
  }

  // Get QR code
  getQRCode() {
    return this.qrCode;
  }

  // Clear QR code
  clearQRCode() {
    this.qrCode = null;
    return { success: true };
  }

  // Destroy the client
  async destroy() {
    try {
      if (this.client) {
        await this.client.destroy();
        this.client = null;
        this.isConnected = false;
        this.qrCode = null;
        this.emit('log', { level: 'info', message: 'WhatsApp client destroyed.' });
      }
      return { success: true };
    } catch (error) {
      this.emit('log', { level: 'error', message: `Error destroying client: ${error.message}` });
      throw error;
    }
  }

  // Send a message
  async sendMessage(to, message) {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Client not connected');
      }
      
      await this.client.sendMessage(to, message);
      this.emit('log', { level: 'info', message: `Message sent to ${to}` });
      return { success: true };
    } catch (error) {
      this.emit('log', { level: 'error', message: `Error sending message: ${error.message}` });
      throw error;
    }
  }

  // Get chat list
  async getChats() {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Client not connected');
      }
      
      const chats = await this.client.getChats();
      return chats;
    } catch (error) {
      this.emit('log', { level: 'error', message: `Error getting chats: ${error.message}` });
      throw error;
    }
  }
}

module.exports = BotGUIBridge;