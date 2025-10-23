import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Chip,
  Grid,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  Phone as PhoneIcon
} from '@mui/icons-material';

const PhoneNumberManager = ({ onNotification }) => {
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPhoneNumbers();
  }, []);

  const loadPhoneNumbers = async () => {
    try {
      setLoading(true);
      const phoneData = await window.electronAPI.loadPhoneNumbers();
      setPhoneNumbers(phoneData.targetPhoneNumbers || []);
    } catch (error) {
      console.error('Error loading phone numbers:', error);
      onNotification('Failed to load phone numbers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addPhoneNumber = () => {
    if (newPhoneNumber.trim() && !phoneNumbers.includes(newPhoneNumber.trim())) {
      const updatedNumbers = [...phoneNumbers, newPhoneNumber.trim()];
      setPhoneNumbers(updatedNumbers);
      setNewPhoneNumber('');
      savePhoneNumbers(updatedNumbers);
    }
  };

  const removePhoneNumber = (numberToRemove) => {
    const updatedNumbers = phoneNumbers.filter(num => num !== numberToRemove);
    setPhoneNumbers(updatedNumbers);
    savePhoneNumbers(updatedNumbers);
  };

  const savePhoneNumbers = async (numbers) => {
    try {
      await window.electronAPI.savePhoneNumbers({
        targetPhoneNumbers: numbers
      });
      onNotification('Phone numbers updated successfully!', 'success');
    } catch (error) {
      console.error('Error saving phone numbers:', error);
      onNotification('Failed to save phone numbers', 'error');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      addPhoneNumber();
    }
  };



  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <Typography>Loading phone numbers...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <PhoneIcon sx={{ mr: 2, fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" gutterBottom>
          Phone Number Management
        </Typography>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Add New Phone Number
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Add target phone numbers for the bot to contact. Enter numbers in international format (e.g., 918178487852).
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} sm={8}>
            <TextField
              fullWidth
              label="Phone Number"
              value={newPhoneNumber}
              onChange={(e) => setNewPhoneNumber(e.target.value)}
              placeholder="e.g., 918178487852"
              variant="outlined"
              onKeyPress={handleKeyPress}
              helperText="Enter phone number in international format without + or spaces"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={addPhoneNumber}
              startIcon={<AddIcon />}
              sx={{ height: '56px' }}
              disabled={!newPhoneNumber.trim() || phoneNumbers.includes(newPhoneNumber.trim())}
            >
              Add Number
            </Button>
          </Grid>
        </Grid>

        {newPhoneNumber.trim() && phoneNumbers.includes(newPhoneNumber.trim()) && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            This phone number is already in the list.
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Current Phone Numbers ({phoneNumbers.length})
        </Typography>
        
        {phoneNumbers.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <PhoneIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="body1" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No phone numbers added yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add your first phone number above to get started
            </Typography>
          </Box>
        ) : (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Click the delete icon to remove a phone number from the list.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {phoneNumbers.map((number, index) => (
                <Chip
                  key={index}
                  label={number}
                  onDelete={() => removePhoneNumber(number)}
                  deleteIcon={<DeleteIcon />}
                  variant="outlined"
                  color="primary"
                  size="medium"
                  sx={{ 
                    fontSize: '0.9rem',
                    height: '40px',
                    '& .MuiChip-label': {
                      fontFamily: 'monospace'
                    }
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default PhoneNumberManager;