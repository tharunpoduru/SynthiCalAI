const logger = require("firebase-functions/logger");
const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");
const { processText } = require("../utils/gemini");

/**
 * Process a URL to extract event information (single or multiple events)
 * @param {string} url - URL to process
 * @param {string} userTimeZone - Optional user timezone
 * @returns {Promise<object|array>} - Extracted event information (single event or array of events)
 */
async function processUrl(url, userTimeZone) {
  try {
    // Basic validation
    if (!url) {
      return createBasicEvent("Unknown Event", "No URL provided", url);
    }

    // Validate URL format
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      return createBasicEvent("Unknown Event", "Invalid URL format: " + url, url);
    }

    // Log initial processing details
    logger.info("Processing URL with details:", {
      url: url,
      userTimeZone: userTimeZone,
      hostname: parsedUrl.hostname
    });

    // Add more verbose debugging to track the flow
    logger.info("Starting extraction from web page");
    
    // Check for sites that typically block scrapers
    const blockedDomains = ['facebook.com', 'instagram.com', 'twitter.com', 'linkedin.com'];
    const isLikelyBlocked = blockedDomains.some(domain => parsedUrl.hostname.includes(domain));
    
    if (isLikelyBlocked) {
      logger.warn("URL is from a domain known to block scrapers:", parsedUrl.hostname);
      return createBasicEvent(
        `Event from ${parsedUrl.hostname}`,
        `Unable to extract details from this website automatically as it restricts access. Please copy and paste the event details as text instead.`,
        url
      );
    }
    
    // Extract data from the webpage with proper error handling
    let extractedData;
    try {
      extractedData = await extractWebPageData(url);
      logger.info("Web page extraction completed", {
        hasStructuredEvents: extractedData.structuredEvents?.length > 0,
        hasTitle: !!extractedData.title,
        textContentLength: extractedData.textContent?.length || 0
      });
    } catch (error) {
      logger.error("Error extracting web page data:", error);
      return createBasicEvent(
        `Event from ${parsedUrl.hostname}`,
        `Error extracting content from URL: ${error.message}`,
        url
      );
    }

    try {
      // Extract data from the webpage using a focused approach
      let pageData = await extractWebPageData(url);
      
      // Check for event-focused domains to set appropriate expectations
      const isEventSite = isEventListingDomain(parsedUrl.hostname);
      
      // Log summary of what we found
      logger.info("Extracted web page data:", {
        title: pageData.title,
        hasStructuredEvents: pageData.structuredEvents.length > 0,
        timeZone: pageData.timeZone || userTimeZone || 'unknown'
      });

      // APPROACH 1: Structured Data (JSON-LD) - Most reliable
      if (pageData.structuredEvents.length > 0) {
        logger.info(`Found ${pageData.structuredEvents.length} structured events`);
        
        if (pageData.structuredEvents.length === 1) {
          // Single structured event - process directly
          const structuredEvent = pageData.structuredEvents[0];
          
          // Create context with structured data and other info we found
          const context = {
            original_text: `
PAGE TITLE: ${pageData.title}
TIMEZONE: ${pageData.timeZone || userTimeZone || 'Unknown'}
URL: ${url}
STRUCTURED EVENT DATA: 
${JSON.stringify(structuredEvent, null, 2)}

DATES DETECTED ON PAGE:
${pageData.dates.join('\n')}

ADDITIONAL PAGE CONTENT:
${pageData.textContent.substring(0, 1000)}
            `,
            original_link: url,
            hasStructuredData: true,
            metadata: structuredEvent
          };
          
          if (pageData.timeZone || userTimeZone) {
            context.timeZone = pageData.timeZone || userTimeZone;
          }
          
          // Let Gemini process the structured data
          const extractedEvent = await processText(context);
          return Array.isArray(extractedEvent) ? extractedEvent.map(e => ({...e, original_link: url})) : {...extractedEvent, original_link: url};
        } else {
          // Multiple structured events - process each and return array
          const events = [];
          
          for (const structuredEvent of pageData.structuredEvents) {
            const context = {
              original_text: `
PAGE TITLE: ${pageData.title}
TIMEZONE: ${pageData.timeZone || userTimeZone || 'Unknown'}
URL: ${url}
STRUCTURED EVENT DATA: 
${JSON.stringify(structuredEvent, null, 2)}

DATES DETECTED ON PAGE:
${pageData.dates.join('\n')}
              `,
              original_link: url,
              hasStructuredData: true,
              metadata: structuredEvent,
              isPartOfMultipleEvents: true
            };
            
            if (pageData.timeZone || userTimeZone) {
              context.timeZone = pageData.timeZone || userTimeZone;
            }
            
            try {
              const eventResult = await processText(context);
              if (Array.isArray(eventResult)) {
                events.push(...eventResult.map(e => ({...e, original_link: url})));
              } else {
                events.push({...eventResult, original_link: url});
              }
            } catch (eventError) {
              logger.warn(`Error processing structured event:`, eventError);
            }
          }
          
          return events.length > 0 ? events : createBasicEvent(pageData.title, "Could not extract event details", url);
        }
      }
      
      // APPROACH 2: Single event with date signals in the page
      if (pageData.dates.length > 0 && !isEventSite) {
        logger.info(`Found ${pageData.dates.length} date signals, treating as single event`);
        
        // Create context with all the date signals and page content
        const context = {
          original_text: `
PAGE TITLE: ${pageData.title}
TIMEZONE: ${pageData.timeZone || userTimeZone || 'Unknown'}
URL: ${url}

IMPORTANT - EXACT DATES DETECTED:
${pageData.dates.map(date => `- ${date}`).join('\n')}

PAGE CONTENT:
${pageData.textContent.substring(0, 1500)}
          `,
          original_link: url,
          metadata: pageData.metadata || {}
        };
        
        if (pageData.timeZone || userTimeZone) {
          context.timeZone = pageData.timeZone || userTimeZone;
        }
        
        // Let Gemini extract the information
        const extractedEvent = await processText(context);
        return Array.isArray(extractedEvent) ? extractedEvent.map(e => ({...e, original_link: url})) : {...extractedEvent, original_link: url};
      }
      
      // APPROACH 3: Event listing sites - multiple potential events 
      if (isEventSite) {
        logger.info(`Processing URL as an event site (${parsedUrl.hostname})`);
        
        // Create context that prompts Gemini to look for multiple events
        const context = {
          original_text: `
IMPORTANT: This page is from ${parsedUrl.hostname} which is likely an EVENT SITE containing MULTIPLE EVENTS. Please carefully analyze and extract ALL events from this page.

PAGE TITLE: ${pageData.title}
TIMEZONE: ${pageData.timeZone || userTimeZone || 'Unknown'}
URL: ${url}

IMPORTANT - EXACT DATES DETECTED:
${pageData.dates.length > 0 ? pageData.dates.map(date => `- ${date}`).join('\n') : 'No specific dates detected automatically. Please extract dates from the content below.'}

PAGE CONTENT:
${pageData.textContent.substring(0, 2000)}
          `,
          original_link: url,
          isPartOfMultipleEvents: true,
          metadata: pageData.metadata || {}
        };
        
        if (pageData.timeZone || userTimeZone) {
          context.timeZone = pageData.timeZone || userTimeZone;
        }
        
        // Let Gemini extract the information
        const extractedEvents = await processText(context);
        return Array.isArray(extractedEvents) ? extractedEvents.map(e => ({...e, original_link: url})) : {...extractedEvents, original_link: url};
      }
      
      // APPROACH 4: Default fallback - treat as general content
      logger.info(`No specific event patterns detected, using general extraction`);
      
      // Create general context with page content
      const context = {
        original_text: `
PAGE TITLE: ${pageData.title}
TIMEZONE: ${pageData.timeZone || userTimeZone || 'Unknown'}
URL: ${url}

IMPORTANT - EXACT DATES DETECTED:
${pageData.dates.length > 0 ? pageData.dates.map(date => `- ${date}`).join('\n') : 'No specific dates detected automatically. Please extract dates from the content below.'}

PAGE CONTENT:
${pageData.textContent.substring(0, 2000)}
        `,
        original_link: url,
        metadata: pageData.metadata || {}
      };
      
      if (pageData.timeZone || userTimeZone) {
        context.timeZone = pageData.timeZone || userTimeZone;
      }
      
      // Let Gemini extract the information
      const extractedEvent = await processText(context);
      return Array.isArray(extractedEvent) ? extractedEvent.map(e => ({...e, original_link: url})) : {...extractedEvent, original_link: url};
      
    } catch (extractionError) {
      logger.error("Error extracting web page data:", extractionError);
      return createBasicEvent(
        parsedUrl.hostname + " Event", 
        `Error extracting content from URL: ${extractionError.message}`,
        url
      );
    }
  } catch (error) {
    logger.error("Error processing URL:", error);
    return createBasicEvent(
      "Error Processing URL", 
      `Error processing URL: ${error.message}`,
      url
    );
  }
}

