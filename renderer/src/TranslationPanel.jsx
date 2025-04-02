import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import { getLanguageName } from './languages';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import WaveformDisplay from './WaveformDisplay';
import { useTts } from './hooks/useTts'; // Import the hook

function TranslationPanel({ 
  transcription, 
  isTranscribing,
  transcriptionError,
  detectedLanguageCode,
  translation,
  isTranslating,
  translationError, 
  languageA,
  languageB,
  isRecording
}) {
  // Local state for editable text fields
  const [editableTranscription, setEditableTranscription] = useState(transcription);
  const [editableTranslation, setEditableTranslation] = useState(translation);
  
  // Remove state managed by useTts hook
  // const [ttsAudioUrl, setTtsAudioUrl] = useState(null);
  // const [isSynthesizing, setIsSynthesizing] = useState(false);
  // const [ttsError, setTtsError] = useState(null);
  const [isTtsWaveformReady, setIsTtsWaveformReady] = useState(false);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  // Add local translation loading state
  const [isLocalTranslating, setIsLocalTranslating] = useState(false);
  // Local detected language code
  const [localDetectedLangCode, setLocalDetectedLangCode] = useState('');
  // Add state for TTS audio channel
  const [ttsAudioChannel, setTtsAudioChannel] = useState('center'); // 'left', 'right', or 'center'
  
  const ttsWaveformDisplayRef = useRef(null);

  // Determine target language for TTS based on context
  const targetTtsLangCode = useMemo(() => {
    if (localDetectedLangCode === languageA && languageB !== 'detect') {
      return languageB;
    } else if (localDetectedLangCode !== languageA) {
      return languageA;
    } else {
      // Fallback if detection failed or languages are the same
      // Prefer B if specified, otherwise A (avoiding 'detect')
      return languageB !== 'detect' ? languageB : languageA;
    }
  }, [localDetectedLangCode, languageA, languageB]);

  // Use the TTS hook
  const { ttsAudioUrl, isSynthesizing, ttsError, synthesizeSpeech } = useTts();
  
  // Update local state when props change
  useEffect(() => {
    setEditableTranscription(transcription);
  }, [transcription]);
  
  useEffect(() => {
    setEditableTranslation(translation);
  }, [translation]);
  
  useEffect(() => {
    setLocalDetectedLangCode(detectedLanguageCode);
  }, [detectedLanguageCode]);
  
  // Handler for when transcription text field is edited and loses focus
  const handleTranscriptionBlur = useCallback(async () => {
    // Only trigger retranslation if text changed and not empty
    if (editableTranscription !== transcription && editableTranscription.trim()) {
      setIsLocalTranslating(true);
      
      try {
        // First re-detect language when content changes
        console.log('Detecting language for edited transcription');
        const langResult = await window.electronAPI.detectLanguage(editableTranscription);
        
        if (langResult.error) {
          console.warn('Language detection failed:', langResult.error);
          setLocalDetectedLangCode('Error');
          return; // Stop if we can't detect language
        }
        
        const sourceLangCode = langResult.languageCode || 'und';
        setLocalDetectedLangCode(sourceLangCode);
        console.log(`Re-detected language: ${sourceLangCode}`);
        
        if (sourceLangCode && sourceLangCode !== 'und' && sourceLangCode !== 'Error') {
          let targetLangCode = null;
          if (sourceLangCode === languageA && languageB !== 'detect') {
            targetLangCode = languageB;
          } else if (sourceLangCode !== languageA) {
            targetLangCode = languageA;
          }
          
          if (targetLangCode && sourceLangCode !== targetLangCode) {
            console.log(`Triggering translation from ${sourceLangCode} to ${targetLangCode} after edit`);
            const translationResult = await window.electronAPI.translateText(
              editableTranscription, 
              sourceLangCode, 
              targetLangCode
            );
            
            if (translationResult.error) {
              setTranslationError(translationResult.error);
              setEditableTranslation('');
            } else {
              const translatedText = translationResult.translation || '';
              setEditableTranslation(translatedText);
            }
          }
        } else {
          console.log('Skipping translation due to language detection issues');
        }
      } catch (err) {
        console.error("Translation error after edit:", err);
        setTranslationError(err.message || "Translation failed after edit");
      } finally {
        setIsLocalTranslating(false);
      }
    }
  }, [editableTranscription, transcription, languageA, languageB]);
  
  // Handler for when translation text field is edited and loses focus
  const handleTranslationBlur = useCallback(async () => {
    // Only trigger TTS if text changed and not empty
    if (editableTranslation !== translation && editableTranslation.trim()) {
      // Determine the correct language for TTS based on latest detection
      let ttsLanguageCode;
      
      if (localDetectedLangCode === languageA && languageB !== 'detect') {
        // If detected language is Language A, we use Language B for TTS
        ttsLanguageCode = languageB;
      } else if (localDetectedLangCode !== languageA) {
        // If detected language is NOT Language A, we use Language A for TTS
        ttsLanguageCode = languageA;
      } else {
        // Fallback case
        ttsLanguageCode = languageB !== 'detect' ? languageB : languageA;
      }
      
      // Determine and set the channel before synthesizing
      let channel = 'center';
      if (ttsLanguageCode === languageA) {
        channel = 'left';
      } else if (ttsLanguageCode === languageB) {
        channel = 'right';
      }
      setTtsAudioChannel(channel);
      console.log(`Setting TTS channel to: ${channel}`);
      
      console.log(`TTS for edited translation using language: ${ttsLanguageCode}`);
      // Call synthesizeSpeech from the hook
      synthesizeSpeech(editableTranslation, ttsLanguageCode);
    }
  }, [editableTranslation, translation, localDetectedLangCode, languageA, languageB, synthesizeSpeech]);
  
  // TTS Synthesis when translation prop changes (AUTOMATIC)
  useEffect(() => {
    if (translation && !isTranslating && !isLocalTranslating && targetTtsLangCode) {
      console.log(`Auto-synthesizing new translation in ${targetTtsLangCode}`);
      // Trigger synthesis via the hook
      synthesizeSpeech(translation, targetTtsLangCode);
      
      // Determine and set the channel after triggering synthesis
      let channel = 'center';
      if (targetTtsLangCode === languageA) {
        channel = 'left';
      } else if (targetTtsLangCode === languageB) {
        channel = 'right';
      }
      setTtsAudioChannel(channel);
      console.log(`Setting TTS channel to: ${channel}`);
    }
  }, [translation, isTranslating, isLocalTranslating, targetTtsLangCode, synthesizeSpeech]);
  
  // Refactored Handle autoplay when waveform becomes ready
  useEffect(() => {
    const waveformDisplay = ttsWaveformDisplayRef.current;
    
    console.log('Autoplay Check Effect Triggered:',
      `Ready=${isTtsWaveformReady}`,
      `URL=${ttsAudioUrl ? 'Exists' : 'None'}`,
      `Enabled=${autoplayEnabled}`,
      `Recording=${isRecording}`,
      `Playing=${isTtsPlaying}`,
      `Instance=${waveformDisplay ? 'Exists' : 'None'}`
    );

    if (isTtsWaveformReady && waveformDisplay && ttsAudioUrl) {
      console.log('Autoplay: Waveform is Ready, Instance exists, URL exists.');
      
      // Check all conditions before attempting to play
      const shouldAutoplay = autoplayEnabled && !isRecording && !isTtsPlaying;
      console.log(`Autoplay: Conditions Check: Enabled=${autoplayEnabled}, NotRecording=${!isRecording}, NotPlaying=${!isTtsPlaying} -> ShouldAutoplay=${shouldAutoplay}`);

      if (shouldAutoplay) {
        // Ensure we are at the beginning before playing
        if (waveformDisplay.getCurrentTime() === 0) {
          console.log('Autoplay: Conditions met and at start. Scheduling play...');
          // Use setTimeout to avoid potential race conditions or state update issues
          const playTimeout = setTimeout(() => {
            console.log('Autoplay: Timeout fired, attempting play...');
            waveformDisplay.play().catch(err => console.error('Autoplay: Error during play():', err));
          }, 100); // Small delay
          
          // Cleanup function for this specific effect instance
          return () => {
            console.log('Autoplay: Cleanup timeout.');
            clearTimeout(playTimeout);
          };
        } else {
          console.log('Autoplay: Conditions met, but not at the start. No action.');
        }
      } else {
        console.log('Autoplay: Conditions not met. No action.');
      }
    }
    
    // Depend primarily on readiness and the URL changing
    // Other conditions are checked inside the effect
  }, [isTtsWaveformReady, ttsAudioUrl, autoplayEnabled, isRecording]);

  // TTS Playback Handler
  const handleTtsPlayPause = useCallback(() => {
    ttsWaveformDisplayRef.current?.playPause();
  }, []);

  const handleAutoplayChange = useCallback((event) => {
    setAutoplayEnabled(event.target.checked);
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
      {/* Transcription TextField */}
      <TextField
        label={`Detected Language: ${localDetectedLangCode && localDetectedLangCode !== 'Error' ? getLanguageName(localDetectedLangCode) : '-'}`}
        multiline
        fullWidth
        rows={3}
        value={editableTranscription}
        onChange={(e) => setEditableTranscription(e.target.value)}
        onBlur={handleTranscriptionBlur}
        placeholder=""
        InputLabelProps={{ 
          shrink: true,
          sx: { 
            padding: '0 5px', 
            backgroundColor: 'background.default' 
          } 
        }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              {isTranscribing ? (
                <CircularProgress size={20} />
              ) : transcriptionError ? (
                <ErrorOutlineIcon color="error" />
              ) : null}
            </InputAdornment>
          ),
          sx: {
            paddingTop: 1.5, // Increase padding at the top
            paddingX: 1.5, // Add horizontal padding
          }
        }}
        variant="outlined"
        disabled={isTranscribing}
        size="small"
      />

      {/* Translation TextField */}
      <TextField
        label={`Translation (${getLanguageName(localDetectedLangCode === languageA ? languageB : languageA)})`}
        multiline
        fullWidth
        rows={3}
        value={editableTranslation}
        onChange={(e) => setEditableTranslation(e.target.value)}
        onBlur={handleTranslationBlur}
        placeholder=""
        InputLabelProps={{ 
          shrink: true,
          sx: { 
            padding: '0 5px', 
            backgroundColor: 'background.default' 
          } 
        }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              {isTranslating || isLocalTranslating ? (
                <CircularProgress size={20} />
              ) : translationError ? (
                <ErrorOutlineIcon color="error" />
              ) : null}
            </InputAdornment>
          ),
          sx: {
            paddingTop: 1.5, // Increase padding at the top
            paddingX: 1.5, // Add horizontal padding
          }
        }}
        variant="outlined"
        disabled={isTranslating || isLocalTranslating}
        size="small"
      />

      {/* TTS Waveform & Playback */}
      <WaveformDisplay
        ref={ttsWaveformDisplayRef}
        audioUrl={ttsAudioUrl}
        waveColor="rgb(100, 255, 180)"
        progressColor="rgb(0, 200, 100)"
        onReadyChange={setIsTtsWaveformReady}
        onPlayStateChange={setIsTtsPlaying}
        ttsAudioChannel={ttsAudioChannel}
      />
      
      {/* Container for play button and error indicator */}
      <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* TTS Status Indicator Area (Error only) */}
        <Box sx={{ 
          position: 'absolute',
          top: -8, // Position slightly above the button row
          left: 0,
          right: 0,
          zIndex: 1
        }}>
          {/* Use error state from hook */}
          {ttsError && !isSynthesizing && (
            <Alert severity="error" sx={{ width: '100%', padding: '2px 10px' }}>{`TTS Error: ${ttsError}`}</Alert>
          )}
        </Box>

        {/* TTS Play Button Area */}
        <Box sx={{ position: 'relative', zIndex: 2, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant="contained"
            color="success"
            startIcon={isTtsPlaying ? <PauseIcon /> : <PlayArrowIcon />}
            onClick={handleTtsPlayPause}
            disabled={!ttsAudioUrl || !isTtsWaveformReady}
            sx={{ 
              minWidth: 120,
              width: 120,
            }}
          >
            {isTtsPlaying ? 'Pause' : 'Play'}
          </Button>
          <FormControlLabel
            control={
              <Checkbox 
                checked={autoplayEnabled}
                onChange={handleAutoplayChange}
                size="small"
                color="success"
                tabIndex={-1}
              />
            }
            label="Auto-play"
            sx={{ marginLeft: 1 }}
            tabIndex={-1}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </Box>
      </Box>
    </Box>
  );
}

export default TranslationPanel; 