import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import WaveSurfer from 'wavesurfer.js';
import { getLanguageName } from './languages';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';

function TranslationPanel({ 
  transcription, 
  isTranscribing,
  transcriptionError,
  detectedLanguageCode,
  translation,
  isTranslating,
  translationError, 
  languageA,
  languageB
}) {
  // Local state for editable text fields
  const [editableTranscription, setEditableTranscription] = useState(transcription);
  const [editableTranslation, setEditableTranslation] = useState(translation);
  
  const [ttsAudioUrl, setTtsAudioUrl] = useState(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [ttsError, setTtsError] = useState(null);
  const [isTtsWaveformReady, setIsTtsWaveformReady] = useState(false);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);
  // Add local translation loading state
  const [isLocalTranslating, setIsLocalTranslating] = useState(false);
  // Local detected language code
  const [localDetectedLangCode, setLocalDetectedLangCode] = useState('');
  
  const ttsWaveformRef = useRef(null);
  const ttsWavesurferInstanceRef = useRef(null);
  
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
      
      console.log(`TTS for edited translation using language: ${ttsLanguageCode}`);
      synthesizeSpeech(editableTranslation, ttsLanguageCode);
    }
  }, [editableTranslation, translation, localDetectedLangCode, languageA, languageB]);
  
  // TTS WaveSurfer setup
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
        waveColor: 'rgb(100, 255, 180)', // Mint green wave
        progressColor: 'rgb(0, 200, 100)', // Darker green progress
        url: ttsAudioUrl,
        barWidth: 3, 
        barGap: 2,
        barRadius: 2,
        height: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.05)', // Subtle white background for contrast
      });

      ttsWavesurferInstanceRef.current.on('ready', () => {
        console.log('TTS Waveform useEffect: TTS WaveSurfer is ready!');
        setIsTtsWaveformReady(true); 
      });
      ttsWavesurferInstanceRef.current.on('error', (err) => {
        console.error('TTS Waveform useEffect: TTS WaveSurfer error:', err);
        setIsTtsWaveformReady(false);
      });

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
      if (ttsAudioUrl) {
        URL.revokeObjectURL(ttsAudioUrl);
      }
      if (ttsWavesurferInstanceRef.current) {
        ttsWavesurferInstanceRef.current.destroy();
      }
    };
  }, [ttsAudioUrl]);

  // Function to synthesize speech
  const synthesizeSpeech = async (textToSynthesize, overrideLanguageCode = null) => {
    if (!textToSynthesize) return;
    
    setIsSynthesizing(true);
    setTtsError(null);
    setTtsAudioUrl(null);
    
    try {
      // Use override language if provided, otherwise determine based on detected language
      let ttsLanguageCode = overrideLanguageCode;
      
      if (!ttsLanguageCode) {
        if (localDetectedLangCode === languageA && languageB !== 'detect') {
          // If detected language is Language A, we translated TO Language B
          ttsLanguageCode = languageB;
        } else if (localDetectedLangCode !== languageA) {
          // If detected language is NOT Language A, we translated TO Language A
          ttsLanguageCode = languageA;
        } else {
          // Fallback case - use Language B or Language A if B is 'detect'
          ttsLanguageCode = languageB !== 'detect' ? languageB : languageA;
        }
      }
      
      // Debug information to help diagnose language selection issues
      console.log('Language selection details:');
      console.log(`- Language A (languageA): ${languageA}`);
      console.log(`- Language B (languageB): ${languageB}`);
      console.log(`- Detected language (localDetectedLangCode): ${localDetectedLangCode}`);
      console.log(`- Selected language for TTS (ttsLanguageCode): ${ttsLanguageCode}`);
      console.log(`- Override language provided: ${overrideLanguageCode ? 'Yes' : 'No'}`);
      console.log(`- Translation target: ${localDetectedLangCode === languageA ? 'TO Language B' : 'TO Language A'}`);
      
      // Make sure we pass the explicit ttsLanguageCode
      const ttsResult = await window.electronAPI.synthesizeSpeech(textToSynthesize, ttsLanguageCode);
      if (ttsResult.error) {
        throw new Error(ttsResult.error);
      }
      
      const ttsBlob = new Blob([ttsResult.audioData], { type: 'audio/mp3' });
      const newTtsUrl = URL.createObjectURL(ttsBlob);
      setTtsAudioUrl(newTtsUrl);
      console.log('TTS audio generated:', newTtsUrl);
    } catch (ttsErr) {
      console.error('TTS Synthesis Error:', ttsErr);
      setTtsError(ttsErr.message || 'Failed to synthesize speech.');
      setTtsAudioUrl(null);
    } finally {
      setIsSynthesizing(false);
    }
  };
  
  // TTS Synthesis when translation changes
  useEffect(() => {
    if (translation && !isTranslating && !isLocalTranslating) {
      // No override language - let synthesizeSpeech determine target language
      synthesizeSpeech(translation);
    }
  }, [translation, isTranslating, isLocalTranslating, localDetectedLangCode]);
  
  // Watch for changes in detected language and re-synthesize if needed
  useEffect(() => {
    // Only re-synthesize if we have existing translation and the language changed
    if (editableTranslation && localDetectedLangCode && !isTranslating && !isLocalTranslating) {
      console.log(`Re-synthesizing TTS due to language change to: ${localDetectedLangCode}`);
      
      // Determine the correct language for synthesis
      let ttsLanguageCode;
      if (localDetectedLangCode === languageA && languageB !== 'detect') {
        ttsLanguageCode = languageB;
      } else if (localDetectedLangCode !== languageA) {
        ttsLanguageCode = languageA;
      } else {
        ttsLanguageCode = languageB !== 'detect' ? languageB : languageA;
      }
      
      synthesizeSpeech(editableTranslation, ttsLanguageCode);
    }
  }, [localDetectedLangCode, languageA, languageB]);

  // Reset autoplay flag when URL changes
  useEffect(() => {
    // When ttsAudioUrl changes, reset the played flag
    setHasAutoPlayed(false);
    
    return () => {
      // This cleanup runs when ttsAudioUrl changes
      if (ttsWavesurferInstanceRef.current) {
        ttsWavesurferInstanceRef.current.stop();
      }
    };
  }, [ttsAudioUrl]);

  // Handle autoplay when waveform becomes ready
  useEffect(() => {
    if (autoplayEnabled && ttsAudioUrl && isTtsWaveformReady && !isTtsPlaying && !hasAutoPlayed) {
      // Small delay to ensure the waveform is fully initialized
      const timeout = setTimeout(() => {
        if (ttsWavesurferInstanceRef.current) {
          ttsWavesurferInstanceRef.current.play();
          setHasAutoPlayed(true); // Mark this TTS as played
        }
      }, 100);
      
      return () => clearTimeout(timeout);
    }
  }, [autoplayEnabled, ttsAudioUrl, isTtsWaveformReady, isTtsPlaying, hasAutoPlayed]);

  // TTS Playback Handler
  const handleTtsPlayPause = useCallback(() => {
    if (ttsWavesurferInstanceRef.current && isTtsWaveformReady) { 
      ttsWavesurferInstanceRef.current.playPause();
    }
  }, [isTtsWaveformReady]);

  const handleAutoplayChange = useCallback((event) => {
    setAutoplayEnabled(event.target.checked);
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
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
      <Box ref={ttsWaveformRef} sx={{ 
        width: '100%', 
        height: '100px',
        backgroundColor: 'rgba(30, 30, 30, 0.8)',
        marginTop: 0,
        marginBottom: 0,
        position: 'relative',
        borderRadius: 1,
      }}>
        {isSynthesizing && (
          <Box sx={{ 
            position: 'absolute', 
            top: 8,
            right: 8, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            color: 'text.secondary', 
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: '2px 8px',
            borderRadius: 1
          }}>
            <CircularProgress size={16} color="success" />
            <Typography variant="caption">Synthesizing...</Typography>
          </Box>
        )}
      </Box>
      
      {/* Container for play button and error indicator */}
      <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* TTS Status Indicator Area (Error only) */}
        <Box sx={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1
        }}>
          {ttsError && !isSynthesizing && (
            <Alert severity="error" sx={{ width: '100%' }}>{`TTS Error: ${ttsError}`}</Alert>
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