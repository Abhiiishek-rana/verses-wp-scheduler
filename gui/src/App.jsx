import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  AppBar,
  Toolbar,
  Typography,
  Tabs,
  Tab,
  Paper,
  Alert,
  Snackbar,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  QrCode as QrCodeIcon,
  Phone as PhoneIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';

import ConfigEditor from './components/ConfigEditor';
import QRCodeScanner from './components/QRCodeScanner';
import PhoneNumberManager from './components/PhoneNumberManager';
import BotStatus from './components/BotStatus';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function App() {
  const [tabValue, setTabValue] = useState(0);
  const [config, setConfig] = useState(null);
  const [botStatus, setBotStatus] = useState({ running: false, pid: null });
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
    checkBotStatus();
  }, []);

  const loadConfig = async () => {
    try {
      const configData = await window.electronAPI.loadConfig();
      setConfig(configData);
    } catch (error) {
      showNotification('Failed to load configuration', 'error');
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (newConfig) => {
    try {
      await window.electronAPI.saveConfig(newConfig);
      setConfig(newConfig);
      showNotification('Configuration saved successfully', 'success');
    } catch (error) {
      showNotification('Failed to save configuration', 'error');
      console.error('Error saving config:', error);
    }
  };

  const checkBotStatus = async () => {
    try {
      const status = await window.electronAPI.getBotStatus();
      setBotStatus(status);
    } catch (error) {
      console.error('Error checking bot status:', error);
    }
  };

  const startBot = async () => {
    try {
      const result = await window.electronAPI.startBot();
      if (result.success) {
        setBotStatus({ running: true, pid: result.pid });
        showNotification('Bot started successfully', 'success');
        setTabValue(1); // Switch to QR Code tab
      }
    } catch (error) {
      showNotification('Failed to start bot', 'error');
      console.error('Error starting bot:', error);
    }
  };

  const stopBot = async () => {
    try {
      const result = await window.electronAPI.stopBot();
      if (result.success) {
        setBotStatus({ running: false, pid: null });
        showNotification('Bot stopped successfully', 'success');
      }
    } catch (error) {
      showNotification('Failed to stop bot', 'error');
      console.error('Error stopping bot:', error);
    }
  };

  const exportConfig = async () => {
    try {
      const result = await window.electronAPI.exportConfig(config);
      if (result.success && !result.canceled) {
        showNotification(`Configuration exported to ${result.filePath}`, 'success');
      }
    } catch (error) {
      showNotification('Failed to export configuration', 'error');
      console.error('Error exporting config:', error);
    }
  };

  const importConfig = async () => {
    try {
      const result = await window.electronAPI.importConfig();
      if (result.success && !result.canceled) {
        setConfig(result.data);
        showNotification('Configuration imported successfully', 'success');
      }
    } catch (error) {
      showNotification('Failed to import configuration', 'error');
      console.error('Error importing config:', error);
    }
  };

  const showNotification = (message, severity = 'info') => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        sx={{
          background: 'linear-gradient(135deg, #0a0e1a 0%, #1a1f3a 25%, #667eea 50%, #764ba2 75%, #101428 100%)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 30% 20%, rgba(102, 126, 234, 0.3) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(118, 75, 162, 0.3) 0%, transparent 50%)',
            animation: 'pulse 4s ease-in-out infinite alternate',
          },
        }}
      >
        <Typography variant="h5" color="white">
          Loading WhatsApp Bot Manager...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0e1a 0%, #1a1f3a 25%, #667eea 50%, #764ba2 75%, #101428 100%)', position: 'relative', overflow: 'hidden', '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(circle at 30% 20%, rgba(102, 126, 234, 0.3) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(118, 75, 162, 0.3) 0%, transparent 50%)', animation: 'pulse 4s ease-in-out infinite alternate' } }}>
      <AppBar position="static" sx={{ background: 'rgba(16, 20, 40, 0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(102, 126, 234, 0.2)' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
            WhatsApp Bot Manager
          </Typography>
          
          <BotStatus status={botStatus} onRefresh={checkBotStatus} />
          
          <Tooltip title="Export Configuration">
            <IconButton color="inherit" onClick={exportConfig}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Import Configuration">
            <IconButton color="inherit" onClick={importConfig}>
              <UploadIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title={botStatus.running ? "Stop Bot" : "Start Bot"}>
            <IconButton 
              color="inherit" 
              onClick={botStatus.running ? stopBot : startBot}
              sx={{ ml: 1 }}
            >
              {botStatus.running ? <StopIcon /> : <PlayIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Paper 
          elevation={0} 
          sx={{ 
            background: 'rgba(26, 31, 58, 0.95)', 
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(102, 126, 234, 0.2)',
            borderRadius: 3,
            overflow: 'hidden',
            color: 'white'
          }}
        >
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            sx={{ 
              borderBottom: 1, 
              borderColor: 'rgba(102, 126, 234, 0.2)',
              '& .MuiTab-root': {
                minHeight: 64,
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.7)',
                '&.Mui-selected': {
                  color: '#667eea',
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#667eea',
              }
            }}
          >
            <Tab 
              icon={<SettingsIcon />} 
              label="Configuration" 
              iconPosition="start"
              sx={{ minWidth: 200 }}
            />
            <Tab 
              icon={<PhoneIcon />} 
              label="Phone Numbers" 
              iconPosition="start"
              sx={{ minWidth: 200 }}
            />
            <Tab 
              icon={<QrCodeIcon />} 
              label="QR Code Scanner" 
              iconPosition="start"
              sx={{ minWidth: 200 }}
            />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            {config && (
              <ConfigEditor 
                config={config} 
                onSave={saveConfig}
                onNotification={showNotification}
              />
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <PhoneNumberManager 
              onNotification={showNotification}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <QRCodeScanner 
              botStatus={botStatus}
              onStartBot={startBot}
              onNotification={showNotification}
            />
          </TabPanel>
        </Paper>
      </Container>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default App;