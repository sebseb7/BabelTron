import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import Box from '@mui/material/Box';
import WaveSurfer from 'wavesurfer.js';

const WaveformDisplay = forwardRef(({ 
  audioUrl, 
  waveColor = 'rgb(100, 180, 255)', 
  progressColor = 'rgb(0, 220, 255)', 
  height = 100, 
  backgroundColor = 'rgba(30, 30, 30, 0.8)',
  onReadyChange = () => {},
  onPlayStateChange = () => {}
}, ref) => {
  
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy previous instance if it exists
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
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
        // Consider adding backend options if needed (e.g., MediaElement)
      });

      wavesurferRef.current.on('ready', () => {
        console.log('WaveformDisplay: Ready', audioUrl);
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
        // Ensure cleanup if audioUrl becomes null
         if (wavesurferRef.current) {
            wavesurferRef.current.destroy();
            wavesurferRef.current = null;
        }
        setIsReady(false);
        onReadyChange(false);
        onPlayStateChange(false);
    }

    // Cleanup function for when the component unmounts or dependencies change
    return () => {
      if (wavesurferRef.current) {
        console.log('WaveformDisplay: Cleanup effect, destroying instance', audioUrl);
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
      setIsReady(false);
      onReadyChange(false);
      onPlayStateChange(false);
    };
  }, [audioUrl, waveColor, progressColor, height, backgroundColor, onReadyChange, onPlayStateChange]); // Re-run if props change

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