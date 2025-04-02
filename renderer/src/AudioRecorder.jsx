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
import WaveSurfer from 'wavesurfer.js';
import { LANGUAGES, getLanguageName } from './languages';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';

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
  const [meterLevel, setMeterLevel] = useState(0);
  const [isWaveformReady, setIsWaveformReady] = useState(false);
  const [isVoiceActivationEnabled, setIsVoiceActivationEnabled] = useState(false);
  const [isRecordingVoiceActivated, setIsRecordingVoiceActivated] = useState(false);
  const [isMeterActive, setIsMeterActive] = useState(false);
  const [voiceThreshold, setVoiceThreshold] = useState(5); // Default threshold value (0-255)
  const [previousVoiceActivationState, setPreviousVoiceActivationState] = useState(false); // Store previous state

  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const meterAnimationRef = useRef(null);
  const waveformRef = useRef(null);
  const wavesurferInstanceRef = useRef(null);
  const startTimeoutRef = useRef(null);
  const stopTimeoutRef = useRef(null);

  // Constants for VAD
  const START_DELAY_MS = 50; // Delay before starting after exceeding threshold
  const STOP_DELAY_MS = 1500; // Delay before stopping after falling below threshold

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (meterAnimationRef.current) {
        cancelAnimationFrame(meterAnimationRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (wavesurferInstanceRef.current) {
          wavesurferInstanceRef.current.destroy();
      }
      clearTimeout(startTimeoutRef.current);
      clearTimeout(stopTimeoutRef.current);
    };
  }, []);

  const setupAudioContextAndMeter = useCallback(async () => {
    if (!selectedDeviceId || audioContextRef.current?.state === 'running') {
        console.log('Audio context setup skipped (no device or already running)');
        return;
    }
    console.log('Setting up Audio Context and Meter...');
    try {
        const constraints = { audio: { deviceId: { exact: selectedDeviceId } } };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            await audioContextRef.current.close();
        }
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;

        if(sourceRef.current) {
            sourceRef.current.disconnect();
        }
        sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
        sourceRef.current.connect(analyserRef.current);

        audioContextRef.current._streamTracks = stream.getTracks(); 
        
        setIsMeterActive(true);
        updateMeter();

    } catch (err) {
        console.error("Error setting up audio context for meter:", err);
        cleanupAudioContextAndMeter();
    }
  }, [selectedDeviceId]);

  const cleanupAudioContextAndMeter = useCallback(() => {
    console.log('Cleaning up Audio Context and Meter...');
    if (meterAnimationRef.current) {
      cancelAnimationFrame(meterAnimationRef.current);
      meterAnimationRef.current = null;
    }
    setIsMeterActive(false);
    setMeterLevel(0);

    if (audioContextRef.current?._streamTracks) {
        audioContextRef.current._streamTracks.forEach(track => track.stop());
        audioContextRef.current._streamTracks = null; 
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    analyserRef.current = null; 

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(e => console.error("Error closing audio context:", e));
      audioContextRef.current = null;
    }
  }, []);

  useEffect(() => {
    const needsContext = (isRecording || isVoiceActivationEnabled) && selectedDeviceId;
    const contextExists = audioContextRef.current && audioContextRef.current.state !== 'closed';

    console.log(`Context check: needsContext=${needsContext}, contextExists=${contextExists}, isRecording=${isRecording}, VAD=${isVoiceActivationEnabled}`);

    if (needsContext && !contextExists) {
        setupAudioContextAndMeter();
    } else if (!needsContext && contextExists) {
        cleanupAudioContextAndMeter();
    }

    return () => {
        if (audioContextRef.current && audioContextRef.current.state !== 'closed' && !((isRecording || isVoiceActivationEnabled) && selectedDeviceId)) {
            // console.log('Running cleanup from effect return...');
            // cleanupAudioContextAndMeter();
        }
    };
  }, [isRecording, isVoiceActivationEnabled, selectedDeviceId, setupAudioContextAndMeter, cleanupAudioContextAndMeter]);

  const updateMeter = () => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      setMeterLevel(average);
      meterAnimationRef.current = requestAnimationFrame(updateMeter);
    } else {
        cancelAnimationFrame(meterAnimationRef.current);
        meterAnimationRef.current = null;
        setMeterLevel(0);
    }
  };

  const handleTranscribe = useCallback(async (blobToTranscribe) => {
    if (!blobToTranscribe) {
      console.error("No audio blob provided for transcription.");
      return;
    }
    
    const arrayBuffer = await blobToTranscribe.arrayBuffer();
    onTranscriptionStart(arrayBuffer, blobToTranscribe);
  }, [onTranscriptionStart]);

  const handleStartRecording = useCallback(async (isVoiceTriggered = false) => {
    if (!selectedDeviceId) {
      console.warn("No audio input device selected.");
      return;
    }
    if (isRecording) {
        console.log("Recording already in progress.");
        return;
    }
    
    console.log(`Starting recording... (Voice Triggered: ${isVoiceTriggered})`);
    setIsRecordingVoiceActivated(isVoiceTriggered);

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
        const constraints = { audio: { deviceId: { exact: selectedDeviceId } } };
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        const options = { mimeType: 'audio/webm' };
        let chosenMimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(chosenMimeType)) {
            chosenMimeType = 'audio/mp3';
            if (!MediaRecorder.isTypeSupported(chosenMimeType)) chosenMimeType = '';
        }
        mediaRecorderRef.current = new MediaRecorder(mediaStream, chosenMimeType ? { mimeType: chosenMimeType } : {});
        console.log('Using MediaRecorder mimeType:', mediaRecorderRef.current.mimeType);

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
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }

    } catch (err) {
      console.error("Error starting recording:", err);
      setIsRecording(false);
      setIsRecordingVoiceActivated(false);
      if (!isVoiceActivationEnabled) {
        cleanupAudioContextAndMeter(); 
      }
    }
  }, [selectedDeviceId, audioUrl, handleTranscribe, isRecording, isVoiceActivationEnabled, cleanupAudioContextAndMeter]);

  const handleStopRecording = useCallback((isManualStop = true) => {
    console.log(`Stopping recording... (Manual: ${isManualStop})`);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (isManualStop) {
        clearTimeout(startTimeoutRef.current);
        clearTimeout(stopTimeoutRef.current);
        startTimeoutRef.current = null;
        stopTimeoutRef.current = null;
        setIsRecordingVoiceActivated(false);
      }
    } else {
        console.log("Stop recording called but not in recording state or no recorder.");
        setIsRecording(false); 
        setIsRecordingVoiceActivated(false); 
    }
  }, [isVoiceActivationEnabled, cleanupAudioContextAndMeter]);

  const handlePlayPause = useCallback(() => {
    if (wavesurferInstanceRef.current && isWaveformReady) { 
        if (!isPlaying) {
          // About to start playing - save and disable voice activation
          setPreviousVoiceActivationState(isVoiceActivationEnabled);
          if (isVoiceActivationEnabled) {
            setIsVoiceActivationEnabled(false);
          }
        } else {
          // Stopping playback - restore voice activation if it was enabled before
          setIsVoiceActivationEnabled(previousVoiceActivationState);
        }
        
        wavesurferInstanceRef.current.playPause();
    }
  }, [isWaveformReady, isPlaying, isVoiceActivationEnabled, previousVoiceActivationState]);

  useEffect(() => {
    console.log('Waveform useEffect running. audioUrl:', audioUrl);

    if (audioUrl && waveformRef.current) {
      console.log('Waveform useEffect: Creating/Recreating WaveSurfer instance.');
      setIsWaveformReady(false);

      if (wavesurferInstanceRef.current) {
        wavesurferInstanceRef.current.destroy();
      }
      
      wavesurferInstanceRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: 'rgb(100, 180, 255)',
        progressColor: 'rgb(0, 220, 255)',
        url: audioUrl,
        barWidth: 3, 
        barGap: 2,
        barRadius: 2,
        height: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
      });

      wavesurferInstanceRef.current.on('ready', () => {
        console.log('Waveform useEffect: WaveSurfer is ready!');
        setIsWaveformReady(true);
      });
      wavesurferInstanceRef.current.on('error', (err) => {
        console.error('Waveform useEffect: WaveSurfer error:', err);
        setIsWaveformReady(false);
      });

      wavesurferInstanceRef.current.on('play', () => { setIsPlaying(true); });
      wavesurferInstanceRef.current.on('pause', () => { setIsPlaying(false); });
      wavesurferInstanceRef.current.on('finish', () => { 
        wavesurferInstanceRef.current.seekTo(0);
        setIsPlaying(false); 
      });

    } else {
      console.log('Waveform useEffect: No audioUrl or container, cleaning up.');
      if (wavesurferInstanceRef.current) {
        wavesurferInstanceRef.current.destroy();
        wavesurferInstanceRef.current = null;
      }
      setIsWaveformReady(false);
    }

    return () => {
        console.log('Waveform useEffect: Cleanup function running.');
    };
  }, [audioUrl]);

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
            handleStopRecording();
          } else {
            if (selectedDeviceId) {
              handleStartRecording();
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
  }, [isRecording, selectedDeviceId, handleStartRecording, handleStopRecording, enableKeyboardShortcuts]);

  const handleToggleVoiceActivation = (event) => {
    // Don't allow enabling if already playing audio, but always allow disabling
    if (event.target.checked && isPlaying) return;
    
    setIsVoiceActivationEnabled(event.target.checked);
    
    // If turning off voice activation while recording with voice activation, stop recording
    if (!event.target.checked) {
      if (isRecordingVoiceActivated) {
        handleStopRecording(false);
      }
      clearTimeout(startTimeoutRef.current);
      clearTimeout(stopTimeoutRef.current);
    }
  };

  const handleThresholdChange = (event, newValue) => {
    setVoiceThreshold(newValue);
  };

  useEffect(() => {
    // Disable voice activation when playing audio
    if (!isVoiceActivationEnabled || !selectedDeviceId || isPlaying) {
      clearTimeout(startTimeoutRef.current);
      clearTimeout(stopTimeoutRef.current);
      return;
    }

    if (!isRecording) {
      if (meterLevel > voiceThreshold) {
        if (!startTimeoutRef.current) {
          console.log(`VAD: Above threshold (${meterLevel}), starting ${START_DELAY_MS}ms timer...`);
          startTimeoutRef.current = setTimeout(() => {
            console.log('VAD: Start timer fired, starting recording.');
            handleStartRecording(true);
            startTimeoutRef.current = null;
          }, START_DELAY_MS);
        }
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      } else {
        clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = null;
      }
    } else {
      if (meterLevel < voiceThreshold) {
        if (!stopTimeoutRef.current && isRecordingVoiceActivated) {
          console.log(`VAD: Below threshold (${meterLevel}), starting ${STOP_DELAY_MS}ms stop timer...`);
          stopTimeoutRef.current = setTimeout(() => {
            console.log('VAD: Stop timer fired, stopping recording.');
            handleStopRecording(false);
            stopTimeoutRef.current = null;
          }, STOP_DELAY_MS);
        }
      } else {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }
    }
  }, [meterLevel, isVoiceActivationEnabled, isRecording, selectedDeviceId, isRecordingVoiceActivated, voiceThreshold]);

  // Effect to handle voice activation state when playback ends
  useEffect(() => {
    // When playback ends (isPlaying changes to false)
    if (!isPlaying && previousVoiceActivationState) {
      // Small delay to ensure wavesurfer is done
      const timer = setTimeout(() => {
        setIsVoiceActivationEnabled(previousVoiceActivationState);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isPlaying, previousVoiceActivationState]);

  return (
    <>
      {/* Input Row (Languages) */}
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
          {/* Language A Dropdown */}
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

          {/* Language B Dropdown */}
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

      {/* Audio Meter Section */}
      <Box sx={{ 
          width: '80%', 
          maxWidth: 400, 
          marginBottom: 0.5,
          paddingBottom: 0
      }}>
          <Box sx={{ position: 'relative', width: '100%' }}>
              {/* Audio Level Meter */}
              <LinearProgress 
                  variant="determinate" 
                  value={isMeterActive ? (meterLevel / 255) * 100 : 0}
                  color={isRecording ? "primary" : "inherit"}
                  sx={{ 
                      height: 8, 
                      borderRadius: 3,
                      backgroundColor: 'rgba(50, 50, 50, 0.8)',
                  }}
              />
              
              {/* Threshold Indicator - Always visible */}
              <Box sx={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: `${(voiceThreshold / 255) * 100}%`, 
                  height: 8, 
                  width: 2, 
                  backgroundColor: meterLevel > voiceThreshold ? 'red' : 'orange',
                  transform: 'translateX(-50%)', 
                  zIndex: 2,
                  opacity: isVoiceActivationEnabled ? 1 : 0.5 // Dimmed when not active
              }} />
          </Box>
      </Box>

      {/* Voice Activation Threshold Slider - In its own section */}
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
                  opacity: isVoiceActivationEnabled ? 1 : 0.7 // Slightly dimmed when not active
              }}
          />
      </Box>

      {/* Control Buttons Section */}
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
          {/* Record/Stop Buttons */}
          <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<MicIcon />}
                  onClick={handleStartRecording}
                  disabled={isRecording || !selectedDeviceId || isVoiceActivationEnabled}
              >
                  Record
              </Button>
              <Button
                  variant="contained"
                  color="error"
                  startIcon={<StopIcon />}
                  onClick={handleStopRecording}
                  disabled={!isRecording}
              >
                  Stop
              </Button>
          </Box>
          
          {/* Voice Activation Switch */}
          <FormControlLabel
              control={<Switch 
                  checked={isVoiceActivationEnabled} 
                  onChange={handleToggleVoiceActivation} 
                  disabled={false} 
              />}
              label="Voice Activate"
          />
      </Box>

      {/* Waveform Section */}
      <Box sx={{ width: '90%', maxWidth: 600, marginBottom: 2, marginTop: 2 }}>
          <Box ref={waveformRef} sx={{ 
              width: '100%', 
              height: '100px',
              backgroundColor: 'rgba(30, 30, 30, 0.8)',
              marginBottom: 2.5,
              borderRadius: 1,
          }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
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