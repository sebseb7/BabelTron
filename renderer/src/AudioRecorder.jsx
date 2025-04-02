import React, { useState, useRef, useEffect, useCallback } from 'react';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import LinearProgress from '@mui/material/LinearProgress';
import { LANGUAGES, getLanguageName } from './languages';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import WaveformDisplay from './WaveformDisplay';
import { useAudioInputMeter } from './hooks/useAudioInputMeter';
import { useVoiceActivityDetection } from './hooks/useVoiceActivityDetection';

function AudioRecorder({ 
  onTranscriptionStart, 
  languageA, 
  setLanguageA, 
  languageB, 
  setLanguageB, 
  isTranscribing,
  selectedDeviceId,
  enableKeyboardShortcuts = true,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isWaveformReady, setIsWaveformReady] = useState(false);
  const [isVoiceActivationEnabled, setIsVoiceActivationEnabled] = useState(false);
  const [voiceThreshold, setVoiceThreshold] = useState(5);
  const [previousVoiceActivationState, setPreviousVoiceActivationState] = useState(false);

  const { meterLevel, isMeterActive } = useAudioInputMeter(selectedDeviceId);

  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(null);
  const waveformDisplayRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, []);

  const handleTranscribe = useCallback(async (blobToTranscribe) => {
    if (!blobToTranscribe) {
      console.error("No audio blob provided for transcription.");
      return;
    }
    
    const arrayBuffer = await blobToTranscribe.arrayBuffer();
    onTranscriptionStart(arrayBuffer, blobToTranscribe);
  }, [onTranscriptionStart]);

  // Define basic start/stop FIRST (without VAD logic)
  const startMediaRecorder = useCallback(async () => {
    if (!selectedDeviceId || isRecording) return;

    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }

    try {
      const constraints = { audio: { deviceId: { exact: selectedDeviceId } } };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      const options = { mimeType: 'audio/webm' }; // Simplified mime type logic
      mediaRecorderRef.current = new MediaRecorder(mediaStream, options);
      const audioChunks = [];
      mediaRecorderRef.current.ondataavailable = (event) => { audioChunks.push(event.data); };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunks, { type: mediaRecorderRef.current.mimeType || 'audio/webm' });
        const newUrl = URL.createObjectURL(blob);
        if (audioUrl) { URL.revokeObjectURL(audioUrl); }
        setAudioBlob(blob);
        setAudioUrl(newUrl);
        mediaStream.getTracks().forEach(track => track.stop()); 
        handleTranscribe(blob);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setAudioBlob(null);
      setIsPlaying(false);
    } catch (err) {
      console.error("Error starting recording:", err);
      setIsRecording(false);
    }
  }, [selectedDeviceId, audioUrl, handleTranscribe, isRecording]);

  const stopMediaRecorder = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      console.log("Stop recording called but not in recording state or no recorder.");
      setIsRecording(false); // Ensure state is false
    }
  }, []); // No dependencies needed

  // Use the VAD Hook, passing the basic start/stop
  const { 
    isRecordingVoiceActivated: isRecordingVoiceActivatedVADHook 
  } = useVoiceActivityDetection({
    meterLevel,
    voiceThreshold,
    isVadEnabled: isVoiceActivationEnabled,
    isAudioPlaying: isPlaying,
    canRecord: !!selectedDeviceId,
    isManuallyRecording: isRecording, // Pass the main recording state
    onStart: startMediaRecorder, // VAD calls this to start
    onStop: stopMediaRecorder   // VAD calls this to stop
  });

  // Handlers for UI interaction
  const handleManualStartRecording = useCallback(() => {
     console.log('Starting recording... (Manual Trigger)');
     startMediaRecorder();
  }, [startMediaRecorder]);

  const handleManualStopRecording = useCallback(() => {
    console.log(`Stopping recording... (Manual Trigger)`);
    stopMediaRecorder();
  }, [stopMediaRecorder]);

  const handlePlayPause = useCallback(() => {
    waveformDisplayRef.current?.playPause();

    if (isPlaying) {
      setPreviousVoiceActivationState(isVoiceActivationEnabled);
      if (isVoiceActivationEnabled) {
        setIsVoiceActivationEnabled(false);
      }
    } else {
      setIsVoiceActivationEnabled(previousVoiceActivationState);
    }
  }, [isPlaying, isVoiceActivationEnabled, previousVoiceActivationState]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!enableKeyboardShortcuts) return;
      
      if (event.code === 'Space') {
        const activeElement = document.activeElement;
        
        const allowDefaultSpace = activeElement && (
          activeElement.tagName === 'INPUT' || 
          activeElement.tagName === 'TEXTAREA' || 
          activeElement.isContentEditable ||
          activeElement.closest('.MuiInputBase-root') ||
          activeElement.closest('.MuiTextField-root') ||
          activeElement.getAttribute('role') === 'textbox' ||
          activeElement.getAttribute('role') === 'combobox' ||
          (activeElement.parentElement && activeElement.parentElement.isContentEditable)
        );

        if (!allowDefaultSpace) {
          event.preventDefault(); 
          event.stopPropagation();

          if (isRecording) {
            handleManualStopRecording();
          } else {
            if (selectedDeviceId) {
              handleManualStartRecording();
            }
          }
        }
      }
    };

    if (enableKeyboardShortcuts) {
      window.addEventListener('keydown', handleKeyDown, { capture: true });
      return () => {
        window.removeEventListener('keydown', handleKeyDown, { capture: true });
      };
    }
    
    return () => {};
  }, [isRecording, selectedDeviceId, handleManualStartRecording, handleManualStopRecording, enableKeyboardShortcuts]);

  const handleToggleVoiceActivation = (event) => {
    if (event.target.checked && isPlaying) return;
    
    setIsVoiceActivationEnabled(event.target.checked);
  };

  const handleThresholdChange = (event, newValue) => {
    setVoiceThreshold(newValue);
  };

  return (
    <>
      <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          marginBottom: 3,
          width: '100%', 
          maxWidth: { xs: '90%', sm: 700 },
          justifyContent: 'center', 
          alignItems: 'center' 
      }}>
          <FormControl sx={{ minWidth: 200, width: { xs: '100%', sm: '45%' } }} size="small">
              <InputLabel id="lang-a-select-label">Language A</InputLabel>
              <Select
                  labelId="lang-a-select-label"
                  id="lang-a-select"
                  value={languageA}
                  label="Language A"
                  onChange={(e) => setLanguageA(e.target.value)}
                  disabled={isRecording} 
              >
                  {Object.entries(LANGUAGES)
                      .filter(([code]) => code !== 'und' && code !== 'detect')
                      .map(([code, name]) => (
                          <MenuItem key={code} value={code}>{name}</MenuItem>
                      ))}
              </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 200, width: { xs: '100%', sm: '45%' } }} size="small">
              <InputLabel id="lang-b-select-label">Language B</InputLabel>
              <Select
                  labelId="lang-b-select-label"
                  id="lang-b-select"
                  value={languageB}
                  label="Language B"
                  onChange={(e) => setLanguageB(e.target.value)}
                  disabled={isRecording}
              >
                  {Object.entries(LANGUAGES)
                      .filter(([code]) => code !== 'und')
                      .map(([code, name]) => (
                          <MenuItem key={code} value={code}>{name}</MenuItem>
                      ))}
              </Select>
          </FormControl>
      </Box>

      <Box sx={{ 
          width: '80%', 
          maxWidth: 400, 
          marginBottom: 0.5,
          paddingBottom: 0
      }}>
          <Box sx={{ position: 'relative', width: '100%' }}>
              {(() => {
                  const scaledLevel = isMeterActive ? Math.pow(Math.max(0, meterLevel) / 255, 0.5) * 100 : 0;
                  let meterColor = 'success';
                  if (scaledLevel >= 70) {
                      meterColor = 'error';
                  } else if (scaledLevel >= 30) {
                      meterColor = 'warning';
                  }

                  return (
                      <LinearProgress 
                          variant="determinate" 
                          value={scaledLevel}
                          color={meterColor}
                          sx={{ 
                              height: 8, 
                              borderRadius: 3,
                              backgroundColor: 'rgba(50, 50, 50, 0.8)',
                          }}
                      />
                  );
              })()}
              
              <Box sx={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: `${Math.pow(Math.max(0, voiceThreshold) / 255, 0.5) * 100}%`, 
                  height: 8, 
                  width: 2, 
                  backgroundColor: meterLevel > voiceThreshold ? 'red' : 'orange',
                  transform: 'translateX(-50%)', 
                  zIndex: 2,
                  opacity: isVoiceActivationEnabled ? 1 : 0.5
              }} />
          </Box>
      </Box>

      <Box sx={{ 
          width: '80%', 
          maxWidth: 400, 
          marginBottom: 0.5,
          paddingBottom: 0
      }}>
          <Slider
              size="small"
              value={voiceThreshold}
              onChange={handleThresholdChange}
              min={0}
              max={50}
              valueLabelDisplay="auto"
              disabled={isRecording || isPlaying}
              sx={{
                  opacity: isVoiceActivationEnabled ? 1 : 0.7
              }}
          />
      </Box>

      <Box sx={{ 
          width: '90%',
          maxWidth: 500,
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          marginBottom: 2,
          paddingTop: 0
      }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                  variant="contained"
                  color={isRecording ? "error" : "secondary"}
                  startIcon={isRecording ? <StopIcon /> : <MicIcon />}
                  onClick={isRecording ? handleManualStopRecording : handleManualStartRecording}
                  disabled={!isRecording && (!selectedDeviceId || isVoiceActivationEnabled)}
                  sx={{ minWidth: 110, width: 110 }}
              >
                  {isRecording ? 'Stop' : 'Record'}
              </Button>
              
              {enableKeyboardShortcuts && (
                  <Typography variant="caption" color="text.secondary">
                      (Space)
                  </Typography>
              )}
          </Box>
          
          <FormControlLabel
              control={<Switch 
                  checked={isVoiceActivationEnabled} 
                  onChange={handleToggleVoiceActivation} 
                  disabled={false} 
              />}
              label="Voice Activate"
          />
      </Box>

      <Box sx={{ width: '90%', maxWidth: 600, marginBottom: 2, marginTop: 2 }}>
          <WaveformDisplay 
              ref={waveformDisplayRef}
              audioUrl={audioUrl}
              waveColor="rgb(100, 180, 255)"
              progressColor="rgb(0, 220, 255)"
              onReadyChange={setIsWaveformReady}
              onPlayStateChange={setIsPlaying}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }}>
              <Button
                  variant="contained"
                  color="primary"
                  startIcon={isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                  onClick={handlePlayPause}
                  disabled={!audioUrl || !isWaveformReady}
                  sx={{ 
                    minWidth: 120,
                    width: 120,
                  }}
              >
                  {isPlaying ? 'Pause' : 'Play'}
              </Button>
          </Box>
      </Box>
    </>
  );
}

export default AudioRecorder; 