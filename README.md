# SynthiCal AI - AI Event Importer

SynthiCal AI is an AI-powered tool that extracts event information from various sources (documents, images, text, URLs) and converts it into standard calendar (.ics) files compatible with Google Calendar, Apple Calendar, and other calendar applications.

## Features

- **Multiple Input Methods**: Upload documents (PDF, DOC), images (PNG, JPG), paste text, or provide a URL
- **AI-Powered Extraction**: Uses Google Gemini AI to identify and extract event details
- **Structured Output**: Extracts title, date/time, location, description, and recurrence information
- **Calendar Integration**: Download individual or batched .ics files for easy import into your calendar

## Project Structure

```
synthical/
├── frontend/               # React (Vite) frontend
│   ├── src/                # React components and styles
│   └── ...                 # Frontend configuration
└── backend/                # Flask backend
    ├── processors/         # Input processing modules
    ├── ai/                 # Gemini AI integration
    ├── calendars/          # ICS file generation
    └── ...                 # Backend configuration
```

## Setup Instructions

### Prerequisites

- Node.js (v14+) and npm for the frontend
- Python (v3.8+) for the backend
- Google Gemini API key

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create a virtual environment (optional but recommended):
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Set up your environment variables:
   ```
   cp .env.example .env
   ```
   
5. Edit the `.env` file and add your Google Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

6. Run the backend server:
   ```
   python app.py
   ```
   The server will start at http://localhost:5000

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run the development server:
   ```
   npm run dev
   ```
   The frontend will be available at http://localhost:3000

## Usage

1. Open the application in your browser
2. Choose your input method:
   - Paste text directly
   - Upload a document (PDF, DOC)
   - Upload an image (PNG, JPG)
   - Enter a URL
3. Click "Extract Events"
4. Review the extracted events
5. Download individual events or all events as .ics files
6. Import the .ics files into your calendar application

## Dependencies

### Frontend
- React
- Vite

### Backend
- Flask
- PyPDF2 (PDF processing)
- python-docx (DOCX processing)
- OpenCV and pytesseract (Image OCR)
- Google Generative AI (Gemini API)
- icalendar (ICS file generation)

## License

MIT
