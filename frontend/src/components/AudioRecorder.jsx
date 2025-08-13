import React, { useEffect, useRef, useState } from 'react'

export default function AudioRecorder({ onReady, disabled }) {
  const [recording, setRecording] = useState(false)
  const [blob, setBlob] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const media = useRef(null)
  const chunks = useRef([])
  const timer = useRef(null)
  const LIMIT_SECONDS = 60

  useEffect(() => () => {
    if (media.current && media.current.state !== 'inactive') media.current.stop()
    if (timer.current) clearInterval(timer.current)
  }, [])

  async function start() {
    try {
      setError('')
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
      })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      media.current = new MediaRecorder(stream, { mimeType })
      chunks.current = []
      setElapsed(0)
      
      media.current.ondataavailable = e => { 
        if (e.data.size > 0) chunks.current.push(e.data) 
      }
      
      media.current.onstop = () => {
        const b = new Blob(chunks.current, { type: mimeType })
        setBlob(b)
        // Don't auto-call onReady here - let user click "Extract Events" button
        stream.getTracks().forEach(t=>t.stop())
        if (timer.current) { 
          clearInterval(timer.current) 
          timer.current = null 
        }
      }
      
      media.current.start()
      timer.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1
          if (next >= LIMIT_SECONDS) {
            stop()
            return LIMIT_SECONDS
          }
          return next
        })
      }, 1000)
      setRecording(true)
    } catch (err) {
      console.error('Error accessing microphone:', err)
      setError('Could not access microphone. Please check permissions.')
    }
  }

  function stop() {
    if (media.current && media.current.state !== 'inactive') media.current.stop()
    if (timer.current) { 
      clearInterval(timer.current) 
      timer.current = null 
    }
    setRecording(false)
  }

  function reset() {
    setBlob(null)
    setElapsed(0)
    setError('')
  }

  function format(s) {
    const m = Math.floor(s / 60)
    const ss = String(s % 60).padStart(2, '0')
    return `${m}:${ss}`
  }

  const remaining = LIMIT_SECONDS - elapsed

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="text-center">
        {!recording && !blob && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-brand rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
              </svg>
            </div>
            <button 
              className="btn-primary text-lg px-8 py-3" 
              onClick={start} 
              disabled={disabled}
            >
              Start Recording
            </button>
          </div>
        )}

        {recording && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-500 rounded-full flex items-center justify-center animate-pulse">
              <div className="w-6 h-6 bg-white rounded-full"></div>
            </div>
            <div className="text-2xl font-bold text-gray-900 font-mono">
              {format(elapsed)} / {format(LIMIT_SECONDS)}
            </div>
            <div className="text-sm text-gray-600">
              {remaining > 0 ? `${remaining}s remaining` : 'Time limit reached'}
            </div>
            <button 
              className="bg-gray-800 hover:bg-gray-900 text-white font-medium py-2 px-6 rounded-lg transition-colors" 
              onClick={stop} 
              disabled={disabled}
            >
              Stop Recording
            </button>
          </div>
        )}

        {blob && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
              </svg>
            </div>
            <div className="text-lg font-semibold text-gray-900">Recording Complete</div>
            <div className="text-sm text-gray-600">Duration: {format(elapsed)}</div>
            
            <audio 
              controls 
              src={URL.createObjectURL(blob)} 
              className="w-full max-w-sm mx-auto h-10 rounded-lg"
            />
            
            <div className="flex gap-3 justify-center mt-4">
              <button 
                className="btn-primary" 
                onClick={() => onReady && onReady(new File([blob], `recording.${blob.type.includes('webm')?'webm':'mp4'}`, { type: blob.type }))} 
                disabled={disabled}
              >
                Extract Events
              </button>
              <button 
                className="btn-secondary" 
                onClick={reset} 
                disabled={disabled}
              >
                Record Again
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="text-center text-gray-600 text-sm mt-6">
        <p>Speak clearly about your event details including dates, times, and locations.</p>
        <p>Maximum recording time: 60 seconds</p>
      </div>
    </div>
  )
}