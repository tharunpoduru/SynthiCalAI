import React from 'react';
import '../styles/EventCard.css';
import { trackEvent } from '../firebase.js';
import { atcb_action } from 'add-to-calendar-button';

const EventCard = ({ event }) => {
  // Enhanced date formatter with better timezone handling
  const formatDateTime = (isoDateTimeStr) => {
    if (!isoDateTimeStr || isoDateTimeStr === 'N/A') return 'N/A';
    try {
      const date = new Date(isoDateTimeStr);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        year: 'numeric', hour: 'numeric', minute: 'numeric',
        hour12: true
      });
    } catch (e) {
      return 'N/A';
    }
  };
  
  const extractSpeakerInfo = () => {
    if (!event.description) return "";
    const speakerPatterns = [
      /speaker:\s*([^\n]+)/i,
      /presenter:\s*([^\n]+)/i,
      /host:\s*([^\n]+)/i,
      /featuring:\s*([^\n]+)/i,
      /with\s+([\w\s.]+)/i
    ];
    
    for (const pattern of speakerPatterns) {
      const match = event.description.match(pattern);
      if (match && match[1].trim()) {
        return match[1].trim();
      }
    }
    return "";
  };

  const processedEvent = {
    title: event.title || "",
    description: event.description || "",
    location: event.location || "",
    formattedStart: formatDateTime(event.start_datetime),
    formattedEnd: event.end_datetime ? formatDateTime(event.end_datetime) :
                 (event.duration ? `Duration: ${event.duration}` : 'N/A'),
    speakerInfo: extractSpeakerInfo()
  };

  // Format description for better compatibility with add-to-calendar-button
  const formatDescriptionForCalendar = (description) => {
    if (!description) return { pseudoHtml: '' };
    
    // ULTRA-SIMPLIFIED VERSION FOR MAXIMUM CALENDAR COMPATIBILITY
    // Strip complex formatting and use only [br] tags for line breaks
    // AVOID DOUBLE LINE BREAKS - they cause ICS file formatting issues
    
    // Extract all text content from various tags and format as plain text
    let plainText = '';
    
    // Extract headings and their associated content
    const headingMatches = description.match(/\[h2\]([^\[]+)\[\/h2\]/g) || [];
    const contentBlocks = description.split(/\[h2\][^\[]+\[\/h2\]/);
    
    // Skip first empty block before first heading
    for (let i = 0; i < headingMatches.length; i++) {
      // Add heading with separator line underneath (like an underline)
      const heading = headingMatches[i].replace(/\[h2\](.*?)\[\/h2\]/, '$1').trim();
      plainText += heading.toUpperCase() + '[br]---------------[br]';
      
      // Get corresponding content block (offset by 1 because split creates an empty entry before first match)
      if (contentBlocks[i+1]) {
        const content = contentBlocks[i+1];
        
        // Extract paragraphs
        const paragraphs = content.match(/\[p\]([^\[]+)\[\/p\]/g) || [];
        paragraphs.forEach(p => {
          const text = p.replace(/\[p\](.*?)\[\/p\]/, '$1').trim();
          if (text) plainText += text + '[br]';
        });
        
        // Extract list items
        const listItems = content.match(/\[li\]([^\[]+)\[\/li\]/g) || [];
        listItems.forEach(li => {
          const text = li.replace(/\[li\](.*?)\[\/li\]/, '• $1').trim();
          if (text) plainText += text + '[br]';
        });
        
        // Add a break between sections, but not after the last section
        if (i < headingMatches.length - 1) {
          plainText += '[br]';
        }
      }
    }
    
    // Handle links in simplest format
    plainText = plainText
      .replace(/\[url\](https?:\/\/[^|]+)\|([^\[]+)\[\/url\]/g, '$2: $1')
      .replace(/\[url\](https?:\/\/[^\[]+)\[\/url\]/g, '$1');
    
    // Special case: If no structured content was found, use basic text extraction
    if (!plainText && description) {
      plainText = description
        .replace(/\[h2\]/g, '')
        .replace(/\[\/h2\]/g, '[br]---------------[br]')
        .replace(/\[p\]/g, '')
        .replace(/\[\/p\]/g, '[br]')
        .replace(/\[li\]/g, '• ')
        .replace(/\[\/li\]/g, '[br]')
        .replace(/\[ul\]/g, '')
        .replace(/\[\/ul\]/g, '')
        .trim();
    }
    
    console.log("Formatted calendar description:", plainText);
    
    return {
      pseudoHtml: plainText
    };
  };

  // This function ensures all dates are correctly formatted for calendar compatibility
  const formatCalendarDate = (isoString) => {
    if (!isoString) return '';
    
    // Create a Date object from the ISO string
    const date = new Date(isoString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return '';
    
    // For add-to-calendar-button, we need to use YYYY-MM-DD format for the date
    // and HH:MM format for the time (24-hour format)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}`
    };
  };

  // Extract URL from description if available
  const extractEventUrl = (description) => {
    if (!description) return '';
    
    // Look for URLs in registration info section or anywhere in the description
    const urlMatch = description.match(/\bhttps?:\/\/\S+/gi);
    if (urlMatch && urlMatch.length > 0) {
      // Return first URL, cleaning up any markdown formatting
      return urlMatch[0].replace(/[\)\]]/g, '');
    }
    
    return '';
  };

  const handleAddToCalendar = () => {
    // Track calendar button click
    trackEvent('calendar_button_click', {
      event_title: event.title || 'untitled',
      has_location: !!event.location
    });
    
    // Format dates properly for the calendar button
    const startDate = event.start_datetime ? new Date(event.start_datetime) : new Date();
    const endDate = event.end_datetime ? new Date(event.end_datetime) : new Date(startDate.getTime() + 3600000);
    
    const start = formatCalendarDate(startDate.toISOString());
    const end = formatCalendarDate(endDate.toISOString());
    
    // Extract the formatted description
    const formattedDesc = formatDescriptionForCalendar(event.description);
    
    // Extract URL if present
    const eventUrl = extractEventUrl(event.description);
    
    // Configure the calendar button
    const config = {
      name: event.title || 'Untitled Event',
      description: formattedDesc.pseudoHtml, // Use the formatted description
      location: event.location || '',
      startDate: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time,
      options: ['Google', 'Apple', 'Outlook.com', 'iCal'],
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      listStyle: 'dropdown',
      trigger: 'click',
      iCalFileName: `SynthiCalAI - ${event.title || 'Event'}`,
      buttonStyle: 'date'
    };
    
    // Add URL if found
    if (eventUrl) {
      config.url = eventUrl;
    }
    
    // Initialize the calendar button
    atcb_action(config);
  };

  const renderPseudoHtml = (description) => {
    if (!description) return null;
    
    // Convert pseudo HTML tags to actual HTML
    let html = description;
    
    // Headers
    html = html.replace(/\[h2\]([^\[]+)\[\/h2\]/g, '<h2>$1</h2>');
    
    // Paragraphs and line breaks
    html = html.replace(/\[p\]([^\[]+)\[\/p\]/g, '<p>$1</p>');
    html = html.replace(/\[br\]/g, '<br/>');
    
    // Lists
    html = html.replace(/\[ul\]/g, '<ul>');
    html = html.replace(/\[\/ul\]/g, '</ul>');
    html = html.replace(/\[li\]([^\[]+)\[\/li\]/g, '<li>$1</li>');
    
    // Links
    html = html.replace(/\[url\](https?:\/\/[^|]+)\|([^\[]+)\[\/url\]/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>');
    html = html.replace(/\[url\](https?:\/\/[^\[]+)\[\/url\]/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="event-card">
      <h2 className="event-title">{processedEvent.title}</h2>
      
      <div className="event-metadata">
        <div className="event-details">
          <div className="detail-row">
            <span className="detail-label">Start:</span>
            <span className="detail-value">{processedEvent.formattedStart}</span>
          </div>
          
          <div className="detail-row">
            <span className="detail-label">End:</span>
            <span className="detail-value">{processedEvent.formattedEnd}</span>
          </div>
          
          {processedEvent.location && (
            <div className="detail-row">
              <span className="detail-label">Location:</span>
              <span className="detail-value">{processedEvent.location}</span>
            </div>
          )}
          
          {processedEvent.speakerInfo && (
            <div className="detail-row">
              <span className="detail-label">Speaker:</span>
              <span className="detail-value">{processedEvent.speakerInfo}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="event-description">
        <div className="markdown-content">
          {renderPseudoHtml(processedEvent.description)}
        </div>
      </div>
      
      <div className="calendar-actions">
        <button className="calendar-button" onClick={handleAddToCalendar}>
          Add to Calendar
        </button>
      </div>
    </div>
  );
};

export default EventCard;
