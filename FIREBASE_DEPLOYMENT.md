# Deploying SynthiCal AI to Firebase

This guide walks through deploying SynthiCal AI to Firebase, which provides a complete platform for both frontend hosting and serverless backend functions.

## Benefits of Firebase for SynthiCal AI

- **Complete Solution**: Host both frontend static files and serverless backend functions
- **Custom Domain Support**: Easily connect your domain/subdomain (e.g., projects.tharunpoduru.com)
- **Secure API Key Storage**: Store your Gemini API key securely as environment variables
- **Scalable Infrastructure**: Automatically scales based on traffic
- **File Storage**: Firebase Storage for handling file uploads (documents/images)
- **Optional Auth**: Easy to implement user authentication if needed later

## Prerequisites

1. A Firebase account (create one at [firebase.google.com](https://firebase.google.com/) if needed)
2. Node.js and npm installed on your machine
3. Your SynthiCal AI codebase ready for deployment

## Step 1: Set Up Firebase Project and Tools

1. **Install Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   ```

2. **Log in to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase in your project**:
   ```bash
   cd /Users/tharunpoduru/Desktop/SynthiCal
   firebase init
   ```

4. **Select the following Firebase products**:
   - Hosting: Configure files for Firebase Hosting
   - Functions: Configure a Cloud Functions directory
   - Storage: Configure Firebase Storage (for file uploads)

5. **Answer the setup questions**:
   - Select or create a Firebase project
   - Choose default Hosting directory (suggest: `frontend/dist` or `frontend/build`)
   - Configure as a single-page app? Yes
   - Set up automatic builds and deploys with GitHub? (Optional)
   - Use ESLint? (Your preference)
   - Install dependencies? Yes

## Step 2: Convert Backend from Flask to Firebase Functions

Create the following directory structure:
```
functions/
├── index.js     # Main functions code
├── package.json # Node.js dependencies
├── utils/       # Utility functions
│   ├── gemini.js
│   └── ics-generator.js
└── processors/  # Input processors
    ├── document.js
    ├── image.js
    └── url.js
```

### Main Functions (index.js)

```javascript
const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { processText } = require('./utils/gemini');
const { generateICS, generateBatchICS } = require('./utils/ics-generator');
const { processDocument } = require('./processors/document');
const { processImage } = require('./processors/image');
const { processUrl } = require('./processors/url');

// Initialize express app for API endpoints
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Set up multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Text processing endpoint
app.post('/process-text', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }
    
    const events = await processText(text);
    return res.json({ events });
  } catch (error) {
    console.error('Error processing text:', error);
    return res.status(500).json({ error: 'Failed to process text' });
  }
});

// Document processing endpoint
app.post('/process-document', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const text = await processDocument(req.file);
    const events = await processText(text);
    return res.json({ events });
  } catch (error) {
    console.error('Error processing document:', error);
    return res.status(500).json({ error: 'Failed to process document' });
  }
});

// Similar endpoints for processImage and processUrl...

// Generate ICS file for a single event
app.post('/generate-ics', async (req, res) => {
  try {
    const { event } = req.body;
    if (!event) {
      return res.status(400).json({ error: 'No event data provided' });
    }
    
    const icsData = await generateICS(event);
    res.set('Content-Type', 'text/calendar');
    res.set('Content-Disposition', `attachment; filename="${event.title || 'event'}.ics"`);
    return res.send(icsData);
  } catch (error) {
    console.error('Error generating ICS:', error);
    return res.status(500).json({ error: 'Failed to generate ICS file' });
  }
});

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);
```

### Gemini Integration (utils/gemini.js)

```javascript
const functions = require('firebase-functions');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize the Gemini API with the key from Firebase config
const genAI = new GoogleGenerativeAI(functions.config().gemini.key);

async function processText(text) {
  try {
    // Initialize Gemini model (2.0 Flash)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite-preview-06-17' });
    
    // Create the prompt similar to your Flask backend
    const prompt = `Extract all events from the following text. For each event, provide the following details in a structured JSON format:
    - title: The name or title of the event
    - start_datetime: The start date and time (ISO format if possible)
    - end_datetime: The end date and time (ISO format if possible, can be empty if not specified)
    - location: Physical location or online meeting link (can be empty)
    - description: Detailed description of the event
    
    Please format the description using these sections with markdown formatting:
    ## EVENT DESCRIPTION
    [Basic event details and purpose]
    
    ## SCHEDULE
    [Timing details, agenda]
    
    ## SPEAKERS
    [Information about speakers/presenters if available]
    
    ## ADDITIONAL INFO
    [Any other relevant details]
    
    Return ONLY a valid JSON array of event objects. The text content is:
    
    ${text}`;

    // Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();
    
    // Extract JSON from the response
    // This regex finds anything that looks like a JSON array
    const jsonMatch = responseText.match(/\[\s*\{.*\}\s*\]/s);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('Failed to parse JSON from response:', parseError);
        throw new Error('Invalid response format from AI model');
      }
    } else {
      console.error('No JSON found in response:', responseText);
      throw new Error('No events found in the provided text');
    }
  } catch (error) {
    console.error('Error in Gemini API call:', error);
    throw error;
  }
}

