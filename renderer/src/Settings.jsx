import React, { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';

function Settings({ onBack, selectedDeviceId, onDeviceChange, devices }) {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Load API key on mount
  useEffect(() => {
    setError(null);
    setIsLoading(true);
    setIsSaving(false);
    
    window.electronAPI.getApiKey()
      .then(key => {
        setApiKey(key || '');
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load settings:', err);
        setError('Failed to load settings.');
        setIsLoading(false);
      });
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      // Save API key
      const apiKeyResult = await window.electronAPI.setApiKey(apiKey);
      
      if (apiKeyResult.success) {
        setIsSaving(false);
        onBack();
      } else {
        setError(apiKeyResult.error || 'Failed to save settings.');
        setIsSaving(false);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError(err.message || 'An unknown error occurred while saving.');
      setIsSaving(false);
    }
  }, [apiKey, onBack]);

  return (
    <Box sx={{ padding: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Box sx={{ position: 'absolute', top: 16, left: 16 }}>
        <IconButton onClick={onBack} aria-label="Back to Recorder">
          <ArrowBackIcon />
        </IconButton>
      </Box>
      <Typography variant="h5" gutterBottom>
        Settings
      </Typography>
      {isLoading ? (
        <CircularProgress />
      ) : (
        <Box sx={{ width: '100%', maxWidth: 500, mt: 2 }}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
            
            {/* Audio Device Selection Section */}
            <Typography variant="h6" sx={{ mb: 2 }}>
              Recording
            </Typography>
            <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel id="device-select-label">Audio Input Device</InputLabel>
                <Select
                    labelId="device-select-label"
                    id="device-select"
                    value={selectedDeviceId}
                    label="Audio Input Device"
                    onChange={onDeviceChange}
                >
                    {devices.length === 0 && <MenuItem value=""><em>No devices found</em></MenuItem>}
                    {devices.map((device) => (
                        <MenuItem key={device.deviceId} value={device.deviceId}>
                            {device.label || `Device ${device.deviceId.substring(0, 8)}...`}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            
            <Divider sx={{ my: 3 }} />
            
            {/* API Key Section */}
            <Typography variant="h6" sx={{ mb: 2 }}>
              OpenAI API Key
            </Typography>
            <TextField
                fullWidth
                type="password"
                label="API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isSaving}
                sx={{ mb: 3 }}
            />
            
            <Button
                variant="contained"
                onClick={handleSave}
                disabled={isSaving}
                sx={{ mt: 2 }}
                fullWidth
            >
                {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
        </Box>
      )}
    </Box>
  );
}

export default Settings; 