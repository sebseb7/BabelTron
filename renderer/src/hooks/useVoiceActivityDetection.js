import { useState, useRef, useEffect, useCallback } from 'react';

// Constants for VAD
const START_DELAY_MS = 50; // Delay before starting after exceeding threshold
const STOP_DELAY_MS = 1500; // Delay before stopping after falling below threshold

export function useVoiceActivityDetection({
  meterLevel,
  voiceThreshold,
  isVadEnabled, // Is the VAD switch turned on?
  isAudioPlaying, // Is playback happening (disables VAD)?
  canRecord, // Is a device selected (allows VAD)?
  isManuallyRecording, // Is recording started by button click?
  onStart, // Callback to start the actual recording (triggered by VAD)
  onStop, // Callback to stop the actual recording (triggered by VAD)
}) {
  const [isRecordingVoiceActivated, setIsRecordingVoiceActivated] = useState(false);
  const startTimeoutRef = useRef(null);
  const stopTimeoutRef = useRef(null);

  useEffect(() => {
    // Conditions under which VAD should NOT operate
    if (!isVadEnabled || !canRecord || isAudioPlaying || isManuallyRecording) {
      // Clear any pending timers if VAD is disabled or conditions aren't met
      clearTimeout(startTimeoutRef.current);
      clearTimeout(stopTimeoutRef.current);
      startTimeoutRef.current = null;
      stopTimeoutRef.current = null;
      // If VAD is disabled while it was active, ensure it stops
      if (!isVadEnabled && isRecordingVoiceActivated) {
         console.log('VAD (Hook): Disabled while active, ensuring stop.');
         onStop(false); // Pass false for isManualStop
         setIsRecordingVoiceActivated(false);
      }
      return; // Exit early
    }

    // VAD Logic (only runs if enabled and conditions are met)
    if (!isRecordingVoiceActivated) { // Not currently recording via VAD
      if (meterLevel > voiceThreshold) {
        // Above threshold: Start the start timer if not already running
        if (!startTimeoutRef.current) {
          console.log(`VAD (Hook): Above threshold (${meterLevel}), starting ${START_DELAY_MS}ms timer...`);
          startTimeoutRef.current = setTimeout(() => {
            console.log('VAD (Hook): Start timer fired, calling onStart.');
            onStart(true); // Pass true for isVoiceTriggered
            setIsRecordingVoiceActivated(true);
            startTimeoutRef.current = null;
          }, START_DELAY_MS);
        }
        // Clear any pending stop timer
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      } else {
        // Below threshold: Clear any pending start timer
        clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = null;
      }
    } else { // Currently recording via VAD
      if (meterLevel < voiceThreshold) {
        // Below threshold: Start the stop timer if not already running
        if (!stopTimeoutRef.current) {
          console.log(`VAD (Hook): Below threshold (${meterLevel}), starting ${STOP_DELAY_MS}ms stop timer...`);
          stopTimeoutRef.current = setTimeout(() => {
            console.log('VAD (Hook): Stop timer fired, calling onStop.');
            onStop(false); // Pass false for isManualStop
            setIsRecordingVoiceActivated(false);
            stopTimeoutRef.current = null;
          }, STOP_DELAY_MS);
        }
      } else {
        // Above threshold: Clear any pending stop timer
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }
    }

    // Cleanup timers on effect changes (though shouldn't be needed often)
    return () => {
        clearTimeout(startTimeoutRef.current);
        clearTimeout(stopTimeoutRef.current);
    }

  }, [
    meterLevel, 
    voiceThreshold, 
    isVadEnabled, 
    isAudioPlaying,
    canRecord,
    isManuallyRecording,
    isRecordingVoiceActivated, // Internal state dependency
    onStart, 
    onStop
  ]);
  
  // Expose the VAD recording state
  return { isRecordingVoiceActivated, setIsRecordingVoiceActivated };
} 