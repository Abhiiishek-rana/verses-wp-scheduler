import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Grid,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const ConfigEditor = ({ config, onSave, onNotification }) => {
  const [editedConfig, setEditedConfig] = useState(config || {});
  const [validationErrors, setValidationErrors] = useState([]);

  useEffect(() => {
    setEditedConfig(config || {});
  }, [config]);

  const handleConfigChange = (path, value) => {
    const newConfig = { ...editedConfig };
    const keys = path.split('.');
    let current = newConfig;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    setEditedConfig(newConfig);
  };

  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((current, key) => current?.[key], obj) || '';
  };

  const validateConfig = () => {
    const errors = [];
    
    // Required field validations based on actual config structure
    if (!getNestedValue(editedConfig, 'messages.welcome.initial')) {
      errors.push('Welcome initial message is required');
    }
    
    return errors;
  };

  const handleSave = async () => {
    const errors = validateConfig();
    setValidationErrors(errors);
    
    if (errors.length === 0) {
      try {
        await onSave(editedConfig);
        onNotification('Configuration saved successfully!', 'success');
      } catch (error) {
        onNotification('Failed to save configuration', 'error');
      }
    }
  };

  const renderTextField = (label, path, multiline = false, rows = 1) => (
    <TextField
      fullWidth
      label={label}
      value={getNestedValue(editedConfig, path)}
      onChange={(e) => handleConfigChange(path, e.target.value)}
      multiline={multiline}
      rows={rows}
      margin="normal"
      variant="outlined"
    />
  );

  const renderNumberField = (label, path) => (
    <TextField
      fullWidth
      label={label}
      type="number"
      value={getNestedValue(editedConfig, path)}
      onChange={(e) => handleConfigChange(path, parseInt(e.target.value) || 0)}
      margin="normal"
      variant="outlined"
    />
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Bot Configuration
      </Typography>

      {validationErrors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Welcome Messages
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            {renderTextField('Initial Welcome Message', 'messages.welcome.initial', true, 3)}
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Question Messages
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            {renderTextField('Ask Call Time', 'messages.questions.askCallTime', true, 2)}
          </Grid>
          <Grid item xs={12}>
            {renderTextField('Ask Reason', 'messages.questions.askReason', true, 2)}
          </Grid>
          <Grid item xs={12}>
            {renderTextField('Ask Clarification', 'messages.questions.askClarification', true, 2)}
          </Grid>
          <Grid item xs={12}>
            {renderTextField('Ask Time for Date', 'messages.questions.askTimeForDate', true, 3)}
          </Grid>
          <Grid item xs={12}>
            {renderTextField('Ask Date for Time', 'messages.questions.askDateForTime', true, 3)}
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Confirmation Messages
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            {renderTextField('Schedule Confirmation', 'messages.confirmations.scheduleConfirm', true, 2)}
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Success Messages
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            {renderTextField('Call Scheduled', 'messages.success.callScheduled', true, 2)}
          </Grid>
          <Grid item xs={12}>
            {renderTextField('Immediate Call Scheduled', 'messages.success.immediateCallScheduled', true, 2)}
          </Grid>
          <Grid item xs={12}>
            {renderTextField('Polite End', 'messages.success.politeEnd', true, 2)}
          </Grid>
          <Grid item xs={12}>
            {renderTextField('Thank You', 'messages.success.thankYou')}
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Error Messages
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            {renderTextField('Clarification Needed', 'messages.errors.clarificationNeeded', true, 2)}
          </Grid>
          <Grid item xs={12}>
            {renderTextField('Still Unclear', 'messages.errors.stillUnclear', true, 2)}
          </Grid>
          <Grid item xs={12}>
            {renderTextField('Parse Error', 'messages.errors.parseError', true, 2)}
          </Grid>
          <Grid item xs={12}>
            {renderTextField('Past Date Time', 'messages.errors.pastDateTime', true, 2)}
          </Grid>
          <Grid item xs={12}>
            {renderTextField('Confirmation Needed', 'messages.errors.confirmationNeeded', true, 2)}
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Prompt Messages
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            {renderTextField('Provide Date and Time', 'messages.prompts.provideDateAndTime', true, 2)}
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Timeout Messages
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            {renderTextField('Session Ended', 'messages.timeout.sessionEnded', true, 2)}
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Settings
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            {renderNumberField('Session Timeout (Days)', 'numbers.sessionTimeoutDays')}
          </Grid>
        </Grid>
      </Paper>

      <Accordion sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Advanced Configuration (JSON)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TextField
            fullWidth
            multiline
            rows={15}
            value={JSON.stringify(editedConfig, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                setEditedConfig(parsed);
              } catch (error) {
                // Invalid JSON, don't update
              }
            }}
            variant="outlined"
            sx={{ fontFamily: 'monospace' }}
          />
        </AccordionDetails>
      </Accordion>

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleSave}
          sx={{ px: 4, py: 1.5 }}
        >
          Save Configuration
        </Button>
      </Box>
    </Box>
  );
};

export default ConfigEditor;