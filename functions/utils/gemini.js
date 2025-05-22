const functions = require("firebase-functions");
const logger = require("firebase-functions/logger");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { parseDate} = require("./date-parser");

// Initialize the Gemini API with the key from environment variables
// Note: Cloud Functions v2 uses environment variables instead of functions.config()
let genAI;
try {
  // Get API key from environment variables
  const key = process.env.GEMINI_API_KEY;
  
  if (!key) {
    logger.warn("Gemini API key not found in environment variables. Set it using Firebase Console or CLI.");
    // Fallback for development
    if (process.env.FUNCTIONS_EMULATOR) {
      logger.info("Using emulator API key");
    }
  }
  
  genAI = new GoogleGenerativeAI(key || "EMULATOR_API_KEY");
} catch (error) {
  logger.error("Error initializing Gemini API:", error);
}


/**
 * Process text content using Google Gemini to extract events
 * @param {object} event - Event object to analyze for events
 * @returns {Promise<Array|Object>} - Single event object or array of extracted events
 */ 
async function processText(event) {
  
  try {
    // Initialize Gemini model (2.0 Flash)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    // Check for multiple event indicator in the content
    const isMultipleEventsExpected = 
      (event.original_text && event.original_text.includes("MULTIPLE EVENTS")) || 
      (event.isPartOfMultipleEvents === true);
    
    // Determine if we have structured data that might help Gemini
    const hasStructuredData = event.hasStructuredData || 
                             (event.metadata && Object.keys(event.metadata).length > 0);
    
    // Updated prompt with calendar-compatible formatting using add-to-calendar pseudo HTML tags
    const promptText = `You are an expert event data extraction assistant. You receive event details that may have missing or malformed fields.
        Your task is to extract and format complete, accurate event information optimized for calendar applications.
        You will be given an original_text or original_link to use to complete the extraction.
        Your goal is to create a complete, well-formatted event with reliable times, dates, and descriptions.
        Examine the original content carefully, focusing on:
        - Dates and times (be precise with years, months, days, hours)
        - Event title
        - Location (physical or virtual)
        - Description and other metadata

        You will output ONLY a single well-formatted JSON object in this format:

        {
          "title": "<Event Title>", // (string) The title of the event.
          "start_datetime": "<ISO 8601 UTC>", // (string) The start date and time of the event in ISO 8601 format with UTC timezone (e.g., '2024-01-15T09:00:00Z').
          "end_datetime": "<ISO 8601 UTC>", // (string) The end date and time of the event in ISO 8601 format with UTC timezone, if no end time is provided, add 1 hour to the start_datetime.
          "location": "<Event Location>", // (string) The location of the event. Can be a physical address or an online meeting link.
          "description": "<Event Description>", // (string) A description of the event using minimal formatting with [br] tags for line breaks.
        }

        Use minimal formatting for the description with only [br] tags for line breaks. Structure the description as follows:
        
        EVENT OVERVIEW[br]
        Brief summary of the event's purpose and key topics[br][br]
        
        DATE & TIME[br]
        Start Date/Time - End Date/Time (include timezone)[br][br]
        
        LOCATION[br]
        Physical Address or Online Meeting Link[br][br]
        
        TYPE[br]
        Conference, Workshop, Webinar, Social, etc.[br][br]
        
        AGENDA[br]
        • Time - Activity/Topic[br]
        • Time - Activity/Topic[br][br]
        
        SPEAKERS[br]
        • Speaker Name - Speaker Title/Affiliation[br]
        • Speaker Name - Speaker Title/Affiliation[br][br]
        
        TARGET AUDIENCE[br]
        Who is this event for?[br][br]
        
        REGISTRATION INFO[br]
        Registration information[br]
        If there's a URL, format it as: URL Link: https://example.com[br][br]
        
        ADDITIONAL INFORMATION[br]
        Any other relevant details, instructions, contact information, etc.[br]
        
        Instructions:
        - Use the \`original_text\` or \`original_link\` to help you.
        - If the content contains structured data (JSON-LD, meta tags, etc.), prioritize that information as it's most reliable.
        - Ensure dates and times are in ISO 8601 format with UTC timezone for the JSON fields.
        - For the description field, include the original timezone in parentheses when mentioning dates and times.
        - Be specific with dates - never use generic dates like "January 1" unless explicitly stated in the source.
        - Be precise about the year, month, and day - don't default to January 1 or other placeholder dates.
        - IMPORTANT: Use only [br] tags for line breaks, avoid all other formatting.
        - CRITICAL: Apple Calendar has limited formatting support - keep the description simple.
        - ${isMultipleEventsExpected ? 
            'For multiple events: Identify and return EACH SEPARATE EVENT as its own complete JSON object in an array.' : 
            'Return ONLY the JSON object described above.'}
        - NOTE: The user's timezone is ${event.timeZone}. Make sure to use this information when converting times to UTC.
        - ${hasStructuredData ? `NOTE: The content contains structured data (schema.org, meta tags, etc). This is highly reliable information that should be prioritized.` : ''}
        The original text or link is: ${event.original_text ? event.original_text : event.original_link}
        ${event.metadata ? `Extracted metadata: ${JSON.stringify(event.metadata)}` : ''}
        Here is the event to process: ${JSON.stringify(event)}`;

    const prompt = promptText;

    // Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    logger.info("Raw response from Gemini:", {
      length: responseText.length,
      isMultipleEventsExpected: isMultipleEventsExpected,
      excerpt: responseText.substring(0, 200) + "..."
    });

    // First check if we got an array of events
    try {
      // Look for arrays
      const arrayMatch = responseText.match(/\[\s*\{.*\}\s*\]/s);
      if (arrayMatch) {
        try {
          const eventsArray = JSON.parse(arrayMatch[0]);
          if (Array.isArray(eventsArray) && eventsArray.length > 0) {
            logger.info(`Found array of ${eventsArray.length} events`);
            
            // Process each event in the array
            const finalEvents = eventsArray.map(event => ({
              title: event.title || "Unknown Event",
              start_datetime: event.start_datetime || new Date().toISOString(),
              end_datetime: event.end_datetime || new Date(Date.now() + 3600000).toISOString(),
              location: event.location || "Unknown",
              description: event.description || "No description provided",
            }));
            
            return finalEvents;
          }
        } catch (arrayParseError) {
          logger.warn("Found array-like text but failed to parse it:", arrayParseError);
          // Continue to try parsing as a single object
        }
      }
      
      // If not an array or array parsing failed, try single object
      const jsonMatch = responseText.match(/\{(?:[^{}]|(?:\{[^{}]*\}))*\}/s);
      if (jsonMatch) {
        try {
          const processedEvent = JSON.parse(jsonMatch[0]);
          logger.info(`Processed single event with Gemini:`, {title: processedEvent.title});
          
          // Check if parsed data is null and replace it with default values
          const finalEvent = {
            title: processedEvent.title || "Unknown Event",
            start_datetime: processedEvent.start_datetime || new Date().toISOString(),
            end_datetime: processedEvent.end_datetime || new Date(Date.now() + 3600000).toISOString(),
            location: processedEvent.location || "Unknown",
            description: processedEvent.description || "No description provided",
          };
          return finalEvent;
        } catch (parseError) {
          logger.error("Failed to parse JSON from response:", parseError);
          throw new Error("Invalid response format from AI model");
        }
      } else {
        logger.error("No JSON found in response:", responseText);
        throw new Error("No events found in the provided text");
      }
    } catch (error) {
      logger.error("Error processing Gemini response:", error);
      throw error;
    }
  } catch (error) {
    logger.error("Error in Gemini API call:", error);
    throw error;
  }
}

module.exports = { processText };
