# SynthiCal AI

SynthiCal AI is an AI-powered web application that automates the extraction of event details from unstructured inputs like text, documents, images, and URLs. It uses Google's Gemini AI to interpret the content and converts it into downloadable calendar (.ics) files, compatible with Google Calendar, Apple Calendar, and other calendar applications.

## Features

- **Multiple Input Methods**: Supports direct text pasting, document uploads (PDF, DOC, DOCX, TXT, RTF), image uploads (PNG, JPG, JPEG, WebP, HEIF), audio recordings (up to 1 minute), and website URLs.
- **AI-Powered Extraction**: Leverages the Google Gemini API with Files API for document processing and multimodal capabilities for images to intelligently identify and structure event details, including title, date/time, location, and description.
- **Calendar Integration**: Generates standard `.ics` files that can be easily imported into any major calendar platform.
- **User-Friendly Interface**: A clean and simple interface for a seamless user experience.

## Project Structure

The project is a monorepo containing the frontend and backend services:

```
/
├── frontend/         # React (Vite) Single Page Application
└── functions/        # Node.js Backend (Firebase Cloud Functions)
```

## Setup and Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Firebase CLI](https://firebase.google.com/docs/cli) for backend deployment and local emulation

### Backend Setup (Firebase Functions)

1.  **Navigate to the functions directory:**
    ```bash
    cd functions
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    You need to provide your Google Gemini API key and Firebase configuration.
    
    **For production deployment:**
    ```bash
    firebase functions:config:set gemini.key="YOUR_GEMINI_API_KEY"
    ```
    
    **For local development:**
    ```bash
    # Backend environment (functions)
    cd functions
    cp .env.example .env
    # Edit .env and add your actual Gemini API key
    
    # Frontend environment 
    cd ../frontend
    cp .env.example .env
    # Edit .env and add your Firebase configuration
    ```

4.  **Run the backend locally using the Firebase Emulator:**
    ```bash
    firebase emulators:start
    ```
    The API will be available at the endpoint provided by the emulator, typically `http://localhost:5001`.

### Frontend Setup

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The frontend will be available at `http://localhost:5173` or another port if 5173 is in use.

## Usage

1.  Open the application in your browser.
2.  Select your preferred input method:
    - **Text**: Paste event information directly
    - **Document/Image**: Upload documents (PDF, DOC, DOCX, TXT, RTF) or images (PNG, JPG, JPEG, WebP, HEIF) containing event details
    - **Audio**: Record up to 1 minute of audio describing your event details
    - **URL**: Provide a website URL with event information
3.  Provide the input and click "Extract Events".
4.  Review the extracted event details on the event cards.
5.  Click "Add to Calendar" on any card to download an `.ics` file for that event, or use the "Download All Events" button to get a single `.ics` file for all extracted events.

## Dependencies

### Frontend
- React
- Vite
- add-to-calendar-button

### Backend
- Firebase Functions
- Express.js
- Google Gemini AI API (`@google/generative-ai`) with Files API and multimodal capabilities
- `ics` for calendar file generation
- `node-fetch` for REST API calls
- `form-data` for file upload handling

## License

This project is licensed under the MIT License. 