const { GoogleGenerativeAI } = require("@google/generative-ai");
const functions = require("firebase-functions");
const logger = require("firebase-functions/logger");
const pdf = require('pdf-parse');

/**
 * Process a document file directly with Gemini
 * @param {Object} file - Multer file object containing the document
 * @param {string} userTimeZone - User timezone
 * @returns {Promise<object>} - Extracted event information 
 */
async function processDocument(file, userTimeZone) {
  try {
    if (!file || !file.buffer) {
      throw new Error("Invalid document file");
    }

    // Get API key from environment
    const key = process.env.GEMINI_API_KEY || functions.config().gemini.key;
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    // Extract content based on file type
    let documentContent = "";
    const mimeType = file.mimetype.toLowerCase();
    
    if (mimeType.includes('pdf')) {
      try {
        const pdfData = await pdf(file.buffer);
        documentContent = pdfData.text;
      } catch (pdfError) {
        logger.error("Error extracting PDF content:", pdfError);
        throw new Error("Failed to extract content from PDF");
      }
    } else {
      // For other document types, we'd need specific extractors
      throw new Error(`Unsupported document type: ${mimeType}`);
    }
    
    // Current date for context
    const currentDate = new Date().toISOString();

    // Create prompt for Gemini
    const prompt = `Extract event details from this document content.
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
Be precise about dates and times.

Document content:
${documentContent}`;

    // Call Gemini with the document content
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
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
        title: "Event from Document",
        start_datetime: new Date().toISOString(),
        end_datetime: new Date(Date.now() + 3600000).toISOString(),
        location: "Unknown Location",
        description: `## EXTRACTED CONTENT\n\n${response}`
      };
    } catch (error) {
      logger.error("Error parsing Gemini response", { error });
      return {
        title: "Event from Document",
        start_datetime: new Date().toISOString(),
        end_datetime: new Date(Date.now() + 3600000).toISOString(),
        location: "Unknown Location",
        description: `## EXTRACTED CONTENT\n\n${response}`
      };
    }
  } catch (error) {
    logger.error("Error processing document:", error);
    throw error;
  }
}

module.exports = { processDocument };
