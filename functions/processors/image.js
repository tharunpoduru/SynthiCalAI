const { GoogleGenerativeAI } = require("@google/generative-ai");
const functions = require("firebase-functions");
const logger = require("firebase-functions/logger");

/**
 * Process an image file directly with Gemini Vision
 * @param {Object} file - Multer file object containing the image
 * @param {string} userTimeZone - User timezone
 * @returns {Promise<object>} - Extracted event information 
 */
async function processImage(file, userTimeZone) {
  try {
    if (!file || !file.buffer) {
      throw new Error("Invalid image file");
    }

    // Get API key from environment
    const key = process.env.GEMINI_API_KEY || functions.config().gemini.key;
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    // Convert image to base64 for Gemini
    const base64Image = file.buffer.toString('base64');
    const mimeType = file.mimetype;
    
    // Current date for context
    const currentDate = new Date().toISOString();

    // Create multimodal prompt
    const prompt = `Extract event details from this image.
Current date: ${currentDate}
User timezone: ${userTimeZone || "Unknown"}

Return ONLY a JSON object with this structure:
{
  "title": "Event title",
  "start_datetime": "ISO 8601 UTC format",
  "end_datetime": "ISO 8601 UTC format",
  "location": "Location",
  "description": "Markdown description"
}

For multiple events, return an array of these objects.
Use markdown for description with sections: OVERVIEW, DATE & TIME, LOCATION, etc.
Be precise about dates and times.`;

    // Call Gemini with the image
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
    
    // Extract JSON from response
    try {
      // Try to find array format first (multiple events)
      const arrayMatch = response.match(/\[\s*\{.*\}\s*\]/s);
      if (arrayMatch) {
        return JSON.parse(arrayMatch[0]);
      }
      
      // Try to find single object format
      const objectMatch = response.match(/\{\s*".*"\s*:.*\}/s);
      if (objectMatch) {
        return JSON.parse(objectMatch[0]);
      }
      
      // If JSON parsing fails, create a simple default object
      return {
        title: "Event from Image",
        start_datetime: new Date().toISOString(),
        end_datetime: new Date(Date.now() + 3600000).toISOString(),
        location: "Unknown Location",
        description: `## EXTRACTED CONTENT\n\n${response}`
      };
    } catch (error) {
      logger.error("Error parsing Gemini response", { error });
      return {
        title: "Event from Image",
        start_datetime: new Date().toISOString(),
        end_datetime: new Date(Date.now() + 3600000).toISOString(),
        location: "Unknown Location",
        description: `## EXTRACTED CONTENT\n\n${response}`
      };
    }
  } catch (error) {
    logger.error("Error processing image:", error);
    throw error;
  }
}

module.exports = { processImage };
