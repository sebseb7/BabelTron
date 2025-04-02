import { useState, useRef, useEffect, useCallback } from 'react';

export function useAudioInputMeter(selectedDeviceId) {
  const [meterLevel, setMeterLevel] = useState(0);
  const [isMeterActive, setIsMeterActive] = useState(false);
  
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const meterAnimationRef = useRef(null);
  const streamTracksRef = useRef(null); // Use ref to store tracks

  const updateMeter = useCallback(() => {
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
      // Ensure animation frame is cancelled if analyser is gone
      if (meterAnimationRef.current) {
        cancelAnimationFrame(meterAnimationRef.current);
        meterAnimationRef.current = null;
      }
      setMeterLevel(0);
    }
  }, []); // No dependencies needed

  const cleanupAudioContextAndMeter = useCallback(() => {
    console.log('Cleaning up Audio Context and Meter (Hook)...');
    if (meterAnimationRef.current) {
      cancelAnimationFrame(meterAnimationRef.current);
      meterAnimationRef.current = null;
    }
    setIsMeterActive(false);
    setMeterLevel(0);

    // Stop tracks stored in the ref
    if (streamTracksRef.current) {
      streamTracksRef.current.forEach(track => track.stop());
      streamTracksRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    analyserRef.current = null; 

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(e => console.error("Error closing audio context (Hook):", e));
      audioContextRef.current = null;
    }
  }, []); // No dependencies needed

  const setupAudioContextAndMeter = useCallback(async () => {
    // Prevent setup if no device or already running
    if (!selectedDeviceId || audioContextRef.current?.state === 'running') {
      console.log('Audio context setup skipped (no device or already running) (Hook).');
      return;
    }
    console.log('Setting up Audio Context and Meter (Hook)...');
    try {
      // Ensure cleanup before setup
      cleanupAudioContextAndMeter(); 
      
      const constraints = { audio: { deviceId: { exact: selectedDeviceId } } };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256; // Consistent FFT size

      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);

      // Store tracks in the ref
      streamTracksRef.current = stream.getTracks(); 
      
      setIsMeterActive(true);
      updateMeter(); // Start the meter update loop

    } catch (err) {
      console.error("Error setting up audio context for meter (Hook):", err);
      cleanupAudioContextAndMeter(); // Ensure cleanup on error
    }
  // Depend only on selectedDeviceId and the cleanup function
  }, [selectedDeviceId, cleanupAudioContextAndMeter, updateMeter]); 

  // Effect to manage audio context lifecycle based ONLY on selected device
  useEffect(() => {
    if (selectedDeviceId) {
      console.log('Device selected, ensuring audio context for meter is active (Hook).');
      setupAudioContextAndMeter();
    } else {
      console.log('No device selected, ensuring audio context for meter is cleaned up (Hook).');
      cleanupAudioContextAndMeter();
    }

    // Primary cleanup function for the hook's lifecycle
    // This runs when selectedDeviceId changes or the component using the hook unmounts
    return () => {
      console.log('Running cleanup for audio context due to device change or unmount (Hook).');
      cleanupAudioContextAndMeter();
    };
  // Re-run this effect if the device changes or the setup/cleanup functions change identity (though they shouldn't with useCallback)
  }, [selectedDeviceId, setupAudioContextAndMeter, cleanupAudioContextAndMeter]);

  // Return the state needed by the component
  return { meterLevel, isMeterActive };
} 