import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import './styles/global.css';

const theme = createTheme({
  palette: {
    mode: 'dark',
    // Primary Colors - Electric Blue Family
    primary: {
      main: '#667eea',      // Electric Blue
      light: '#8fa4f3',     // Light Electric Blue
      dark: '#4c63d2',      // Deep Electric Blue
      contrastText: '#FFFFFF',
    },
    // Secondary Colors - Purple Family
    secondary: {
      main: '#764ba2',      // Purple
      light: '#9575cd',     // Light Purple
      dark: '#5e35b1',      // Deep Purple
      contrastText: '#FFFFFF',
    },
    // Background Colors
    background: {
      default: '#0a0e27',   // Very Dark Blue
      paper: '#1a1f3a',     // Dark Blue Paper
    },
    // Text Colors
    text: {
      primary: '#ffffff',   // White
      secondary: '#b3b9d1', // Light Blue Gray
      disabled: '#6c7293',  // Muted Blue Gray
    },
    // Divider Colors
    divider: 'rgba(255, 255, 255, 0.12)',
    // Action Colors
    action: {
      active: '#667eea',
      hover: 'rgba(102, 126, 234, 0.08)',
      selected: 'rgba(102, 126, 234, 0.16)',
      disabled: 'rgba(255, 255, 255, 0.26)',
      disabledBackground: 'rgba(255, 255, 255, 0.12)',
    },
    // Semantic Colors - Custom palette
    success: {
      main: '#4caf50',      // Green
      light: '#81c784',
      dark: '#388e3c',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#ff9800',      // Orange
      light: '#ffb74d',
      dark: '#f57c00',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#f44336',      // Red
      light: '#e57373',
      dark: '#d32f2f',
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#2196f3',      // Blue
      light: '#64b5f6',
      dark: '#1976d2',
      contrastText: '#FFFFFF',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0 12px 40px rgba(102, 126, 234, 0.2)',
            transform: 'translateY(-4px)',
            border: '1px solid rgba(102, 126, 234, 0.3)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'linear-gradient(135deg, rgba(26, 31, 58, 0.9) 0%, rgba(16, 20, 40, 0.95) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
        },
      },
    },
    // Button Components
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          overflow: 'hidden',
          '&:hover': {
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.5)',
            transform: 'translateY(-2px) scale(1.02)',
          },
          '&:active': {
            transform: 'translateY(0px) scale(0.98)',
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)',
            transition: 'all 0.1s ease',
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: '-100%',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
            transition: 'left 0.5s ease',
          },
          '&:hover::before': {
            left: '100%',
          },
        },
        contained: {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #4c63d2 0%, #5e35b1 100%)',
          },
          '&:active': {
            background: 'linear-gradient(135deg, #3b4bc7 0%, #4a2c8a 100%)',
          },
        },
        outlined: {
          borderColor: '#667eea',
          color: '#667eea',
          '&:hover': {
            backgroundColor: 'rgba(102, 126, 234, 0.12)',
            borderColor: '#4c63d2',
            color: '#8fa4f3',
          },
          '&:active': {
            backgroundColor: 'rgba(102, 126, 234, 0.2)',
            borderColor: '#3b4bc7',
          },
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            background: 'linear-gradient(135deg, #4c63d2 0%, #5e35b1 100%)',
            boxShadow: '0 12px 40px rgba(102, 126, 234, 0.6)',
            transform: 'translateY(-3px) scale(1.05)',
          },
          '&:active': {
            transform: 'translateY(-1px) scale(0.95)',
            boxShadow: '0 4px 16px rgba(102, 126, 234, 0.5)',
            transition: 'all 0.1s ease',
          },
        },
      },
    },
    // Input Components
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'rgba(26, 31, 58, 0.6)',
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.2)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(102, 126, 234, 0.5)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#667eea',
            },
          },
          '& .MuiInputLabel-root': {
            color: '#b3b9d1',
            '&.Mui-focused': {
              color: '#667eea',
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(26, 31, 58, 0.6)',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.2)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(102, 126, 234, 0.5)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#667eea',
          },
        },
      },
    },
    // Navigation Components
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, rgba(26, 31, 58, 0.95) 0%, rgba(16, 20, 40, 0.98) 100%)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          '& .MuiTabs-indicator': {
            backgroundColor: '#667eea',
            height: 3,
            borderRadius: '3px 3px 0 0',
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)',
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          color: 'rgba(255, 255, 255, 0.7)',
          transition: 'all 0.3s ease',
          '&.Mui-selected': {
            color: '#667eea',
            fontWeight: 600,
          },
          '&:hover': {
            color: '#8fa4f3',
            backgroundColor: 'rgba(102, 126, 234, 0.08)',
          },
        },
      },
    },
    // Feedback Components
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '&.MuiAlert-standardSuccess': {
            backgroundColor: 'rgba(124, 179, 66, 0.1)',
            color: '#558B2F',
            border: '1px solid rgba(124, 179, 66, 0.3)',
          },
          '&.MuiAlert-standardWarning': {
            backgroundColor: 'rgba(255, 143, 0, 0.1)',
            color: '#F57C00',
            border: '1px solid rgba(255, 143, 0, 0.3)',
          },
          '&.MuiAlert-standardError': {
            backgroundColor: 'rgba(216, 67, 21, 0.1)',
            color: '#BF360C',
            border: '1px solid rgba(216, 67, 21, 0.3)',
          },
          '&.MuiAlert-standardInfo': {
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            color: '#64b5f6',
            border: '1px solid rgba(33, 150, 243, 0.3)',
          },
        },
      },
    },
    // Data Display Components
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          color: '#b3b9d1',
          border: '1px solid rgba(102, 126, 234, 0.2)',
          transition: 'all 0.3s ease',
          '&:hover': {
            backgroundColor: 'rgba(102, 126, 234, 0.15)',
            color: '#ffffff',
          },
        },
        filled: {
          backgroundColor: 'rgba(102, 126, 234, 0.8)',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#667eea',
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
          },
        },
      },
    },
    // Layout Components
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(102, 126, 234, 0.12)',
        },
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);