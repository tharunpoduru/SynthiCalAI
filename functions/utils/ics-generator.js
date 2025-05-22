const { createEvents } = require('ics');
const logger = require("firebase-functions/logger");

// Format description for Apple Calendar compatibility
function formatDescription(description) {
  if (!description) return "";
  
  // Replace [br] tags with actual newlines
  let formatted = description.replace(/\[br\]/g, '\n');
  
  // Clean up multiple consecutive newlines to avoid excessive spacing
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  
  return formatted;
}

function generateICS(events) {
  try {
    // Log incoming data to debug
    logger.info("Generating ICS for events:", JSON.stringify(events));

    const icsEvents = events.map((event) => {
      try {
        logger.info("Processing event for ICS:", JSON.stringify(event));
        
        // Check for original_date first (which would contain the unmodified date strings)
        let originalDate = event.original_date || {};
        
        // If original_date is a string (possible in serialization), try to parse it
        if (typeof originalDate === 'string') {
          try {
            originalDate = JSON.parse(originalDate);
          } catch (e) {
            logger.warn("Failed to parse original_date string:", originalDate);
            originalDate = {};
          }
        }
        
        let startDateString = originalDate.start_datetime || event.start_datetime;
        let endDateString = originalDate.end_datetime || event.end_datetime;
        
        logger.info("Processing dates:", { startDateString, endDateString });

        // Parse dates more robustly
        let start = [];
        let end = [];
        
        if (startDateString) {
          try {
            const startDate = new Date(startDateString);
            if (!isNaN(startDate.getTime())) {
              start = [
                startDate.getUTCFullYear(),
                startDate.getUTCMonth() + 1, // Month is 0-indexed in JS
                startDate.getUTCDate(),
                startDate.getUTCHours(),
                startDate.getUTCMinutes()
              ];
              logger.info("Parsed start date:", start);
            } else {
              logger.warn("Invalid start date:", startDateString);
            }
          } catch (e) {
            logger.error("Error parsing start date:", e, startDateString);
          }
        }
        
        if (endDateString) {
          try {
            const endDate = new Date(endDateString);
            if (!isNaN(endDate.getTime())) {
              end = [
                endDate.getUTCFullYear(),
                endDate.getUTCMonth() + 1, // Month is 0-indexed in JS
                endDate.getUTCDate(),
                endDate.getUTCHours(),
                endDate.getUTCMinutes()
              ];
              logger.info("Parsed end date:", end);
            } else {
              logger.warn("Invalid end date:", endDateString);
            }
          } catch (e) {
            logger.error("Error parsing end date:", e, endDateString);
          }
        }
        
        // If no end time, default to 1 hour after start
        if (start.length === 5 && end.length === 0) {
          const startDate = new Date(Date.UTC(start[0], start[1] - 1, start[2], start[3], start[4]));
          const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Add 1 hour
          end = [
            endDate.getUTCFullYear(),
            endDate.getUTCMonth() + 1,
            endDate.getUTCDate(),
            endDate.getUTCHours(),
            endDate.getUTCMinutes()
          ];
        }

        // If we don't have valid dates, create default dates (today, 1 hour duration)
        if (start.length === 0) {
          logger.warn("No valid start date, using default");
          const now = new Date();
          start = [
            now.getUTCFullYear(),
            now.getUTCMonth() + 1,
            now.getUTCDate(),
            now.getUTCHours(),
            now.getUTCMinutes()
          ];
          
          const endDate = new Date(now.getTime() + 60 * 60 * 1000); // Add 1 hour
          end = [
            endDate.getUTCFullYear(),
            endDate.getUTCMonth() + 1,
            endDate.getUTCDate(),
            endDate.getUTCHours(),
            endDate.getUTCMinutes()
          ];
        }

        const icsEvent = {
          title: event.title || "Untitled Event",
          start: start,
          end: end,
          location: event.location || "",
          description: formatDescription(event.description || ""),
          url: event.original_link || ""
        };
        
        logger.info("Created ICS event:", JSON.stringify(icsEvent));
        return icsEvent;
      } catch (e) {
        logger.error("Error processing event for ICS:", e, event);
        // Return a minimal valid event as fallback
        const now = new Date();
        const later = new Date(now.getTime() + 60 * 60 * 1000);
        return {
          title: event.title || "Untitled Event",
          start: [
            now.getUTCFullYear(),
            now.getUTCMonth() + 1,
            now.getUTCDate(),
            now.getUTCHours(),
            now.getUTCMinutes()
          ],
          end: [
            later.getUTCFullYear(),
            later.getUTCMonth() + 1,
            later.getUTCDate(),
            later.getUTCHours(),
            later.getUTCMinutes()
          ],
          description: formatDescription(event.description) || "Error processing event details"
        };
      }
    });

    logger.info("All ICS events:", JSON.stringify(icsEvents));
    const result = createEvents(icsEvents);
    
    if (result.error) {
      logger.error('Error generating ICS:', result.error);
      // Since the ics library is failing, let's attempt to create a basic iCalendar manually
      // based on the first event's data
      try {
        const event = events[0];
        const startDate = new Date(event.original_date?.start_datetime || event.start_datetime);
        const endDate = new Date(event.original_date?.end_datetime || event.end_datetime);
        
        // Format dates in iCalendar format (YYYYMMDDTHHMMSSZ)
        const formatDateForICS = (date) => {
          if (isNaN(date.getTime())) {
            const now = new Date();
            date = now;
          }
          return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+/g, '');
        };
        
        const start = formatDateForICS(startDate);
        const end = formatDateForICS(endDate);
        const now = formatDateForICS(new Date());
        const uid = Math.random().toString(36).substring(2);
        
        const manualICS = `BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
PRODID:synthical/ics
METHOD:PUBLISH
X-PUBLISHED-TTL:PT1H
BEGIN:VEVENT
UID:${uid}
SUMMARY:${event.title || "Event"}
DTSTAMP:${now}
DTSTART:${start}
DTEND:${end}
LOCATION:${event.location || ""}
DESCRIPTION:${formatDescription((event.description || "").replace(/\n/g, '\\n'))}
URL:${event.original_link || ""}
END:VEVENT
END:VCALENDAR`;

        return manualICS;
      } catch (manualError) {
        logger.error('Error creating manual ICS:', manualError);
        // Absolute last resort - hardcoded fallback
        return "BEGIN:VCALENDAR\nVERSION:2.0\nCALSCALE:GREGORIAN\nPRODID:synthical/ics\nMETHOD:PUBLISH\nX-PUBLISHED-TTL:PT1H\nBEGIN:VEVENT\nUID:synthical-fallback@synthical.app\nSUMMARY:Calendar Event\nDTSTAMP:20250419T000000Z\nDTSTART:20250419T000000Z\nDTEND:20250419T010000Z\nDESCRIPTION:There was an issue generating the full event details.\nEND:VEVENT\nEND:VCALENDAR";
      }
    }

    return result.value;
  } catch (e) {
    logger.error("Critical error in generateICS:", e);
    try {
      // Try to create a very basic ICS with first event's data as emergency fallback
      const event = events[0];
      const title = event.title || "Event";
      const description = formatDescription((event.description || "").replace(/\n/g, '\\n'));
      
      return `BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
PRODID:synthical/ics
METHOD:PUBLISH
X-PUBLISHED-TTL:PT1H
BEGIN:VEVENT
UID:synthical-emergency-${Date.now()}
SUMMARY:${title}
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/g, '')}
DTSTART:${new Date(event.start_datetime || Date.now()).toISOString().replace(/[-:]/g, '').replace(/\.\d+/g, '')}
DTEND:${new Date(event.end_datetime || Date.now() + 3600000).toISOString().replace(/[-:]/g, '').replace(/\.\d+/g, '')}
DESCRIPTION:${description}
END:VEVENT
END:VCALENDAR`;
    } catch (emergencyError) {
      // Absolute last resort - hardcoded basic calendar event
      return "BEGIN:VCALENDAR\nVERSION:2.0\nCALSCALE:GREGORIAN\nPRODID:synthical/ics\nMETHOD:PUBLISH\nX-PUBLISHED-TTL:PT1H\nBEGIN:VEVENT\nUID:synthical-error@synthical.app\nSUMMARY:Calendar Event\nDTSTAMP:20250419T000000Z\nDTSTART:20250419T000000Z\nDTEND:20250419T010000Z\nDESCRIPTION:There was an issue generating the event.\nEND:VEVENT\nEND:VCALENDAR";
    }
  }
}

module.exports = { generateICS };