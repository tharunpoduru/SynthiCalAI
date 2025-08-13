import React, { useMemo, useState } from 'react'
import { logEvent } from './analytics.js'
import AudioRecorder from './components/AudioRecorder.jsx'
import AddToCalendar from './components/AddToCalendar.jsx'
import EventCards from './components/EventCards.jsx'

export default function App() {
  const [events, setEvents] = useState([])
  const [file, setFile] = useState(null)
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [tab, setTab] = useState('text') // 'text' | 'document' | 'image' | 'audio' | 'url'
  const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [selected, setSelected] = useState(() => new Set())

  const processText = async () => {
    setLoading(true); setError(''); setStatus('Analyzing with Gemini…')
    try {
      const res = await fetch('/api/process-text', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, userTimeZone: tz })
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setEvents(data.events || [])
      logEvent('extraction_succeeded', { type: 'text', event_count: (data.events||[]).length })
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }

  const processUrl = async () => {
    setLoading(true); setError(''); setStatus('Fetching page & analyzing…')
    try {
      const res = await fetch('/api/process-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, userTimeZone: tz })
      })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errorText}`)
      }
      const data = await res.json()
      setEvents(data.events || [])
      logEvent('extraction_succeeded', { type: 'url', event_count: (data.events||[]).length })
    } catch (e) { 
      console.error('URL processing error:', e)
      setError(String(e))
      logEvent('extraction_failed', { type: 'url', error_category: String(e).substring(0, 100) }) 
    } finally { 
      setLoading(false)
      setStatus('')
    }
  }

  const processFile = async (e) => {
    e.preventDefault()
    if (!file) return
    // 25 MB limit UI validation
    if (file.size > 25 * 1024 * 1024) { setError('File too large (max 25 MB).'); return }
    setLoading(true); setError(''); setStatus('Uploading file…')
    try {
      // Use multipart form data to upload through backend
      const formData = new FormData()
      formData.append('file', file)
      formData.append('userTimeZone', tz)
      
      setStatus('Analyzing with Gemini…')
      const res = await fetch('/api/process-file', { 
        method: 'POST', 
        body: formData 
      })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errorText}`)
      }
      const data = await res.json()
      setEvents(data.events || [])
      logEvent('extraction_succeeded', { type: tab, event_count: (data.events||[]).length })
    } catch (e) { 
      console.error('File processing error:', e)
      setError(String(e))
      logEvent('extraction_failed', { type: tab, error_category: String(e).substring(0, 100) }) 
    } finally { 
      setLoading(false)
      setStatus('')
    }
  }

  const downloadICS = async (evArray = events, filename = 'events.ics') => {
    if (!evArray.length) return
    const res = await fetch('/api/generate-ics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: evArray })
    })
    if (!res.ok) { setError(await res.text()); return }
    const blob = await res.blob(); const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
    logEvent('download_all_ics', { event_count: evArray.length })
  }

  const downloadSelected = async () => {
    const indices = Array.from(selected)
    if (indices.length === 0) return
    const payload = indices.map(i => events[i])
    await downloadICS(payload, 'selected-events.ics')
  }

  const acceptByTab = useMemo(() => ({
    document: '.pdf,.doc,.docx,.txt,.rtf',
    image: '.png,.jpg,.jpeg,.webp,.heif',
    audio: 'audio/*'
  }), [])

  const handleDrop = (e) => {
    e.preventDefault()
    if (e.dataTransfer?.files?.[0]) setFile(e.dataTransfer.files[0])
  }

  const toggleSelected = (idx) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  const setAllSelected = (checked) => {
    if (!checked) { setSelected(new Set()); return }
    setSelected(new Set(events.map((_, i) => i)))
  }

  return (
    <>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-2">
          <span className="text-brand">Synthi</span>Cal AI
        </h1>
        <p className="text-center text-gray-600 mb-8">Extract event details from any source and convert to calendar files</p>

        {/* Tabs */}
        <div role="tablist" aria-label="Input types" className="flex gap-4 border-b border-gray-200 mb-6">
          {['text','document','image','audio','url'].map(t => (
            <button 
              key={t} 
              role="tab" 
              aria-selected={tab===t} 
              onClick={()=>setTab(t)} 
              disabled={loading}
              className={`py-3 px-2 -mb-px border-b-2 transition-colors duration-200 whitespace-nowrap ${
                tab===t 
                  ? 'border-brand text-gray-900 font-semibold' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t[0].toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>

      {/* Timezone selector */}
      <div className="mb-4 flex items-center">
        <label htmlFor="tz" className="text-sm text-gray-600 mr-2">Timezone:</label>
        {typeof Intl.supportedValuesOf === 'function' ? (
          <select id="tz" value={tz} onChange={e=>setTz(e.target.value)} className="input-field text-sm max-w-xs">
            {Intl.supportedValuesOf('timeZone').map(z => (<option key={z} value={z}>{z}</option>))}
          </select>
        ) : (
          <input id="tz" value={tz} onChange={e=>setTz(e.target.value)} className="input-field text-sm max-w-xs" />
        )}
      </div>

      {tab==='text' && (
        <section className="mt-4">
          <textarea 
            rows={6} 
            className="input-field mb-4" 
            value={text} 
            onChange={e=>setText(e.target.value)} 
            placeholder="Paste or type event information here..." 
            disabled={loading}
          />
          <div className="flex items-center gap-3 justify-center">
            <button className="btn-primary" disabled={loading || !text.trim()} onClick={processText}>Extract Events</button>
            {loading && <span className="text-gray-600 text-sm" aria-live="polite">⏳ {status || 'Processing…'}</span>}
          </div>
        </section>
      )}

      {(tab==='document' || tab==='image') && (
        <section className="mt-4">
          <div onDragOver={e=>e.preventDefault()} onDrop={handleDrop} className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 mb-4">
            <div className="mb-4">
              <input 
                id={`file-${tab}`}
                type="file" 
                accept={acceptByTab[tab]} 
                onChange={e=>setFile(e.target.files?.[0]||null)} 
                className="hidden"
                disabled={loading}
              />
              <label htmlFor={`file-${tab}`} className="btn-primary cursor-pointer inline-block">
                Choose File
              </label>
            </div>
            
            <div className="text-xs text-gray-500 mb-3">
              Supported formats: {tab==='document' ? 'PDF, DOC, DOCX, TXT, RTF' : 'PNG, JPG, JPEG, WebP, HEIF'} · Max 25 MB
            </div>
            
            {file ? (
              <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm">
                <div className="font-medium text-gray-900">{file.name}</div>
                <div className="text-gray-500 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB</div>
              </div>
            ) : (
              <div className="text-sm text-gray-400">No file selected</div>
            )}
          </div>
          
          <div className="flex items-center gap-3 justify-center">
            <button className="btn-primary" disabled={loading || !file} onClick={processFile}>Extract Events</button>
            {loading && <span className="text-gray-600 text-sm" aria-live="polite">⏳ {status || 'Processing…'}</span>}
          </div>
        </section>
      )}

      {tab==='audio' && (
        <section className="mt-4">
          <AudioRecorder disabled={loading} onReady={(audioFile) => setFile(audioFile)} />
          {file && (
            <div className="flex items-center gap-3 justify-center mt-4">
              <button className="btn-primary" disabled={loading || !file} onClick={processFile}>Extract Events</button>
              {loading && <span className="text-gray-600 text-sm" aria-live="polite">⏳ {status || 'Processing…'}</span>}
            </div>
          )}
        </section>
      )}

      {tab==='url' && (
        <section className="mt-4">
          <input 
            type="url" 
            className="input-field mb-4" 
            placeholder="https://example.com/event-page" 
            value={url} 
            onChange={e=>setUrl(e.target.value)} 
            disabled={loading}
          />
          <div className="flex items-center gap-3 justify-center">
            <button className="btn-primary" disabled={loading || !url.trim()} onClick={processUrl}>Extract Events</button>
            {loading && <span className="text-gray-600 text-sm" aria-live="polite">⏳ {status || 'Processing…'}</span>}
          </div>
        </section>
      )}

      {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg mt-4">{error}</div>}

      {events.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Extracted Events</h2>
            <div className="flex items-center gap-3">
              <label className="flex items-center text-gray-700">
                <input type="checkbox" checked={selected.size===events.length} onChange={e=>setAllSelected(e.target.checked)} className="mr-2" /> Select all
              </label>
              <button className="btn-secondary" onClick={()=>{ downloadSelected(); logEvent('download_selected_ics', { event_count: selected.size }) }} disabled={selected.size===0}>Download Selected (.ics)</button>
              <button className="btn-primary" onClick={()=>downloadICS(events,'events.ics')} disabled={events.length===0}>Download All Events (.ics)</button>
            </div>
          </div>
          <EventCards
            events={events}
            selected={selected}
            onToggle={toggleSelected}
            onDownload={(ev)=>downloadICS([ev], `${(ev.title||'event').slice(0,50)}.ics`)}
          />
        </section>
      )}
      </div>
      
      <div className="text-center text-gray-500 text-xs mt-8 px-6">
        We send your input to <a href="https://deepmind.google/technologies/gemini/" target="_blank" rel="noopener" className="text-brand underline hover:no-underline">Google Gemini</a> for analysis. Uploaded files are transmitted to Gemini and are deleted after processing.
      </div>
      
      <div className="text-center text-gray-500 text-xs mt-4 mb-8">
        Created by <a href="https://tharunpoduru.com" target="_blank" rel="noopener" className="text-brand underline hover:no-underline">Tharun Poduru</a>. Powered by <a href="https://deepmind.google/technologies/gemini/" target="_blank" rel="noopener" className="text-brand underline hover:no-underline">Google Gemini</a>.
      </div>
    </>
  )
}