/**
 * Create a basic event object as a fallback
 * @param {string} title - Event title
 * @param {string} description - Event description
 * @param {string} url - Original URL
 * @returns {object} - Basic event object
 */
function createBasicEvent(title, description, url) {
  return {
    title: title || "Unknown Event",
    start_datetime: new Date().toISOString(),
    end_datetime: new Date(Date.now() + 3600000).toISOString(),
    location: "Unknown",
    description: description || "No description provided",
    original_link: url
  };
}

/**
 * Check if domain is a known event listing site 
 * @param {string} hostname - Domain hostname
 * @returns {boolean} - True if domain is a known event listing site
 */
function isEventListingDomain(hostname) {
  const eventDomains = [
    'lu.ma', 'luma.com', 'eventbrite.com', 'meetup.com', 'facebook.com/events',
    'evite.com', 'ticketmaster.com', 'splashthat.com', 'hopin.com', 'airmeet.com',
    'airtable.com', 'universe.com', 'dice.fm', 'tito.io', 'eventscase.com',
    'event.is', 'event.com', 'events.', '.events.', 'conf', 'conference',
    'summit', 'meetup', 'webinar', 'agenda'
  ];
  
  return eventDomains.some(domain => hostname.includes(domain));
}

/**
 * Extract focused data from a web page, prioritizing structured data
 * @param {string} url - URL to process
 * @returns {Promise<object>} - Extracted page data
 */
