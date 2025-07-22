import React, { useState } from 'react';
import InputSection from './components/InputSection';
import EventCardList from './components/EventCardList';
import './styles/App.css';
import { analytics, trackEvent } from './firebase.js';

function App() {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userTimeZone, setUserTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  const convertToUTC = (dateString) => {
    if(!dateString) return null;
    // Attempt to create a Date object from the string.
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return null;
    }
    
    // Convert the Date object to an ISO string in UTC.
    return date.toISOString();
  }

  const generateICS = async (data) => {
    try {
      // Track download attempt
      trackEvent('batch_download_started', {
        event_count: events.length
      });
      
      // Always use the batch endpoint for consistency
      const endpoint = '/api/generate-batch-ics';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Always send as an array of events, whether single or multiple
        body: JSON.stringify({ events: Array.isArray(data) ? data : [data] }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      // Name file based on the number of events
      const eventsArray = Array.isArray(data) ? data : [data];
      a.download = eventsArray.length > 1 ? 'SynthiCalAI - All Events.ics' : `SynthiCalAI - ${eventsArray[0].title || 'Event'}.ics`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      // Track successful download
      trackEvent('batch_download_completed', {
        event_count: eventsArray.length
      });
    } catch (err) {
      setError(`Error downloading events: ${err.message}`);
      
      // Track download error
      trackEvent('batch_download_error', {
        error_message: err.message
      });
    }
  }

  const handleProcessInput = async (inputData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      let endpoint;
      let requestBody;
      let headers = { 'Content-Type': 'application/json' };
      
      // Log analytics event for input type
      if (analytics) {
        trackEvent(analytics, 'process_input_started', {
          input_type: inputData.type
        });
      }
      
      switch(inputData.type) {
        case 'text':
          endpoint = '/api/process-text';
          requestBody = JSON.stringify({
            content: inputData.content,
            userTimeZone: inputData.userTimeZone
          });
          break;
          
        case 'file':
          console.log('Processing file:', inputData.fileName, inputData.fileType);
          
          if (inputData.fileType.startsWith('image/')) {
            endpoint = '/api/process-image';
            console.log('Sending to image processor');
            
            // For images, send as base64 JSON
            requestBody = JSON.stringify({
              imageData: inputData.fileData,
              imageType: inputData.fileType,
              fileName: inputData.fileName,
              userTimeZone: inputData.userTimeZone
            });
          } else {
            endpoint = '/api/process-document';
            console.log('Sending to document processor');
            
            // For documents, send as base64 JSON
            requestBody = JSON.stringify({
              fileData: inputData.fileData,
              fileType: inputData.fileType,
              fileName: inputData.fileName,
              userTimeZone: inputData.userTimeZone
            });
          }
          headers = { 'Content-Type': 'application/json' };
          break;
          
        case 'url':
          endpoint = '/api/process-url';
          requestBody = JSON.stringify({
            url: inputData.url,
            userTimeZone: inputData.userTimeZone
          });
          break;
          
        default:
          throw new Error('Invalid input type');
      }

      console.log('Making request to:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: requestBody
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('API response received:', data);
      
      if (Array.isArray(data)) {
        setEvents(data);
      } else {
        setEvents([data]);
      }
      
      // Log successful event extraction
      if (analytics) {
        trackEvent(analytics, 'events_extracted', {
          count: Array.isArray(data) ? data.length : 1,
          source_type: inputData.type
        });
      }
    } catch (error) {
      console.error('Error processing input:', error);
      setError(error.message);
      setEvents([]);
      
      // Log error event
      if (analytics) {
        trackEvent(analytics, 'extraction_error', {
          error_message: error.message,
          input_type: inputData.type
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadAll = async() => {
    if(events.length > 0){
      // Simply pass the entire events array to generateICS
      generateICS(events);
    } 
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>SynthiCal AI</h1>
        <p>Extract event details from any source and convert to calendar files</p>
      </header>
      
      <InputSection onSubmit={handleProcessInput} isLoading={isLoading} userTimeZone={userTimeZone} />
      
      {error && <div className="error-message">{error}</div>}
      
      {events.length > 0 && (
        <>
          <div className="events-header">
            <h2>Extracted Events</h2>
            {events.length > 1 && (
              <div className="events-count">
                {events.length} events found
              </div>
            )}
            <button 
              className="download-all-button"
              onClick={handleDownloadAll}
            >
              Download All Events (.ics)
            </button>
          </div>
          <EventCardList events={events} generateICS={generateICS}/>
        </>
      )}
      
      <footer className="app-footer">
        <p>Created by <a href="https://tharunpoduru.com" target="_blank" rel="noopener noreferrer">Tharun Poduru</a>. Powered by <a href="https://deepmind.google/technologies/gemini/" target="_blank" rel="noopener noreferrer">Google Gemini</a>.</p>
      </footer>
    </div>
  );
}

export default App;
