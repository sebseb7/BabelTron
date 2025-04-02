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
import FormHelperText from '@mui/material/FormHelperText';

// TTS model options
const TTS_MODELS = [
  { value: 'tts-1-hd', label: 'TTS-1-HD (Higher quality, slower)' },
  { value: 'gpt-4o-mini-tts', label: 'GPT-4o Mini TTS (Faster)' }
];

// Transcription model options
const TRANSCRIBE_MODELS = [
  { value: 'whisper-1', label: 'Whisper-1 (Default, reliable)' },
  { value: 'gpt-4o-mini-transcribe', label: 'GPT-4o Mini Transcribe (Faster)' },
  { value: 'gpt-4o-transcribe', label: 'GPT-4o Transcribe (High accuracy)' }
];

function Settings({ onBack, selectedDeviceId, onDeviceChange, devices }) {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [ttsModel, setTtsModel] = useState('tts-1-hd');
  const [transcribeModel, setTranscribeModel] = useState('whisper-1');

  // Load API key and settings on mount
  useEffect(() => {
    setError(null);
    setIsLoading(true);
    setIsSaving(false); // Reset saving state when component mounts
    
    Promise.all([
      window.electronAPI.getApiKey(),
      window.electronAPI.getTtsModel(),
      window.electronAPI.getTranscribeModel()
    ])
    .then(([key, ttsModel, transcribeModel]) => {
      setApiKey(key || '');
      setTtsModel(ttsModel || 'tts-1-hd'); // Default to tts-1-hd if not set
      setTranscribeModel(transcribeModel || 'whisper-1'); // Default to whisper-1 if not set
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
      
      // Save TTS model
      const ttsModelResult = await window.electronAPI.setTtsModel(ttsModel);
      
      // Save Transcription model
      const transcribeModelResult = await window.electronAPI.setTranscribeModel(transcribeModel);
      
      if (apiKeyResult.success && ttsModelResult.success && transcribeModelResult.success) {
        // Reset saving state before navigating back
        setIsSaving(false);
        // Navigate back to the main page
        onBack();
      } else {
        const errorMessage = [
          apiKeyResult.error, 
          ttsModelResult.error,
          transcribeModelResult.error
        ].filter(Boolean).join('. ');
        
        setError(errorMessage || 'Failed to save settings.');
        setIsSaving(false);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError(err.message || 'An unknown error occurred while saving.');
      setIsSaving(false);
    }
  }, [apiKey, ttsModel, transcribeModel, onBack]);

  const handleTtsModelChange = (event) => {
    setTtsModel(event.target.value);
  };

  const handleTranscribeModelChange = (event) => {
    setTranscribeModel(event.target.value);
  };

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
            
            {/* Transcription Model Selection Section */}
            <Typography variant="h6" sx={{ mb: 2 }}>
              Transcription
            </Typography>
            <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel id="transcribe-model-select-label">Transcription Model</InputLabel>
                <Select
                    labelId="transcribe-model-select-label"
                    id="transcribe-model-select"
                    value={transcribeModel}
                    label="Transcription Model"
                    onChange={handleTranscribeModelChange}
                    disabled={isSaving}
                >
                    {TRANSCRIBE_MODELS.map((model) => (
                        <MenuItem key={model.value} value={model.value}>
                            {model.label}
                        </MenuItem>
                    ))}
                </Select>
                <FormHelperText>
                  Select the model for speech transcription
                </FormHelperText>
            </FormControl>
            
            {/* TTS Model Selection Section */}
            <Typography variant="h6" sx={{ mb: 2 }}>
              Text-to-Speech
            </Typography>
            <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel id="tts-model-select-label">TTS Model</InputLabel>
                <Select
                    labelId="tts-model-select-label"
                    id="tts-model-select"
                    value={ttsModel}
                    label="TTS Model"
                    onChange={handleTtsModelChange}
                    disabled={isSaving}
                >
                    {TTS_MODELS.map((model) => (
                        <MenuItem key={model.value} value={model.value}>
                            {model.label}
                        </MenuItem>
                    ))}
                </Select>
                <FormHelperText>
                  Select the model for speech synthesis
                </FormHelperText>
            </FormControl>
            
            <Divider sx={{ my: 3 }} />
            
            {/* API Key Section */}
            <Typography variant="h6" sx={{ mb: 2 }}>
              API Settings
            </Typography>
            <TextField
                fullWidth
                label="OpenAI API Key"
                type="password" // Basic obfuscation
                variant="outlined"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                helperText="Your API key is stored locally. Use a dedicated key for this application."
                sx={{ mb: 2 }}
                disabled={isSaving}
            />
            <Button 
                variant="contained" 
                onClick={handleSave} 
                disabled={isSaving}
            >
                {isSaving ? <CircularProgress size={24} /> : 'Save Settings'}
            </Button>
        </Box>
      )}
    </Box>
  );
}

export default Settings; 