import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import SettingsIcon from '@mui/icons-material/Settings';
import IconButton from '@mui/material/IconButton';
import Settings from './Settings';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import darkTheme from './theme';
import babeltronLogo from './assets/babeltron.png';

// Enum for views
const VIEWS = {
    RECORDER: 'recorder',
    SETTINGS: 'settings'
};

function App() {
  const [currentView, setCurrentView] = useState(VIEWS.RECORDER);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  useEffect(() => {
    const getAudioDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputDevices = allDevices.filter(device => device.kind === 'audioinput');
        setDevices(audioInputDevices);
        if (audioInputDevices.length > 0) {
            const defaultDevice = audioInputDevices.find(d => d.deviceId === 'default') || audioInputDevices[0];
            setSelectedDeviceId(defaultDevice.deviceId);
        }
      } catch (err) {
        console.error("Error getting audio devices or permissions:", err);
      }
    };

    getAudioDevices();
  }, []);

  const handleDeviceChange = (event) => {
    setSelectedDeviceId(event.target.value);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ 
        minHeight: '100vh',
        backgroundColor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative'
      }}>
        {currentView === VIEWS.RECORDER && (
          <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
            <IconButton 
              onClick={() => setCurrentView(VIEWS.SETTINGS)} 
              aria-label="Settings"
              sx={{ color: 'text.primary' }}
            >
              <SettingsIcon />
            </IconButton>
          </Box>
        )}

        <Box sx={{ width: '100%', display: currentView === VIEWS.RECORDER ? 'flex' : 'none', flexDirection: 'column', alignItems: 'center' }}>
          <Box sx={{ mt: 1, mb: 1.5 }}>
            <img 
              src={babeltronLogo} 
              alt="BabelTron Logo" 
              style={{ height: '60px', width: 'auto' }}
            />
          </Box>

          {/* Placeholder for new Semantic VAD implementation */}
          <Box sx={{ width: '90%', maxWidth: 600, mt: 1 }}>
            <Typography variant="body1" align="center" color="text.secondary">
              Semantic Voice Activity Detection Coming Soon
            </Typography>
          </Box>
        </Box>

        {currentView === VIEWS.SETTINGS && (
          <Box sx={{ width: '100%' }}>
            <Settings 
              onBack={() => setCurrentView(VIEWS.RECORDER)} 
              selectedDeviceId={selectedDeviceId}
              onDeviceChange={handleDeviceChange}
              devices={devices}
            />
          </Box>
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App; 