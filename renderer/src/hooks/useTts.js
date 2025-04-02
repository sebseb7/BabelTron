import { useState, useEffect, useCallback } from 'react';

export function useTts() {
  const [ttsAudioUrl, setTtsAudioUrl] = useState(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [ttsError, setTtsError] = useState(null);

  // Function to perform synthesis, exposed by the hook
  const synthesizeSpeech = useCallback(async (text, langCode) => {
    if (!text || !langCode) {
      console.log('TTS Hook: Synthesis skipped (no text or langCode)');
      setTtsAudioUrl(null); // Clear previous audio if any
      setTtsError(null);
      setIsSynthesizing(false);
      return;
    }

    console.log(`TTS Hook: Synthesizing '${text.substring(0, 20)}...' in ${langCode}`);
    setIsSynthesizing(true);
    setTtsError(null);
    // Clear previous URL immediately before new synthesis
    if (ttsAudioUrl) {
      URL.revokeObjectURL(ttsAudioUrl);
    }
    setTtsAudioUrl(null);

    try {
      const ttsResult = await window.electronAPI.synthesizeSpeech(text, langCode);
      if (ttsResult.error) {
        throw new Error(ttsResult.error);
      }
      
      const ttsBlob = new Blob([ttsResult.audioData], { type: 'audio/mp3' });
      const newTtsUrl = URL.createObjectURL(ttsBlob);
      setTtsAudioUrl(newTtsUrl);
      console.log('TTS Hook: Audio generated:', newTtsUrl);
    } catch (err) {
      console.error('TTS Hook: Synthesis Error:', err);
      setTtsError(err.message || 'Failed to synthesize speech.');
      setTtsAudioUrl(null);
    } finally {
      setIsSynthesizing(false);
    }
  }, []);

  // Effect to clean up the object URL when the component unmounts or URL changes
  useEffect(() => {
    // This cleanup runs *before* the next effect or on unmount
    const currentUrl = ttsAudioUrl; // Capture URL at the time effect runs
    return () => {
      if (currentUrl) {
        console.log('TTS Hook: Cleaning up Object URL:', currentUrl);
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [ttsAudioUrl]); // Run only when ttsAudioUrl changes

  return { ttsAudioUrl, isSynthesizing, ttsError, synthesizeSpeech };
} 