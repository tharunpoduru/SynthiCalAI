import React from 'react'
import { atcb_action } from 'add-to-calendar-button'

function toParts(isoString) {
  if (!isoString) return { date: '', time: '' }
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return { date: '', time: '' }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return { date: `${y}-${m}-${da}`, time: `${h}:${min}` }
}

export default function AddToCalendar({ event }) {
  const handleClick = () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const start = toParts(event.start_datetime)
    const end = toParts(event.end_datetime)
    atcb_action({
      name: event.title || 'Event',
      description: String(event.description || '').replace(/\[br\]/g, '\n'),
      location: event.location || '',
      startDate: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time,
      timeZone: tz,
      options: ['Google', 'Apple', 'Outlook.com', 'iCal'],
      iCalFileName: `SynthiCalAI - ${event.title || 'Event'}`,
      listStyle: 'dropdown',
      trigger: 'click'
    })
  }
  return (
    <button 
      className="w-10 h-10 bg-brand hover:bg-[#a00e28] text-white rounded-full flex items-center justify-center transition-colors duration-200 flex-shrink-0" 
      onClick={handleClick}
      title="Add to Calendar"
    >
      <svg 
        className="w-5 h-5" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M12 11v6m3-3H9"
        />
      </svg>
    </button>
  )
}


