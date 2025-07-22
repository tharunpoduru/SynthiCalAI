const functions = require("firebase-functions");
const logger = require("firebase-functions/logger");
const fetch = require("node-fetch");

/**
 * Process documents and images using the Gemini Files API
 * Uses direct file upload (no base64) with proper timezone handling
 */
async function processDocumentWithGemini(file, userTimeZone) {
  try {
    logger.info("Processing file with Gemini Files API:", {
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.buffer?.length || 'unknown'
    });

    const apiKey = process.env.GEMINI_API_KEY || functions.config().gemini.key;
    
    if (!apiKey) {
      throw new Error("Gemini API key not configured");
    }

    if (!file || !file.buffer) {
      throw new Error("No file data provided");
    }

    // Validate file type
    const documentTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/rtf'
    ];

    const imageTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/heif'
    ];

    const audioTypes = [
      'audio/wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/aiff',
      'audio/aac',
      'audio/ogg',
      'audio/flac',
      'audio/webm',
      'audio/mp4'
    ];

    const allSupportedTypes = [...documentTypes, ...imageTypes, ...audioTypes];
    
    // Handle MIME types with codecs (e.g., "audio/webm;codecs=opus")
    const baseMimeType = file.mimetype.split(';')[0];
    
    if (!allSupportedTypes.includes(file.mimetype) && !allSupportedTypes.includes(baseMimeType)) {
      throw new Error(`Unsupported file type: ${file.mimetype}. Supported types: Documents (PDF, DOC, DOCX, TXT, RTF), Images (PNG, JPG, JPEG, WebP, HEIF), Audio (WAV, MP3, AIFF, AAC, OGG, FLAC, WebM, MP4)`);
    }

    // Determine file category
    const isDocument = documentTypes.includes(baseMimeType);
    const isImage = imageTypes.includes(baseMimeType);
    const isAudio = audioTypes.includes(baseMimeType) || baseMimeType.startsWith('audio/');

    logger.info(`File category: ${isDocument ? 'document' : isImage ? 'image' : isAudio ? 'audio' : 'unknown'}`);

    // Step 1: Start resumable upload to Gemini Files API
    logger.info("Initiating file upload to Gemini Files API...");
    
    const uploadInitResponse = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': file.buffer.length.toString(),
        'X-Goog-Upload-Header-Content-Type': baseMimeType,
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        file: {
          display_name: file.originalname || 'uploaded-file'
        }
      })
    });

    if (!uploadInitResponse.ok) {
      const errorText = await uploadInitResponse.text();
      logger.error("Upload initialization failed:", errorText);
      throw new Error(`Upload initialization failed: ${uploadInitResponse.status} - ${errorText}`);
    }

    const uploadUrl = uploadInitResponse.headers.get('x-goog-upload-url');
    if (!uploadUrl) {
      throw new Error('No upload URL received from Gemini API');
    }

    // Step 2: Upload the actual file data
    logger.info("Uploading file data...");
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Length': file.buffer.length.toString(),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize'
      },
      body: file.buffer
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      logger.error("File upload failed:", errorText);
      throw new Error(`File upload failed: ${uploadResponse.status} - ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    const fileUri = uploadResult.file.uri;
    const fileName = uploadResult.file.name;
    
    logger.info("File uploaded successfully:", { fileUri, fileName });

    // Step 3: Wait for file processing to complete
    logger.info("Waiting for file processing...");
    
    let processingComplete = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout
    
    while (!processingComplete && attempts < maxAttempts) {
      const statusResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}`, {
        method: 'GET',
        headers: {
          'x-goog-api-key': apiKey
        }
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        logger.info(`File processing status: ${statusData.state}`);
        
        if (statusData.state === 'ACTIVE') {
          processingComplete = true;
          break;
        } else if (statusData.state === 'FAILED') {
          throw new Error('File processing failed on Gemini servers');
        }
      } else {
        logger.warn(`Status check failed: ${statusResponse.status}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    if (!processingComplete) {
      throw new Error('File processing timeout - file not ready after 30 seconds');
    }

    // Step 4: Generate content using the processed file
    logger.info("Generating content with processed file...");
    
    // Create dynamic prompt based on file type and current date/timezone
    const now = new Date();
    const userTimezone = userTimeZone || 'UTC';
    
    // Get current date in user's timezone for better relative date parsing
    const userDate = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(now);

    let mediaType, actionVerb, instructions;
    
    if (isDocument) {
      mediaType = 'document';
      actionVerb = 'Analyze this';
      instructions = 'Look for dates, times, locations, event titles, and descriptions in the text content.';
    } else if (isImage) {
      mediaType = 'image';
      actionVerb = 'Analyze this';
      instructions = 'Look for any text containing dates, times, locations, event titles, and descriptions. This could be a screenshot, poster, invitation, or any image with event information.';
    } else if (isAudio) {
      mediaType = 'audio recording';
      actionVerb = 'Listen to this';
      instructions = 'Pay attention to spoken dates and times (like "tomorrow at 3", "next Tuesday"), event descriptions, locations mentioned, and people or attendees referenced.';
    }

    const prompt = `${actionVerb} ${mediaType} and extract any event information mentioned. ${instructions}

IMPORTANT CONTEXT:
- Current date/time in user timezone (${userTimezone}): ${userDate}
- When processing relative dates like "tomorrow", "next week", calculate from the above date
- User timezone: ${userTimezone}
- File name: ${file.originalname || 'unknown'}

Return ONLY a JSON object in this exact format:
{
  "title": "Event title",
  "start_datetime": "YYYY-MM-DDTHH:MM:SSZ (ISO 8601 UTC)",
  "end_datetime": "YYYY-MM-DDTHH:MM:SSZ (ISO 8601 UTC)",
  "location": "Event location",
  "description": "Event description with [br] tags for line breaks"
}

For multiple events, return an array of these objects.
CRITICAL: Convert all times to UTC format. Be precise with dates and times.
IMPORTANT: If no end time is specified, default the end time to 1 hour after the start time.
${isAudio ? 'Focus on the spoken content and extract clear, actionable event details.' : ''}

Example:
If user says "meeting tomorrow at 5 PM" and current time is 2024-01-15 10:00 AM PST, then:
- "tomorrow" = 2024-01-16
- "5 PM PST" = 2024-01-17T01:00:00Z (UTC) [start_datetime]
- Since no end time specified, end_datetime = 2024-01-17T02:00:00Z (UTC) [1 hour later]`;

    const generateResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { 
              file_data: {
                mime_type: baseMimeType,
                file_uri: fileUri
              }
            }
          ]
        }]
      })
    });

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      logger.error("Content generation failed:", errorText);
      throw new Error(`Content generation failed: ${generateResponse.status} ${errorText}`);
    }

    const result = await generateResponse.json();
    
    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content || !result.candidates[0].content.parts || !result.candidates[0].content.parts[0]) {
      logger.error("Invalid response structure:", JSON.stringify(result, null, 2));
      throw new Error("Invalid response structure from Gemini API");
    }
    
    const responseText = result.candidates[0].content.parts[0].text;
    
    logger.info("Content generated successfully", { responseLength: responseText.length });

    // Step 5: Clean up - delete the uploaded file
    try {
      const deleteResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}`, {
        method: 'DELETE',
        headers: {
          'x-goog-api-key': apiKey
        }
      });
      
      if (deleteResponse.ok) {
        logger.info("File cleaned up successfully");
      } else {
        logger.warn("File cleanup failed, but continuing...");
      }
    } catch (cleanupError) {
      logger.warn("File cleanup error:", cleanupError.message);
    }

    // Step 6: Parse and return the response
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\[.*\]|\{.*\}/s);
      if (!jsonMatch) {
        logger.error("No JSON found in response:", responseText);
        throw new Error("No valid JSON found in response");
      }

      const parsedData = JSON.parse(jsonMatch[0]);
      
      // Ensure proper format
      if (Array.isArray(parsedData)) {
        return parsedData.map(event => ({
          title: event.title || "Extracted Event",
          start_datetime: event.start_datetime || new Date().toISOString(),
          end_datetime: event.end_datetime || new Date(Date.now() + 3600000).toISOString(),
          location: event.location || "Unknown",
          description: event.description || `Extracted from ${mediaType}`
        }));
      } else {
        return {
          title: parsedData.title || "Extracted Event",
          start_datetime: parsedData.start_datetime || new Date().toISOString(),
          end_datetime: parsedData.end_datetime || new Date(Date.now() + 3600000).toISOString(),
          location: parsedData.location || "Unknown",
          description: parsedData.description || `Extracted from ${mediaType}`
        };
      }
    } catch (parseError) {
      logger.error("JSON parsing failed:", parseError);
      logger.error("Raw response:", responseText);
      
      // Return fallback event
      return {
        title: `Analysis of ${file.originalname}`,
        start_datetime: new Date().toISOString(),
        end_datetime: new Date(Date.now() + 3600000).toISOString(),
        location: "Unknown",
        description: `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} processed but could not extract structured event data. Raw content: ${responseText.substring(0, 200)}...`
      };
    }

  } catch (error) {
    logger.error("Document processing error:", error);
    throw new Error(`Document processing failed: ${error.message}`);
  }
}

module.exports = { processDocumentWithGemini }; 