async function extractWebPageData(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://www.google.com/",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1"
      }
    });
    
    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;
    
    // Remove script and style elements to clean up text extraction
    const scripts = document.querySelectorAll("script, style");
    scripts.forEach(script => script.remove());
    
    // Initialize results object with focused data
    const results = {
      title: document.title || "",
      dates: [],
      timeZone: "",
      metadata: {},
      structuredEvents: [], // Structured events from JSON-LD
      textContent: ""       // Main text content
    };
    
    // Extract meta tags for metadata
    const metaTags = document.querySelectorAll('meta');
    metaTags.forEach(meta => {
      const name = meta.getAttribute('name') || meta.getAttribute('property');
      const content = meta.getAttribute('content');
      if (name && content) {
        results.metadata[name] = content;
      }
    });
    
    // Try to detect timezone information
    results.timeZone = detectTimeZone(document, html);
    
    // PRIORITY 1: Extract JSON-LD structured data (most reliable for events)
    const jsonldScripts = document.querySelectorAll('script[type="application/ld+json"]');
    jsonldScripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        
        // Process Event type
        if (data['@type'] === 'Event') {
          results.structuredEvents.push(data);
          
          // Extract date information
          if (data.startDate) results.dates.push(data.startDate);
          if (data.endDate) results.dates.push(data.endDate);
        }
        
        // Process arrays of events
        if (Array.isArray(data)) {
          data.forEach(item => {
            if (item['@type'] === 'Event') {
              results.structuredEvents.push(item);
              
              // Extract date information
              if (item.startDate) results.dates.push(item.startDate);
              if (item.endDate) results.dates.push(item.endDate);
            }
          });
        }
      } catch (e) {
        logger.warn('Error parsing JSON-LD:', e);
      }
    });
    
    // Extract datetime values from time elements
    const timeElements = document.querySelectorAll('time');
    timeElements.forEach(time => {
      const datetime = time.getAttribute('datetime');
      if (datetime) {
        results.dates.push(datetime);
      }
    });
    
    // Extract datetime from other elements
    const elementsWithDatetime = document.querySelectorAll('[datetime]');
    elementsWithDatetime.forEach(el => {
      const datetime = el.getAttribute('datetime');
      if (datetime) {
        results.dates.push(datetime);
      }
    });
    
    // Look for date patterns in text
    extractDatePatterns(document, results);
    
    // Extract text from main content areas
    const contentSelectors = [
      "main", "article", ".content", "#content", ".main-content", 
      ".post-content", ".entry-content", "[role='main']"
    ];
    
    // Try to find the main content area
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        results.textContent = element.textContent
          .trim()
          .replace(/\s+/g, " ")
          .substring(0, 5000); // Limit text size
          
        if (results.textContent.length > 100) {
          break;
        }
      }
    }
    
    // If no specific content area found, use the body
    if (!results.textContent || results.textContent.length < 100) {
      results.textContent = document.body.textContent
        .trim()
        .replace(/\s+/g, " ")
        .substring(0, 5000); // Limit text size
    }
    
    return results;
  } catch (error) {
    logger.error("Error in extractWebPageData:", error);
    throw error;
  }
}

