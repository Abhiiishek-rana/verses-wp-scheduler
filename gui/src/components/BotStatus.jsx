import React from 'react';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Circle as CircleIcon,
  Refresh as RefreshIcon,
  Computer as ComputerIcon,
} from '@mui/icons-material';

const BotStatus = ({ status, onRefresh }) => {
  const getStatusColor = () => {
    return status.running ? 'success' : 'error';
  };

  const getStatusText = () => {
    return status.running ? 'Running' : 'Stopped';
  };

  const getStatusIcon = () => {
    return (
      <CircleIcon 
        sx={{ 
          fontSize: 12,
          color: status.running ? 'success.main' : 'error.main'
        }} 
      />
    );
  };

  return (
    <Box display="flex" alignItems="center" gap={1}>
      <Chip
        icon={getStatusIcon()}
        label={
          <Box display="flex" alignItems="center" gap={1}>
            <ComputerIcon sx={{ fontSize: 16 }} />
            <Typography variant="body2">
              Bot {getStatusText()}
            </Typography>
            {status.pid && (
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                (PID: {status.pid})
              </Typography>
            )}
          </Box>
        }
        color={getStatusColor()}
        variant="outlined"
        size="small"
      />
      
      <Tooltip title="Refresh Status">
        <IconButton size="small" onClick={onRefresh} color="inherit">
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default BotStatus;