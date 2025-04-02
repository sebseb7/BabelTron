import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import Box from '@mui/material/Box';
import WaveSurfer from 'wavesurfer.js';

const WaveformDisplay = forwardRef(({ 
  audioUrl, 
  waveColor = 'rgb(100, 180, 255)', 
  progressColor = 'rgb(0, 220, 255)', 
  height = 100, 
  backgroundColor = 'rgba(30, 30, 30, 0.8)',
  ttsAudioChannel = 'center',
  onReadyChange = () => {},
  onPlayStateChange = () => {}
}, ref) => {
  
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const pannerNodeRef = useRef(null);
  const audioContextRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Explicitly create AudioContext before WaveSurfer instance
    // Ensure it's only created once per valid audioUrl load
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Destroy previous instance if it exists
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(e => console.warn('Error closing audio context', e));
      }
      wavesurferRef.current = null;
      pannerNodeRef.current = null;
      audioContextRef.current = null;
      setIsReady(false);
      onReadyChange(false);
      onPlayStateChange(false); // Reset play state on destroy
    }

    if (audioUrl) {
      wavesurferRef.current = WaveSurfer.create({
        container: containerRef.current,
        waveColor: waveColor,
        progressColor: progressColor,
        url: audioUrl,
        height: height,
        backgroundColor: backgroundColor,
        barWidth: 3, 
        barGap: 2,
        barRadius: 2,
        audioContext: audioContextRef.current,
        backend: 'MediaElement'
      });
      
      wavesurferRef.current.on('ready', () => {
        console.log('WaveformDisplay: Ready', audioUrl);

        // Use the AudioContext we created externally
        const audioCtx = audioContextRef.current;
        if (!audioCtx || audioCtx.state === 'closed') {
          console.error('WaveformDisplay: AudioContext is missing or closed in ready event.');
          setIsReady(false); // Indicate not truly ready
          onReadyChange(false);
          return;
        }

        // Create and configure the StereoPannerNode *inside* ready event
        try {
          pannerNodeRef.current = audioCtx.createStereoPanner();

          let panValue = 0;
          if (ttsAudioChannel === 'left') {
              panValue = -1;
          } else if (ttsAudioChannel === 'right') {
              panValue = 1;
          }
          if (pannerNodeRef.current) {
              pannerNodeRef.current.pan.value = panValue;
              
              // --- Manual Audio Graph Connection --- 
              const mediaElement = wavesurferRef.current.getMediaElement();
              if (mediaElement) {
                const source = audioCtx.createMediaElementSource(mediaElement);

                if (source) {
                  // Connect source to our panner
                  source.connect(pannerNodeRef.current);
                  // Connect our panner to the final destination
                  pannerNodeRef.current.connect(audioCtx.destination);
                  console.log('WaveformDisplay: Manually connected source -> panner -> destination.', `Initial Pan: ${panValue}`);
                } else {
                  console.error('WaveformDisplay: Could not create MediaElementAudioSourceNode.');
                }
              } else {
                console.error('WaveformDisplay: Could not get media element for manual connection.');
              }
              // --- End Manual Connection --- 
          }
        } catch (graphError) {
          console.error('WaveformDisplay: Error setting up panner node or audio graph:', graphError);
          // Potentially revert to default connection if panner fails?
          // wavesurferRef.current.backend.source?.connect(audioCtx.destination);
        }

        setIsReady(true);
        onReadyChange(true);
      });

      wavesurferRef.current.on('play', () => {
        console.log('WaveformDisplay: Play', audioUrl);
        onPlayStateChange(true);
      });

      wavesurferRef.current.on('pause', () => {
        console.log('WaveformDisplay: Pause', audioUrl);
        onPlayStateChange(false);
      });

      wavesurferRef.current.on('finish', () => {
        console.log('WaveformDisplay: Finish', audioUrl);
        wavesurferRef.current?.seekTo(0); // Seek to start on finish
        onPlayStateChange(false);
      });
      
      wavesurferRef.current.on('error', (err) => {
        console.error('WaveformDisplay: Error', audioUrl, err);
        setIsReady(false);
        onReadyChange(false);
      });

      wavesurferRef.current.on('destroy', () => {
          console.log('WaveformDisplay: Instance destroyed internally', audioUrl);
          setIsReady(false);
          onReadyChange(false);
          onPlayStateChange(false);
      });
      
    } else {
        if (wavesurferRef.current) {
            wavesurferRef.current.destroy();
        }
        setIsReady(false);
        onReadyChange(false);
        onPlayStateChange(false);
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(e => console.warn('Error closing audio context on cleanup', e));
        }
        pannerNodeRef.current = null;
        audioContextRef.current = null;
    }

    // Cleanup function for when the component unmounts or dependencies change
    return () => {
      if (wavesurferRef.current) {
        console.log('WaveformDisplay: Cleanup effect, destroying instance', audioUrl);
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
      // Ensure context is closed on cleanup
      // Note: Closing the context provided by wavesurfer might be problematic if wavesurfer manages its lifecycle.
      // Let's rely on wavesurfer.destroy() to handle context cleanup if it created it.
      /* 
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(e => console.warn('Error closing audio context on unmount cleanup', e));
      }
      */
      // Clear refs
      pannerNodeRef.current = null;
      audioContextRef.current = null;
      // Explicitly close the AudioContext we created
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(e => console.warn('Error closing audio context on unmount cleanup', e));
      }
      audioContextRef.current = null; // Clear the ref after closing
      setIsReady(false);
      onReadyChange(false);
      onPlayStateChange(false);
    };
  }, [audioUrl, waveColor, progressColor, height, backgroundColor, onReadyChange, onPlayStateChange]); // Exclude ttsAudioChannel from dependency array initially

  // Separate effect to handle pan changes when the channel prop updates
  useEffect(() => {
    if (pannerNodeRef.current) {
      let panValue = 0;
      if (ttsAudioChannel === 'left') {
        panValue = -1;
      } else if (ttsAudioChannel === 'right') {
        panValue = 1;
      }
      pannerNodeRef.current.pan.value = panValue;
      console.log(`WaveformDisplay: Pan updated to ${panValue} for channel ${ttsAudioChannel}`);
    }
  }, [ttsAudioChannel]); // Only run when ttsAudioChannel changes

  // Expose control methods via the ref
  useImperativeHandle(ref, () => ({
    playPause: () => {
      if (wavesurferRef.current && isReady) {
        wavesurferRef.current.playPause();
      } else {
         console.warn("WaveformDisplay: playPause called but not ready or instance doesn't exist.");
      }
    },
    seekTo: (progress) => {
      if (wavesurferRef.current && isReady) {
        wavesurferRef.current.seekTo(progress);
      }
    },
    getCurrentTime: () => {
      return wavesurferRef.current?.getCurrentTime() ?? 0;
    },
    play: () => { // Explicit play needed for autoplay logic
        if (wavesurferRef.current && isReady) {
            return wavesurferRef.current.play(); // Return promise
        }
        return Promise.reject("WaveformDisplay: play called but not ready.");
    }
    // Add other methods if needed (e.g., stop, setVolume)
  }));

  return (
    <Box ref={containerRef} sx={{ 
      width: '100%', 
      height: `${height}px`, // Use dynamic height
      backgroundColor: backgroundColor, // Use dynamic background
      borderRadius: 1,
      // Add any other common styles needed for the container
    }} />
  );
});

export default WaveformDisplay; 