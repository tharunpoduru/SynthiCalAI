import React from 'react'
import AddToCalendar from './AddToCalendar.jsx'

function formatDate(dt) {
  try {
    const d = new Date(dt)
    return d.toLocaleString(undefined, {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short'
    })
  } catch { return dt }
}

export default function EventCards({ events = [], selected = new Set(), onToggle, onDownload }) {
  if (!events.length) return null
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6 items-stretch">
      {events.map((ev, i) => (
        <div 
          key={`ev-${i}`} 
          className={`bg-white border border-gray-200 rounded-lg shadow-md cursor-pointer transition-all duration-200 overflow-hidden flex flex-col h-full min-h-[400px] ${
            selected.has(i) 
              ? 'ring-2 ring-brand border-brand shadow-lg' 
              : 'hover:shadow-lg'
          }`}
          onClick={() => onToggle && onToggle(i)}
        >
          {/* Card Content - Scrollable */}
          <div className="p-4 pb-0 flex-1 overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-3 leading-tight">{ev.title || 'Untitled Event'}</h3>
            <hr className="border-gray-200 mb-3" />

            {/* Date & Time Section - No repetition */}
            <div className="mb-4">
              <h4 className="font-bold text-gray-900 mb-1 uppercase text-xs tracking-wide">Date & Time</h4>
              <p className="text-gray-700 text-sm">{formatDate(ev.start_datetime)} - {formatDate(ev.end_datetime)}</p>
            </div>

            {/* Location Section */}
            {ev.location && (
              <div className="mb-4">
                <h4 className="font-bold text-gray-900 mb-1 uppercase text-xs tracking-wide">Location</h4>
                <p className="text-gray-700 text-sm">{typeof ev.location === 'string' ? ev.location : 'Online'}</p>
              </div>
            )}

            {/* Event Overview Section */}
            {ev.description && (
              <div className="mb-4">
                <h4 className="font-bold text-gray-900 mb-1 uppercase text-xs tracking-wide">Event Overview</h4>
                <div className="text-gray-700 text-sm leading-relaxed mb-4" dangerouslySetInnerHTML={{ __html: (ev.description || '').replaceAll('[br]', '<br/>') }} />
              </div>
            )}
            
            {/* Source Link */}
            {ev.original_link && (
              <div className="text-center mb-4">
                <a href={ev.original_link} target="_blank" rel="noopener" className="text-brand hover:underline text-sm" onClick={e => e.stopPropagation()}>View Source</a>
              </div>
            )}
          </div>

          {/* Card Footer - Chin with Actions */}
          <div className="border-t border-gray-200 bg-gray-50 p-3">
            <div className="flex gap-2 items-center">
              <div onClick={e => e.stopPropagation()}>
                <AddToCalendar event={ev} />
              </div>
              {onDownload && (
                <button 
                  className="btn-secondary flex-1 text-sm whitespace-nowrap" 
                  onClick={(e) => {
                    e.stopPropagation()
                    onDownload(ev)
                  }}
                >
                  Download .ics
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}