module.exports = { processText };
```

### ICS Generator (utils/ics-generator.js)

```javascript
const ics = require('ics');
const { parseISO, addHours } = require('date-fns');

function generateICS(event) {
  return new Promise((resolve, reject) => {
    try {
      // Parse dates
      let startDate = event.start_datetime ? parseISO(event.start_datetime) : new Date();
      
      // If end_datetime is not provided, default to 1 hour after start
      let endDate;
      if (event.end_datetime) {
        endDate = parseISO(event.end_datetime);
      } else {
        endDate = addHours(startDate, 1);
      }
      
      // Format for ics library
      const icsEvent = {
        start: [
          startDate.getFullYear(),
          startDate.getMonth() + 1,
          startDate.getDate(),
          startDate.getHours(),
          startDate.getMinutes()
        ],
        end: [
          endDate.getFullYear(),
          endDate.getMonth() + 1,
          endDate.getDate(),
          endDate.getHours(),
          endDate.getMinutes()
        ],
        title: event.title || 'Untitled Event',
        description: event.description || '',
        location: event.location || '',
        url: event.url,
        status: 'CONFIRMED',
        busyStatus: 'BUSY',
      };
      
      ics.createEvent(icsEvent, (error, value) => {
        if (error) {
          console.error('Error creating ICS event:', error);
          reject(error);
        } else {
          resolve(value);
        }
      });
    } catch (error) {
      console.error('Error in generateICS:', error);
      reject(error);
    }
  });
}

function generateBatchICS(events) {
  return new Promise((resolve, reject) => {
    try {
      // Map events to ics format
      const icsEvents = events.map(event => {
        // Same conversion logic as in generateICS
        // ...
      });
      
      ics.createEvents(icsEvents, (error, value) => {
        if (error) {
          reject(error);
        } else {
          resolve(value);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateICS, generateBatchICS };
```

## Step 3: Install Function Dependencies

```bash
cd functions
npm install express cors multer ics date-fns @google/generative-ai firebase-functions firebase-admin pdf-parse jimp node-fetch
```

## Step 4: Modify Frontend to Use Firebase Functions

Update your API calls in the frontend to use the Firebase Functions endpoints:

```javascript
// Change from:
fetch('http://localhost:7654/process-text', ...)

// To:
fetch('https://us-central1-your-project-id.cloudfunctions.net/api/process-text', ...)
```

If you're using relative URLs, you can keep them as-is and configure Firebase hosting rewrite rules.

## Step 5: Configure Firebase for Deployment

1. **Set up environment variables for your Gemini API key**:
   ```bash
   firebase functions:config:set gemini.key="YOUR_GEMINI_API_KEY"
   ```

2. **Add hosting rewrite rules for the API** (in `firebase.json`):
   ```json
   {
     "hosting": {
       "public": "frontend/dist",
       "ignore": [
         "firebase.json",
         "**/.*",
         "**/node_modules/**"
       ],
       "rewrites": [
         {
           "source": "/api/**",
           "function": "api"
         },
         {
           "source": "**",
           "destination": "/index.html"
         }
       ]
     }
   }
   ```

## Step 6: Build and Deploy

1. **Build your frontend**:
   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy to Firebase**:
   ```bash
   cd ..  # Back to root directory
   firebase deploy
   ```

3. After deployment completes, you'll receive a hosting URL like `https://your-project-id.web.app`

## Step 7: Configure Custom Domain (projects.tharunpoduru.com)

1. **Add your custom domain in Firebase**:
   - Go to Firebase console → Hosting → Add custom domain
   - Enter your domain (e.g., `projects.tharunpoduru.com`)
   - Follow the verification process

2. **Update DNS settings in your domain provider**:
   - Add the TXT records for verification
   - Add the A records or CNAME records as instructed by Firebase
   - Wait for DNS propagation (can take 24-48 hours)

## Troubleshooting

- **CORS Issues**: Ensure your CORS settings in Functions allow requests from your domain
- **Function Timeout**: For document/image processing, you may need to increase the timeout in your Firebase plan
- **Function Size**: If your Functions bundle gets too large, split into multiple functions
- **Cold Start**: First-time function calls may be slow - consider implementing a warming strategy

## Cost Considerations

Firebase offers a generous free tier that includes:
- Hosting: 10GB storage, 360MB/day data transfer
- Functions: 2M invocations/month, 400,000 GB-seconds/month, 200,000 CPU-seconds/month
- Storage: 5GB storage, 1GB/day download

For a personal project like SynthiCal AI, the free tier is likely sufficient unless it becomes very popular.

## Next Steps

1. Implement proper error handling
2. Add logging and monitoring
3. Consider adding Firebase Analytics to track usage
4. Explore Firebase Auth if you want to add user accounts later
