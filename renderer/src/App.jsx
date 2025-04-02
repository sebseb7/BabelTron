import React, { useState, useRef, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import WaveSurfer from 'wavesurfer.js';
import SettingsIcon from '@mui/icons-material/Settings';
import IconButton from '@mui/material/IconButton';
import Settings from './Settings';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import darkTheme from './theme';
import babeltronLogo from './assets/babeltron.png'; // Correct import path

// ---------------------------------
import AudioRecorder from './AudioRecorder';
import TranslationPanel from './TranslationPanel';

const clientBuildTime = process.env.CLIENT_BUILD_TIME || 'N/A'; // Read the injected variable

// Enum for views
const VIEWS = {
    RECORDER: 'recorder',
    SETTINGS: 'settings'
};

// --- Expanded Language List (ISO 639-1 Code -> Name, Sorted) --- 
// const LANGUAGES = { ... };

// Function to get language name from code
// const getLanguageName = ...;

function App() {
  const [currentView, setCurrentView] = useState(VIEWS.RECORDER);
  const [isRecording, setIsRecording] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [audioUrl, setAudioUrl] = useState(null);

  const [isWaveformReady, setIsWaveformReady] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [detectedLanguageCode, setDetectedLanguageCode] = useState('');
  const [languageA, setLanguageA] = useState('de'); // Default Language A to German
  const [languageB, setLanguageB] = useState('detect'); // Default Language B to Detect
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState(null);
  // --- Add Translation State ---
  const [translation, setTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState(null);
  // --- Add TTS State & Refs ---
  const [ttsAudioUrl, setTtsAudioUrl] = useState(null);

  const [isTtsWaveformReady, setIsTtsWaveformReady] = useState(false);
 
  const ttsWaveformRef = useRef(null);
  const ttsWavesurferInstanceRef = useRef(null);
  // ---------------------------

  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const meterAnimationRef = useRef(null);
  const waveformRef = useRef(null);
  const wavesurferInstanceRef = useRef(null);

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

    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (ttsAudioUrl) {
        URL.revokeObjectURL(ttsAudioUrl);
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
      if (ttsWavesurferInstanceRef.current) {
          ttsWavesurferInstanceRef.current.destroy();
      }
    };
  }, []);

  const handleDeviceChange = (event) => {
    setSelectedDeviceId(event.target.value);
  };

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
        setMeterLevel(0);
    }
  };

  // --- Handler for Transcription (accepts blob) ---
  const handleTranscriptionStart = useCallback(async (audioArrayBuffer, audioBlob) => {
    if (!audioArrayBuffer) {
        setTranscriptionError("No audio data provided for transcription.");
        return;
    }

    // Reset all states initially
    setTranscription('');
    setDetectedLanguageCode('');
    setTranscriptionError(null);
    setTranslation(''); 
    setTranslationError(null);
    setIsTranscribing(true);
    setIsTranslating(false);

    let receivedTranscription = '';
    let sourceLangCode = 'und';

    try {
        // Transcription & Language Detection
        console.log('Sending to main for transcription...');
        const transcribeResult = await window.electronAPI.transcribeAudio(audioArrayBuffer);

        if (transcribeResult.error) {
            throw new Error(`Transcription Error: ${transcribeResult.error}`);
        }
        
        receivedTranscription = transcribeResult.transcription || '';
        setTranscription(receivedTranscription);

        if (receivedTranscription) {
            console.log('Sending to main for language detection...');
            const langResult = await window.electronAPI.detectLanguage(receivedTranscription);
            if (langResult.error) {
                console.warn('Language detection failed:', langResult.error);
                setDetectedLanguageCode('Error');
            } else {
                sourceLangCode = langResult.languageCode || 'und';
                setDetectedLanguageCode(sourceLangCode);
                console.log(`Checking Language B update: languageB='${languageB}', newDetectedCode='${sourceLangCode}', languageA='${languageA}'`);

                // Dynamically update Language B if set to Detect
                if (languageB === 'detect' && 
                    sourceLangCode && 
                    sourceLangCode !== 'und' && 
                    sourceLangCode !== 'Error' && 
                    sourceLangCode !== languageA) 
                {
                    if (sourceLangCode !== 'detect' && sourceLangCode !== 'und') {
                         console.log(`*** Language B check PASSED. Updating Language B from 'detect' to '${sourceLangCode}'.`);
                         setLanguageB(sourceLangCode);
                    } else {
                        console.log(`--- Language B check FAILED (Detected code '${sourceLangCode}' not valid for update).`);
                    }
                } else {
                    console.log(`--- Language B check FAILED (languageB is not 'detect' or other conditions not met). Current languageB: '${languageB}'`);
                }
            }
        } else {
            setDetectedLanguageCode('');
        }

    } catch (err) {
        console.error("Transcription/Detection Error:", err);
        setTranscriptionError(err.message || "An unknown error occurred during transcription/detection.");
        setTranscription(''); 
        setDetectedLanguageCode(''); 
    } finally {
        setIsTranscribing(false);
    }

    // Translation (only if transcription succeeded)
    if (receivedTranscription && !transcriptionError) {
        setIsTranslating(true);
        setTranslation('');
        setTranslationError(null);
        try {
            let targetLangCode = null;
            if (sourceLangCode && sourceLangCode !== 'und' && sourceLangCode !== 'Error') {
                if (sourceLangCode === languageA && languageB !== 'detect') {
                    targetLangCode = languageB;
                } else if (sourceLangCode !== languageA) {
                    targetLangCode = languageA;
                }
            }

            if (targetLangCode && sourceLangCode !== targetLangCode) {
                 console.log(`Triggering translation from ${sourceLangCode} to ${targetLangCode}`);
                 const translationResult = await window.electronAPI.translateText(receivedTranscription, sourceLangCode, targetLangCode);
                 
                 setTranslationError(null);
                 
                 if (translationResult.error) {
                    setTranslationError(translationResult.error);
                    setTranslation('');
                 } else {
                    const translatedText = translationResult.translation || '';
                    setTranslation(translatedText);
                 }
            } else {
                console.log('Skipping translation (no valid target or source/target same).');
                setTranslation('');
            }
        } catch (translateErr) {
            console.error("Translation Error:", translateErr);
            setTranslationError(translateErr.message || "An unknown error occurred during translation.");
            setTranslation('');
        } finally {
            setIsTranslating(false);
        }
    }
  }, [languageA, languageB]);

  // --- Handler for Starting Recording ---
  const handleStartRecording = useCallback(async () => {
    if (!selectedDeviceId) {
      console.warn("No audio input device selected.");
      return;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    try {
      const constraints = {
        audio: { deviceId: { exact: selectedDeviceId } }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
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

      // --- Try WebM first, then MP3 as fallback ---
      const options = { mimeType: 'audio/webm' }; // Try WebM format first (better for GPT-4o)
      let chosenMimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(chosenMimeType)) {
        console.warn(`${chosenMimeType} is not supported. Trying audio/mp3.`);
        chosenMimeType = 'audio/mp3';
        if (!MediaRecorder.isTypeSupported(chosenMimeType)) {
          console.warn(`${chosenMimeType} is not supported. Falling back to default.`);
          chosenMimeType = ''; // Let the browser choose default (likely webm)
        }
      }
      mediaRecorderRef.current = new MediaRecorder(stream, chosenMimeType ? { mimeType: chosenMimeType } : {});
      console.log('Using MediaRecorder mimeType:', mediaRecorderRef.current.mimeType);
      // -------------------------------------------

      const audioChunks = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        // --- Use the actual mimeType for the Blob ---
        const blob = new Blob(audioChunks, { type: mediaRecorderRef.current.mimeType || 'audio/webm' });
        // -------------------------------------------
        const newUrl = URL.createObjectURL(blob);
        
        // Clear previous blob/url state first
        if (audioUrl) { URL.revokeObjectURL(audioUrl); }
        setAudioBlob(blob);
        setAudioUrl(newUrl);
        
        stream.getTracks().forEach(track => track.stop());

        // --- Cleanup Meter ---
        if (meterAnimationRef.current) { cancelAnimationFrame(meterAnimationRef.current); meterAnimationRef.current = null; }
        if(sourceRef.current) { sourceRef.current.disconnect(); sourceRef.current = null; }
        setMeterLevel(0);
        // -----------------

        // --- Trigger Transcription --- 
        handleTranscriptionStart(null, blob); 
        // ---------------------------
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setAudioBlob(null);
      setIsPlaying(false);
      if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
      }

      updateMeter();

    } catch (err) {
      console.error("Error starting recording or audio context:", err);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
         audioContextRef.current.close();
      }
      setMeterLevel(0);
      if (meterAnimationRef.current) {
          cancelAnimationFrame(meterAnimationRef.current);
          meterAnimationRef.current = null;
      }
    }
  }, [selectedDeviceId, audioUrl, handleTranscriptionStart]);

  // --- Other Handlers ---
  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const handlePlayPause = useCallback(() => {
    if (wavesurferInstanceRef.current && isWaveformReady) { 
        wavesurferInstanceRef.current.playPause();
    }
  }, [isWaveformReady]);

  useEffect(() => {
    // Only reset readiness if audioUrl is actually changing or null
    // setIsWaveformReady(false); // <-- Move this reset inside conditions

    // Log when this effect runs and the state of audioUrl
    console.log('Waveform useEffect running. audioUrl:', audioUrl);

    // Clean up previous Tone.Player instance (Already removed)
    // ...

    if (audioUrl && waveformRef.current) {
      console.log('Waveform useEffect: Creating/Recreating WaveSurfer instance.');
      setIsWaveformReady(false); // Reset readiness when creating new instance

      if (wavesurferInstanceRef.current) {
        wavesurferInstanceRef.current.destroy();
      }
      
      wavesurferInstanceRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: 'rgb(100, 180, 255)', // Tron-like blue
        // Change progress color for better visibility
        progressColor: 'rgb(0, 220, 255)', // Bright Cyan 
        url: audioUrl,
        barWidth: 3, 
        barGap: 2,
        barRadius: 2,
        height: 100,
      });

      wavesurferInstanceRef.current.on('ready', () => {
        console.log('Waveform useEffect: WaveSurfer is ready!');
        setIsWaveformReady(true); // Set ready state
      });
      wavesurferInstanceRef.current.on('error', (err) => {
        console.error('Waveform useEffect: WaveSurfer error:', err);
        setIsWaveformReady(false); // Ensure readiness is false on error
      });

      // Playback state handling
      wavesurferInstanceRef.current.on('play', () => { setIsPlaying(true); });
      wavesurferInstanceRef.current.on('pause', () => { setIsPlaying(false); });
      wavesurferInstanceRef.current.on('finish', () => { 
        wavesurferInstanceRef.current.seekTo(0);
        setIsPlaying(false); 
      });

    } else {
      // If no audioUrl or container, ensure cleanup and reset state
      console.log('Waveform useEffect: No audioUrl or container, cleaning up.');
      if (wavesurferInstanceRef.current) {
        wavesurferInstanceRef.current.destroy();
        wavesurferInstanceRef.current = null;
      }
      setIsWaveformReady(false); // Reset readiness
    }

    // Cleanup function remains the same (implicitly handles instance destruction)
    return () => {
        console.log('Waveform useEffect: Cleanup function running.');
        // Optional: Explicitly destroy here if needed, though the logic above should cover it.
        // if (wavesurferInstanceRef.current) {
        //    wavesurferInstanceRef.current.destroy();
        //    wavesurferInstanceRef.current = null;
        // }
    };
  }, [audioUrl]); // Dependency remains audioUrl

  useEffect(() => {
    // This effect was clearing transcription on audioUrl change. 
    // Let's keep it, but ensure it doesn't interfere with waveform logic.
    // It runs *after* the waveform effect if audioUrl changes.
    if (audioUrl) { // Only clear if we actually have a new URL
        setTranscription('');
        setDetectedLanguageCode('');
        setTranscriptionError(null);
    }
    // Removed setIsWaveformReady(false) from here as the other effect handles it.
  }, [audioUrl]);

  // We're removing this effect since AudioRecorder now handles the spacebar functionality
  // This prevents having competing event handlers that can cause conflicts
  
  // --- Effect for TTS WaveSurfer ---
  useEffect(() => {
    console.log('TTS Waveform useEffect running. ttsAudioUrl:', ttsAudioUrl);
    setIsTtsWaveformReady(false);

    if (ttsAudioUrl && ttsWaveformRef.current) {
      console.log('TTS Waveform useEffect: Creating/Recreating TTS WaveSurfer instance.');
      if (ttsWavesurferInstanceRef.current) {
        ttsWavesurferInstanceRef.current.destroy();
      }
      
      ttsWavesurferInstanceRef.current = WaveSurfer.create({
        container: ttsWaveformRef.current,
        waveColor: 'rgb(100, 255, 180)', // Mint green
        progressColor: 'rgb(0, 200, 100)', // Darker green
        url: ttsAudioUrl,
        barWidth: 3, 
        barGap: 2,
        barRadius: 2,
        height: 100,
      });

      ttsWavesurferInstanceRef.current.on('ready', () => {
        console.log('TTS Waveform useEffect: TTS WaveSurfer is ready!');
        setIsTtsWaveformReady(true); 
      });
      ttsWavesurferInstanceRef.current.on('error', (err) => {
        console.error('TTS Waveform useEffect: TTS WaveSurfer error:', err);
        setIsTtsWaveformReady(false);
      });

      // TTS Playback state handling
      ttsWavesurferInstanceRef.current.on('play', () => { setIsTtsPlaying(true); });
      ttsWavesurferInstanceRef.current.on('pause', () => { setIsTtsPlaying(false); });
      ttsWavesurferInstanceRef.current.on('finish', () => { 
        ttsWavesurferInstanceRef.current.seekTo(0);
        setIsTtsPlaying(false); 
      });

    } else {
      console.log('TTS Waveform useEffect: No ttsAudioUrl or container, cleaning up.');
      if (ttsWavesurferInstanceRef.current) {
        ttsWavesurferInstanceRef.current.destroy();
        ttsWavesurferInstanceRef.current = null;
      }
      setIsTtsWaveformReady(false); 
    }

    return () => {
        console.log('TTS Waveform useEffect: Cleanup function running.');
        // Implicit cleanup handles destruction on url change or unmount
    };
  }, [ttsAudioUrl]); // Depend on ttsAudioUrl

  // --- TTS Playback Handler ---
  const handleTtsPlayPause = useCallback(() => {
    if (ttsWavesurferInstanceRef.current && isTtsWaveformReady) { 
        ttsWavesurferInstanceRef.current.playPause();
    }
  }, [isTtsWaveformReady]);

  // Render logic based on currentView
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ 
        padding: 2, // Reduce padding from 3 to 2
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        position: 'relative', 
        paddingBottom: '20px', // Reduce bottom padding
        bgcolor: 'background.default',
        color: 'text.primary',
        height: '100vh', // Use 100vh instead of minHeight
        overflow: 'hidden', // Prevent scrolling
        boxSizing: 'border-box' // Include padding in height calculation
      }}>
        
        {/* Settings Button - Only visible when not on settings page */}
        {currentView !== VIEWS.SETTINGS && (
          <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 10 /* Ensure button is clickable */ }}>
              <IconButton onClick={() => setCurrentView(VIEWS.SETTINGS)} aria-label="Settings" color="primary">
                  <SettingsIcon />
              </IconButton>
          </Box>
        )}
        
        {/* Build Timestamp - Always visible with higher z-index */}
        <Typography 
          variant="caption" 
          sx={{ 
            position: 'absolute', 
            bottom: 8, 
            right: 8, 
            color: 'text.secondary',
            zIndex: 100, // Ensure it appears above other content
            backgroundColor: 'rgba(0, 0, 0, 0.3)', // Semi-transparent background
            padding: '2px 6px',
            borderRadius: 1
          }}
        >
          v{process.env.APP_VERSION} (Build: {process.env.GIT_COMMIT_HASH}, {clientBuildTime})
        </Typography>

        {/* --- Recorder View Container --- */}
        <Box sx={{ width: '100%', display: currentView === VIEWS.RECORDER ? 'flex' : 'none', flexDirection: 'column', alignItems: 'center' }}>
          <Box sx={{ mt: 1, mb: 1.5 }}> {/* Adjust margins for the image */}
            <img 
              src={babeltronLogo} 
              alt="BabelTron Logo" 
              style={{ height: '60px', width: 'auto' }} // Adjust height as needed
            />
          </Box>

          {/* Audio Recorder Component */}
          <AudioRecorder 
            onTranscriptionStart={handleTranscriptionStart}
            languageA={languageA}
            setLanguageA={setLanguageA}
            languageB={languageB}
            setLanguageB={setLanguageB}
            isTranscribing={isTranscribing}
            selectedDeviceId={selectedDeviceId}
            enableKeyboardShortcuts={currentView === VIEWS.RECORDER}
          />

          {/* Translation Panel Component */}
          <Box sx={{ width: '90%', maxWidth: 600, mt: 1 }}>
            <TranslationPanel 
              transcription={transcription}
              isTranscribing={isTranscribing}
              transcriptionError={transcriptionError}
              detectedLanguageCode={detectedLanguageCode}
              translation={translation}
              isTranslating={isTranslating}
              translationError={translationError}
              languageA={languageA}
              languageB={languageB}
            />
          </Box>
        </Box>

        {/* --- Settings View Container --- */}
        {/* Use conditional rendering instead of CSS display property */}
        {currentView === VIEWS.SETTINGS && (
          <Box sx={{ width: '100%' }}>
             {/* Render Settings component, pass device props */} 
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