/**
 * Extract date patterns from text content
 * @param {Document} document - DOM document
 * @param {Object} results - Results object to update
 */
function extractDatePatterns(document, results) {
  // Common date patterns
  const datePatterns = [
    // ISO format
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?/g,
    // Date only ISO
    /\d{4}-\d{2}-\d{2}/g,
    // US format with 4-digit year
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,
    // Month names
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}(?:st|nd|rd|th)?,? \d{4}\b/gi,
    // Month names with time
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}(?:st|nd|rd|th)?,? \d{4} at \d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?\b/gi,
  ];
  
  // Extract text from the body
  const text = document.body.textContent;
  
  // Check each pattern
  for (const pattern of datePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      results.dates.push(...matches);
    }
  }
  
  // Deduplicate dates
  results.dates = [...new Set(results.dates)];
}

/**
 * Try to detect timezone information from a web page
 * @param {Document} document - DOM document object
 * @param {string} html - Raw HTML content
 * @returns {string} - Detected timezone or empty string if none found
 */
function detectTimeZone(document, html) {
  // Common timezone patterns
  const timezonePatterns = [
    /\b(UTC|GMT)([+-]\d{1,2}(?::\d{2})?)?/g,
    /\b(PDT|PST|EDT|EST|CDT|CST|MDT|MST|CEST|CET|BST|IST|JST|AEST)\b/g,
    /\bTimezone:\s*([A-Za-z\/]+)/i,
    /\bTime Zone:\s*([A-Za-z\/]+)/i,
    /\bTimeZone:\s*([A-Za-z\/]+)/i,
    /\bTime zone:\s*([A-Za-z\/]+)/i
  ];
  
  // Try to extract from meta tags first
  const metaTimezone = document.querySelector('meta[name="timezone"]') || 
                      document.querySelector('meta[property="timezone"]');
  if (metaTimezone && metaTimezone.getAttribute('content')) {
    return metaTimezone.getAttribute('content');
  }
  
  // Look for timezone information in the HTML
  for (const pattern of timezonePatterns) {
    const matches = html.match(pattern);
    if (matches && matches.length > 0) {
      return matches[0];
    }
  }
  
  return "";
}

module.exports = { processUrl };
