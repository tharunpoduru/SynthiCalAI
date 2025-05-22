/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onRequest } = require("firebase-functions/v2/https");
const functions = require("firebase-functions");
const logger = require("firebase-functions/logger");
const express = require("express");
const cors = require("cors");
const multer = require('multer');
const admin = require("firebase-admin");
const { processText } = require("./utils/gemini"); // Assuming this now handles ISO dates
const { generateICS } = require("./utils/ics-generator");
const { processDocument } = require("./processors/document");
const { processImage } = require("./processors/image");
const { processUrl } = require("./processors/url"); // For processing URLs

// Initialize Firebase
admin.initializeApp();

// Initialize express app for API endpoints
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// Configure storage
const storage = multer.memoryStorage();
// Configure multer with more detailed error handling
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Text processing endpoint
app.post("/api/process-text", express.json(), async (req, res) => {
  try {
    let textContent = req.body.content;
    const userTimeZone = req.body.userTimeZone;

    if (!textContent || textContent.length === 0) {
      return res.status(400).json({ error: "No text provided" });
    }

    // Add timezone information if available
    if (userTimeZone){
      textContent = `The user's timezone is: ${userTimeZone}.\n` + textContent;
    }

    let originalDate = req.body.original_date;
    if(!originalDate && req.headers['content-type']?.includes('multipart/form-data')) {
      originalDate = req.body.get('original_date');
    }

    try {
      const currentDate = new Date();
      const currentTimeISO = currentDate.toISOString();
      textContent = `Current date and time: ${currentTimeISO}\n` + textContent + (originalDate ? `\n Original date: ${JSON.stringify(originalDate)}` : '');
      
      // Check if the text might contain multiple events
      const multiEventIndicators = [
        /\b(first|second|third|next|another)\s+event\b/i,
        /\b(also|additionally)\b.*\b(attend|go to|participating)\b/i,
        /\b(multiple|several|many|two|three|few)\s+events\b/i,
        /\bevent\s+\d+\b/i,
        /\b(and|also)\b.*\b(on|at)\b.*\b(different|another)\b/i
      ];
      
      const potentiallyMultipleEvents = multiEventIndicators.some(pattern => 
        pattern.test(textContent)
      );
      
      const event = await processText({
        original_text: textContent,
        isMultipleEventsExpected: potentiallyMultipleEvents
      });
      
      return res.status(200).json(event);
    } catch (error) {
      logger.error("Error processing text:", error);
      return res.status(500).json({ error: "Failed to process text: " + error.message });
    }
  } catch (error) {
    logger.error('Error processing input:', error);
    return res.status(500).json({ error: "Failed to process text: " + error.message });
  }
});

// Document processing endpoint with debug-first approach
app.post("/api/process-document", upload.single("file"), async (req, res) => {
  try {
    // Log everything we have for debugging
    logger.info("Document upload received:", { 
      headers: req.headers,
      file: req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        hasBuffer: !!req.file.buffer
      } : "No file",
      body: req.body,
      userTimeZone: req.body.userTimeZone
    });
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded", details: "req.file is undefined" });
    }
    
    if (!req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ error: "Empty file buffer", details: "File buffer is empty or undefined" });
    }
    
    // Get the user timezone from form data
    const userTimeZone = req.body.userTimeZone;
    
    try {
      // Instead of complex processing, just return a static response for now
      // to verify that file upload works
      return res.status(200).json({
        title: `Test Processing: ${req.file.originalname}`,
        start_datetime: new Date().toISOString(),
        end_datetime: new Date(Date.now() + 3600000).toISOString(),
        location: "Test Location",
        description: `## DEBUG INFO\n\nFile received: ${req.file.originalname}\nSize: ${req.file.size} bytes\nMIME type: ${req.file.mimetype}\nUser timezone: ${userTimeZone || "Unknown"}`
      });
    } catch (error) {
      logger.error('Error processing document:', error);
      return res.status(500).json({ error: "Failed to process document: " + error.message });
    }
  } catch (error) {
    logger.error('Error in document upload handler:', error);
    return res.status(500).json({ error: "Failed to process document upload: " + error.message });
  }
});

