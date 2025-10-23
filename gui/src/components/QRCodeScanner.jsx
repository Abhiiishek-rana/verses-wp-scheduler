import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  Grid,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  QrCode as QrCodeIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Phone as PhoneIcon,
  CloudSync as CloudSyncIcon,
} from '@mui/icons-material';
import QRCode from 'qrcode';

const QRCodeScanner = ({ botStatus, onStartBot, onNotification }) => {
  const [qrCodeData, setQrCodeData] = useState(null);
  const [qrCodeImage, setQrCodeImage] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [activeStep, setActiveStep] = useState(0);
  const [logs, setLogs] = useState([]);
  const canvasRef = useRef(null);

  const steps = [
    {
      label: 'Start Bot',
      description: 'Initialize the WhatsApp bot process',
    },
    {
      label: 'Generate QR Code',
      description: 'Wait for QR code generation from WhatsApp Web',
    },
    {
      label: 'Scan QR Code',
      description: 'Scan the QR code with your WhatsApp mobile app',
    },
    {
      label: 'Connected',
      description: 'Bot is connected and ready to receive messages',
    },
  ];

  useEffect(() => {
    if (botStatus.running) {
      setActiveStep(1);
      setConnectionStatus('connecting');
      // Start polling for QR code
      pollForQRCode();
    } else {
      setActiveStep(0);
      setConnectionStatus('disconnected');
      setQrCodeData(null);
      setQrCodeImage(null);
    }
  }, [botStatus.running]);

  useEffect(() => {
    // Listen for bot events
    if (window.electronAPI) {
      window.electronAPI.onQRCode((qrData) => {
        setQrCodeData(qrData);
        generateQRCodeImage(qrData);
        setActiveStep(2);
        setConnectionStatus('waiting_scan');
        addLog('QR Code generated. Please scan with your WhatsApp mobile app.', 'info');
      });

      window.electronAPI.onBotStatus((status) => {
        if (status.connected) {
          setActiveStep(3);
          setConnectionStatus('connected');
          setQrCodeData(null);
          setQrCodeImage(null);
          addLog('WhatsApp bot connected successfully!', 'success');
          onNotification('WhatsApp bot connected successfully!', 'success');
        }
      });

      window.electronAPI.onBotLog((log) => {
        addLog(log.message, log.level);
      });
    }

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('qr-code');
        window.electronAPI.removeAllListeners('bot-status');
        window.electronAPI.removeAllListeners('bot-log');
      }
    };
  }, []);

  const pollForQRCode = async () => {
    try {
      const qrData = await window.electronAPI.getQRCode();
      if (qrData) {
        setQrCodeData(qrData);
        generateQRCodeImage(qrData);
        setActiveStep(2);
        setConnectionStatus('waiting_scan');
      }
    } catch (error) {
      console.error('Error polling for QR code:', error);
    }
  };

  const generateQRCodeImage = async (qrData) => {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeImage(qrCodeDataURL);
    } catch (error) {
      console.error('Error generating QR code image:', error);
      addLog('Error generating QR code image', 'error');
    }
  };

  const addLog = (message, level = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-9), { message, level, timestamp }]);
  };

  const handleStartBot = async () => {
    addLog('Starting WhatsApp bot...', 'info');
    await onStartBot();
  };

  const handleRefreshQR = async () => {
    addLog('Refreshing QR code...', 'info');
    try {
      await window.electronAPI.clearQRCode();
      setQrCodeData(null);
      setQrCodeImage(null);
      setActiveStep(1);
      setConnectionStatus('connecting');
      setTimeout(pollForQRCode, 2000);
    } catch (error) {
      console.error('Error refreshing QR code:', error);
      addLog('Error refreshing QR code', 'error');
    }
  };

  const downloadQRCode = () => {
    if (qrCodeImage) {
      const link = document.createElement('a');
      link.download = 'whatsapp-qr-code.png';
      link.href = qrCodeImage;
      link.click();
      addLog('QR code downloaded', 'success');
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'success';
      case 'connecting': return 'warning';
      case 'waiting_scan': return 'info';
      default: return 'default';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'waiting_scan': return 'Waiting for Scan';
      default: return 'Disconnected';
    }
  };

  const renderQRCodeSection = () => {
    if (!botStatus.running) {
      return (
        <Card sx={{ textAlign: 'center', py: 4 }}>
          <CardContent>
            <QrCodeIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Start the bot to generate QR code
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Click the start button to initialize the WhatsApp bot and generate a QR code for scanning.
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={handleStartBot}
              startIcon={<PhoneIcon />}
            >
              Start WhatsApp Bot
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (connectionStatus === 'connecting') {
      return (
        <Card sx={{ textAlign: 'center', py: 4 }}>
          <CardContent>
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Initializing WhatsApp Bot
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please wait while the bot connects to WhatsApp Web...
            </Typography>
          </CardContent>
        </Card>
      );
    }

    if (connectionStatus === 'connected') {
      return (
        <Card sx={{ textAlign: 'center', py: 4, background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(56, 142, 60, 0.1) 100%)', border: '1px solid rgba(76, 175, 80, 0.3)', borderRadius: 2, backdropFilter: 'blur(10px)' }}>
          <CardContent>
            <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom color="success.main">
              WhatsApp Bot Connected!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your bot is now connected and ready to receive messages.
            </Typography>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Scan QR Code with WhatsApp
            </Typography>
            <Box>
              <Tooltip title="Download QR Code">
                <IconButton onClick={downloadQRCode} disabled={!qrCodeImage}>
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Refresh QR Code">
                <IconButton onClick={handleRefreshQR}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {qrCodeImage ? (
            <Box textAlign="center">
              <Paper 
                elevation={3} 
                sx={{ 
                  display: 'inline-block', 
                  p: 2, 
                  background: 'white',
                  borderRadius: 2
                }}
              >
                <img 
                  src={qrCodeImage} 
                  alt="WhatsApp QR Code" 
                  style={{ display: 'block', maxWidth: '100%' }}
                />
              </Paper>
              
              <Alert severity="info" sx={{ mt: 2, textAlign: 'left' }}>
                <Typography variant="subtitle2" gutterBottom>
                  How to scan:
                </Typography>
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  <li>Open WhatsApp on your phone</li>
                  <li>Go to Settings → Linked Devices</li>
                  <li>Tap "Link a Device"</li>
                  <li>Scan this QR code</li>
                </ol>
              </Alert>
            </Box>
          ) : (
            <Box textAlign="center" py={4}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Generating QR code...
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          WhatsApp QR Code Scanner
        </Typography>
        
        <Chip
          icon={connectionStatus === 'connected' ? <CheckCircleIcon /> : 
                connectionStatus === 'connecting' ? <CloudSyncIcon /> : <ErrorIcon />}
          label={getStatusText()}
          color={getStatusColor()}
          variant="outlined"
          size="large"
        />
      </Box>

      <Grid container spacing={3}>
        {/* QR Code Section */}
        <Grid item xs={12} md={8}>
          {renderQRCodeSection()}
        </Grid>

        {/* Progress and Logs */}
        <Grid item xs={12} md={4}>
          {/* Connection Steps */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Connection Progress
              </Typography>
              <Stepper activeStep={activeStep} orientation="vertical">
                {steps.map((step, index) => (
                  <Step key={step.label}>
                    <StepLabel>
                      <Typography variant="subtitle2">{step.label}</Typography>
                    </StepLabel>
                    <StepContent>
                      <Typography variant="body2" color="text.secondary">
                        {step.description}
                      </Typography>
                    </StepContent>
                  </Step>
                ))}
              </Stepper>
            </CardContent>
          </Card>

          {/* Activity Logs */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Activity Log
              </Typography>
              <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                {logs.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No activity yet...
                  </Typography>
                ) : (
                  logs.map((log, index) => (
                    <Box key={index} sx={{ mb: 1, p: 1, borderRadius: 1, background: 'linear-gradient(135deg, rgba(26, 31, 58, 0.6) 0%, rgba(16, 20, 40, 0.8) 100%)', border: '1px solid rgba(102, 126, 234, 0.2)', backdropFilter: 'blur(10px)', color: '#b3b9d1', fontSize: '0.875rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      <Typography variant="caption" color="text.secondary">
                        {log.timestamp}
                      </Typography>
                      <Typography 
                        variant="body2" 
                        color={log.level === 'error' ? 'error.main' : 
                               log.level === 'success' ? 'success.main' : 'text.primary'}
                      >
                        {log.message}
                      </Typography>
                    </Box>
                  ))
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default QRCodeScanner;