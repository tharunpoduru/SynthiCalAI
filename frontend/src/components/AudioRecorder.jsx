import React, { useState, useRef, useEffect } from 'react';
import '../styles/AudioRecorder.css';

const AudioRecorder = ({ onAudioReady, isLoading }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioURL, setAudioURL] = useState(null);
  const [error, setError] = useState(null);

  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);
  
  const MAX_RECORDING_TIME = 60; // 1 minute in seconds

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    };
  }, [mediaRecorder]);

  const startRecording = async () => {
    try {
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });

      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { 
          type: recorder.mimeType 
        });
        
        setRecordedAudio(audioBlob);
        setAudioURL(URL.createObjectURL(audioBlob));
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          console.log('Timer update:', newTime, 'isRecording:', isRecording); // Debug log
          if (newTime >= MAX_RECORDING_TIME) {
            stopRecording();
            return MAX_RECORDING_TIME;
          }
          return newTime;
        });
      }, 1000);

    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setIsRecording(false);
  };

  const resetRecording = () => {
    // Clean up existing audio URL
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
    }
    
    // Reset all state
    setRecordedAudio(null);
    setAudioURL(null);
    setRecordingTime(0);
    setError(null);
    setIsRecording(false);
    
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Stop media recorder if still active
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  };

  const handleSubmit = () => {
    if (recordedAudio && onAudioReady) {
      // Convert blob to file-like object
      const audioFile = new File([recordedAudio], 'recording.webm', {
        type: recordedAudio.type
      });
      
      onAudioReady(audioFile);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeRemaining = () => {
    return MAX_RECORDING_TIME - recordingTime;
  };

  return (
    <div className="audio-recorder">
      {error && (
        <div className="audio-error">
          {error}
        </div>
      )}

      <div className="recording-controls">
        {!isRecording && !recordedAudio && (
          <button 
            className="record-button" 
            onClick={startRecording}
            disabled={isLoading}
          >
            <div className="record-icon"></div>
            Start Recording
          </button>
        )}

        {isRecording && (
          <div className="recording-active">
            <button 
              className="stop-button" 
              onClick={stopRecording}
            >
              <div className="stop-icon"></div>
              Stop Recording
            </button>
            
            <div className="recording-info">
              <div className="recording-indicator">
                <div className="pulse"></div>
                Recording...
              </div>
              <div className="timer">
                {formatTime(recordingTime)} / {formatTime(MAX_RECORDING_TIME)}
              </div>
              <div className="time-remaining">
                {getTimeRemaining()}s remaining
              </div>
            </div>
          </div>
        )}

        {recordedAudio && (
          <div className="recording-complete">
            <div className="audio-preview">
              <audio 
                ref={audioRef}
                src={audioURL} 
                controls 
                className="audio-player"
              />
              <div className="recording-duration">
                Duration: {formatTime(recordingTime)}
              </div>
            </div>
            
            <div className="audio-actions">
              <button 
                className="submit-button" 
                onClick={handleSubmit}
                disabled={isLoading}
              >
                Extract Events
              </button>
              <button 
                className="reset-button" 
                onClick={resetRecording}
                disabled={isLoading}
              >
                Re-record
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="audio-help">
        <p>Record up to 1 minute of audio describing your event details.</p>
        <p>Speak clearly about dates, times, locations, and event descriptions.</p>
      </div>
    </div>
  );
};

export default AudioRecorder; 