// Image processing endpoint with the same debug-first approach
app.post("/api/process-image", upload.single("file"), async (req, res) => {
  try {
    // Log everything we have for debugging
    logger.info("Image upload received:", { 
      headers: req.headers,
      file: req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        hasBuffer: !!req.file.buffer
      } : "No file",
      body: req.body,
      userTimeZone: req.body.userTimeZone
    });
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded", details: "req.file is undefined" });
    }
    
    if (!req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ error: "Empty file buffer", details: "File buffer is empty or undefined" });
    }
    
    // Get the user timezone from form data
    const userTimeZone = req.body.userTimeZone;
    
    try {
      // Instead of complex processing, just return a static response for now
      // to verify that file upload works
      return res.status(200).json({
        title: `Test Processing: ${req.file.originalname}`,
        start_datetime: new Date().toISOString(),
        end_datetime: new Date(Date.now() + 3600000).toISOString(),
        location: "Test Location",
        description: `## DEBUG INFO\n\nFile received: ${req.file.originalname}\nSize: ${req.file.size} bytes\nMIME type: ${req.file.mimetype}\nUser timezone: ${userTimeZone || "Unknown"}`
      });
    } catch (error) {
      logger.error('Error processing image:', error);
      return res.status(500).json({ error: "Failed to process image: " + error.message });
    }
  } catch (error) {
    logger.error('Error in image upload handler:', error);
    return res.status(500).json({ error: "Failed to process image upload: " + error.message });
  }
});

// URL processing endpoint
app.post("/api/process-url", async (req, res) => {
  try {
    let urlToProcess = req.body.url;
    let userTimeZone = req.body.userTimeZone;

    if (!urlToProcess && req.headers["content-type"]?.includes("multipart/form-data")) {
      urlToProcess = req.body.get("url");
      userTimeZone = req.body.get("userTimeZone");
    } else if (!urlToProcess) {
      return res.status(400).json({ error: "No URL provided" });
    }

    // Log the received URL for debugging
    logger.info("Received URL request:", {
      contentType: req.headers["content-type"],
      body: typeof req.body,
      url: urlToProcess,
      timezone: userTimeZone
    });

    try {
      // Pass timezone info to the URL processor
      const events = await processUrl(urlToProcess, userTimeZone);
      return res.status(200).json(events);
    } catch (error) {
      logger.error('Error processing URL:', error);
      return res.status(500).json({ error: "Failed to process URL: " + error.message });
    }
  } catch (error) {
    logger.error('Error processing URL:', error);
    return res.status(500).json({ error: "Failed to process URL: " + error.message });
  }
});

// Generate ICS file for an array of events
app.post("/api/generate-batch-ics", async (req, res) => {
  try {
    // Check for both events array and single event
    let eventsToProcess = [];
    
    if (req.body.events && Array.isArray(req.body.events)) {
      eventsToProcess = req.body.events;
    } else if (req.body.event) {
      eventsToProcess = [req.body.event];
    } else {
      return res.status(400).json({ error: "No valid events provided" });
    }
    
    if (eventsToProcess.length === 0) {
      return res.status(400).json({ error: "No valid events provided" });
    }
    
    logger.info('Generating batch ICS for events:', { count: eventsToProcess.length });
    const icsData = await generateICS(eventsToProcess);
    const filename = eventsToProcess.length > 1 ? "events.ics" : `${eventsToProcess[0].title || "event"}.ics`;
    
    res.set("Content-Type", "text/calendar");
    res.set("Content-Disposition", `attachment; filename=${filename}`);
    return res.send(icsData);
  } catch (error) {
    logger.error("Error generating ICS:", error);
    return res.status(500).json({ error: "Failed to generate ICS file" });
  }
});

// Generate ICS file for a single event or multiple events
app.post("/api/generate-ics", async (req, res) => {
  try {
    // Check for both single event and array of events
    let eventsToProcess = [];
    
    if (req.body.event) {
      eventsToProcess = [req.body.event];
    } else if (req.body.events && Array.isArray(req.body.events)) {
      eventsToProcess = req.body.events;
    } else {
      return res.status(400).json({ error: "No valid events provided" });
    }
    
    if (eventsToProcess.length === 0) {
      return res.status(400).json({ error: "No valid events provided" });
    }
    
    logger.info('Generating ICS for events:', { count: eventsToProcess.length });
    const icsData = await generateICS(eventsToProcess);
    const filename = eventsToProcess.length > 1 
      ? "events.ics" 
      : `${eventsToProcess[0].title || "event"}.ics`;
    
    res.set("Content-Type", "text/calendar");
    res.set("Content-Disposition", `attachment; filename=${filename}`);
    return res.send(icsData);
  } catch (error) {
    logger.error("Error generating ICS:", error);
    return res.status(500).json({ error: "Failed to generate ICS file" });
  }
});

// Export the Express app as a Firebase Function with unauthenticated access
exports.api = onRequest({
  cors: true,
  invoker: "public", // Allow unauthenticated access
  maxInstances: 10,
}, app);
