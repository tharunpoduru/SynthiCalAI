const { GoogleGenerativeAI } = require("@google/generative-ai");
const functions = require("firebase-functions");
const logger = require("firebase-functions/logger");

/**
 * Process an image file using Gemini Vision to extract event information
 * @param {Object} file - Multer file object containing the image
 * @param {string} userTimeZone - User timezone
 * @returns {Promise<object>} - Extracted event information 
 */
async function processImage(file, userTimeZone) {
  try {
    if (!file || !file.buffer) {
      throw new Error("Invalid image file");
    }

    logger.info("Processing image:", {
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

    // Get API key from environment
    const key = process.env.GEMINI_API_KEY || functions.config().gemini.key;
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite-preview-06-17" });
    
    // Convert image to base64 for Gemini
    const base64Image = file.buffer.toString('base64');
    const mimeType = file.mimetype;
    
    // Validate image type
    if (!mimeType.includes('image/')) {
      throw new Error(`Invalid file type: ${mimeType}. Only image files are supported.`);
    }

    // Current date for context
    const currentDate = new Date().toISOString();

    // Create comprehensive prompt for Gemini Vision
    const prompt = `Analyze this image and extract any event information you can find. Look for:
- Event titles, names, or descriptions
- Dates and times (be very careful about date interpretation)
- Locations or venues
- Speakers, presenters, or hosts
- Registration information
- URLs or contact details
- Any other event-related details

Current date and time: ${currentDate}
${userTimeZone ? `User timezone: ${userTimeZone}` : ''}
Image filename: ${file.originalname}

Return ONLY a JSON object with this exact structure:
{
  "title": "Event title",
  "start_datetime": "ISO 8601 UTC format (YYYY-MM-DDTHH:MM:SSZ)",
  "end_datetime": "ISO 8601 UTC format (YYYY-MM-DDTHH:MM:SSZ)",
  "location": "Location or venue",
  "description": "Detailed description using minimal formatting with [br] tags for line breaks"
}

For multiple events in the image, return an array of these objects.

Important guidelines:
- Convert all times to UTC format
- Be precise about dates - use the actual year, month, and day
- If end time is not specified, add 1-2 hours to start time based on event type
- Include all relevant details in the description
- If no clear event information is found, return an appropriate message in the title`;

    logger.info("Sending image to Gemini Vision for analysis...");

    // Call Gemini Vision with the image
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { 
              inlineData: {
                mimeType: mimeType,
                data: base64Image
              }
            },
            { text: prompt }
          ]
        }
      ]
    });

    const response = result.response.text();
    logger.info("Received response from Gemini Vision", { responseLength: response.length });

    // Extract JSON from response
    try {
      // Try to find array format first (multiple events)
      const arrayMatch = response.match(/\[\s*\{.*\}\s*\]/s);
      if (arrayMatch) {
        const events = JSON.parse(arrayMatch[0]);
        logger.info("Successfully parsed multiple events from image", { eventCount: events.length });
        return events;
      }
      
      // Try to find single object format
      const objectMatch = response.match(/\{\s*".*"\s*:.*\}/s);
      if (objectMatch) {
        const event = JSON.parse(objectMatch[0]);
        logger.info("Successfully parsed single event from image");
        return event;
      }
      
      // If JSON parsing fails, create a descriptive event with the response
      logger.warn("Could not parse JSON from Gemini response, creating fallback event");
      return {
        title: `Event from ${file.originalname}`,
        start_datetime: new Date().toISOString(),
        end_datetime: new Date(Date.now() + 3600000).toISOString(),
        location: "Location extracted from image",
        description: `## EXTRACTED FROM IMAGE[br][br]${response.replace(/\n/g, '[br]')}`
      };
    } catch (parseError) {
      logger.error("Error parsing Gemini response:", parseError);
      return {
        title: `Event from ${file.originalname}`,
        start_datetime: new Date().toISOString(),
        end_datetime: new Date(Date.now() + 3600000).toISOString(),
        location: "Location extracted from image",
        description: `## EXTRACTED FROM IMAGE[br][br]${response.replace(/\n/g, '[br]')}`
      };
    }
  } catch (error) {
    logger.error("Error processing image:", error);
    throw error;
  }
}

module.exports = { processImage };
