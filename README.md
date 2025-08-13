# SynthiCal AI

An intelligent web application that automatically extracts event details from various sources (text, URLs, documents, images, and audio) and converts them into downloadable calendar files (.ics) or direct calendar integrations.

![SynthiCal AI Demo](https://via.placeholder.com/800x400/c41230/ffffff?text=SynthiCal+AI+Demo)

## ✨ Features

- **Multi-Modal Input Support**
  - 📝 **Text Analysis**: Extract events from typed or pasted text
  - 🌐 **URL Processing**: Analyze web pages and extract event information
  - 📄 **Document Upload**: Process PDFs, Word docs, and text files
  - 🖼️ **Image Analysis**: Extract text from event flyers and screenshots
  - 🎤 **Audio Recording**: Record speech and extract event details

- **Smart Event Extraction**
  - 🤖 **AI-Powered**: Uses Google Gemini 2.5 Pro for intelligent analysis
  - 🕐 **Timezone Aware**: Handles timezone conversion automatically
  - 📅 **Date Intelligence**: Understands relative dates like "tomorrow" and "next Friday"
  - 🔄 **Multi-Event Support**: Extract multiple events from a single source

- **Calendar Integration**
  - 📲 **Direct Integration**: Add events to Google Calendar, Apple Calendar, Outlook
  - 📁 **ICS Export**: Download standard .ics files for any calendar app
  - ✅ **Bulk Operations**: Select and download multiple events at once
  - 🎯 **One-Click Actions**: Seamless calendar integration with minimal clicks

## 🚀 Quick Start

### Prerequisites

- Node.js 20 or later
- npm or yarn package manager
- Firebase CLI (for deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "SynthiCal AI"
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install frontend dependencies
   cd frontend
   npm install
   
   # Install backend dependencies
   cd ../functions
   npm install
   ```

3. **Environment Setup**
   
   Create environment files:
   
   **Frontend (.env in frontend/ directory):**
   ```env
   # Firebase configuration
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   
   # Analytics (optional)
   VITE_GA_MEASUREMENT_ID=your_ga_measurement_id
   ```
   
   **Backend (.env in functions/ directory):**
   ```env
   # Google Gemini API
   GEMINI_API_KEY=your_gemini_api_key
   
   # Firebase project
   FIREBASE_PROJECT_ID=your_project_id
   ```

4. **Firebase Setup**
   ```bash
   # Login to Firebase
   firebase login
   
   # Initialize project (if not already done)
   firebase init
   
   # Set your project
   firebase use your_project_id
   ```

### Development

1. **Start the development servers**
   
   **Frontend (in frontend/ directory):**
   ```bash
   npm run dev
   # Runs on http://localhost:3000
   ```
   
   **Backend (in functions/ directory):**
   ```bash
   npm run serve
   # Firebase emulators on http://localhost:5001
   ```

2. **Development workflow**
   - Frontend will proxy API calls to the local Firebase emulator
   - Hot reload is enabled for both frontend and backend changes
   - Use Firebase emulator UI for debugging functions

### Production Deployment

1. **Build the frontend**
   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy to Firebase**
   ```bash
   # Deploy everything
   firebase deploy
   
   # Or deploy individually
   firebase deploy --only hosting  # Frontend only
   firebase deploy --only functions # Backend only
   ```

## 🏗️ Project Structure

```
SynthiCal AI/
├── 📁 frontend/                 # React frontend application
│   ├── 📁 src/
│   │   ├── 📄 App.jsx          # Main application component
│   │   ├── 📁 components/      # Reusable React components
│   │   │   ├── 📄 AudioRecorder.jsx
│   │   │   ├── 📄 EventCards.jsx
│   │   │   └── 📄 AddToCalendar.jsx
│   │   ├── 📄 analytics.js     # Google Analytics integration
│   │   └── 📄 index.css        # Global styles and Tailwind
│   ├── 📄 package.json         # Frontend dependencies
│   ├── 📄 vite.config.js       # Vite configuration
│   └── 📄 tailwind.config.js   # Tailwind CSS configuration
├── 📁 functions/               # Firebase Functions (Backend)
│   ├── 📁 processors/          # Input processing modules
│   │   ├── 📄 file.js          # File upload processing
│   │   └── 📄 url.js           # URL content extraction
│   ├── 📁 utils/               # Utility modules
│   │   ├── 📄 gemini.js        # Google Gemini AI integration
│   │   └── 📄 ics-generator.js # Calendar file generation
│   ├── 📄 index.js            # Main Express application
│   └── 📄 package.json        # Backend dependencies
├── 📄 firebase.json           # Firebase configuration
├── 📄 package.json           # Root package.json
└── 📄 README.md              # This file
```

## 🛠️ Technology Stack

### Frontend
- **React 19**: Modern UI library with latest features
- **Vite**: Fast build tool and development server
- **TailwindCSS**: Utility-first CSS framework
- **add-to-calendar-button**: Multi-platform calendar integration

### Backend
- **Firebase Functions**: Serverless backend API
- **Express.js**: Web application framework
- **Google Gemini AI**: Multi-modal AI processing
- **Node.js 20**: Runtime environment

### Infrastructure
- **Firebase Hosting**: Global CDN for frontend
- **Firebase Analytics**: User behavior tracking
- **Google Cloud**: AI processing and file storage

## 📖 API Reference

### Endpoints

All API endpoints are prefixed with `/api/`:

- **POST /api/process-text**
  - Extract events from text input
  - Body: `{ text: string, userTimeZone: string }`

- **POST /api/process-url**
  - Extract events from web pages
  - Body: `{ url: string, userTimeZone: string }`

- **POST /api/process-file**
  - Extract events from uploaded files
  - Body: `multipart/form-data` with file and userTimeZone

- **POST /api/generate-ics**
  - Generate ICS calendar file
  - Body: `{ events: Event[] }`

- **GET /api/health**
  - System health check

### Event Object Structure

```javascript
{
  "title": "Event Name",
  "start_datetime": "2025-01-15T14:00:00Z",  // UTC ISO format
  "end_datetime": "2025-01-15T15:00:00Z",    // UTC ISO format
  "location": "Event Location",
  "description": "Event description with details",
  "original_link": "https://source-url.com" // Optional
}
```

## 🔧 Configuration

### Firebase Configuration

The project uses Firebase for hosting and backend functions. Key configuration files:

- `firebase.json`: Firebase project configuration
- `functions/package.json`: Backend dependencies and Node.js version
- `frontend/package.json`: Frontend dependencies

### Environment Variables

**Required Environment Variables:**

| Variable | Location | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | functions/.env | Google Gemini AI API key |
| `VITE_FIREBASE_PROJECT_ID` | frontend/.env | Firebase project ID |
| `VITE_GA_MEASUREMENT_ID` | frontend/.env | Google Analytics ID (optional) |

**Security Note**: Never commit `.env` files to version control. Use Firebase Secrets for production.

## 🧪 Testing

### Frontend Testing
```bash
cd frontend
npm run test          # Run unit tests
npm run test:coverage # Run with coverage report
```

### Backend Testing
```bash
cd functions
npm run test          # Run function tests
npm run test:integration # Run integration tests
```

### End-to-End Testing
```bash
npm run test:e2e      # Run full application tests
```

## 📈 Performance

### Frontend Optimization
- **Code Splitting**: Automatic route-based splitting
- **Lazy Loading**: Components loaded on demand
- **Image Optimization**: Compressed and responsive images
- **Bundle Analysis**: Use `npm run analyze` to inspect bundle size

### Backend Optimization
- **Auto-scaling**: Firebase Functions scale automatically
- **Cold Start**: Optimized for minimal cold start time
- **Connection Pooling**: Efficient external API usage
- **Error Handling**: Graceful degradation and retry logic

## 🔒 Privacy & Security

### Data Handling
- **No Persistent Storage**: User data is not stored permanently
- **Temporary Processing**: Files are automatically deleted after processing
- **Session-Only**: All data is cleared when the session ends
- **HTTPS Only**: All communications are encrypted

### Security Features
- **Input Validation**: Comprehensive validation of all inputs
- **File Size Limits**: 25MB maximum upload size
- **CORS Protection**: Configured for secure cross-origin requests
- **Error Sanitization**: No sensitive information in error messages

## 🐛 Troubleshooting

### Common Issues

**"GEMINI_API_KEY not set" Error**
- Ensure you have created a `.env` file in the `functions/` directory
- Add your Gemini API key: `GEMINI_API_KEY=your_api_key_here`
- Restart the Firebase emulator

**Frontend Build Errors**
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version: Requires Node.js 20+
- Verify all environment variables are set

**Firebase Deployment Issues**
- Ensure you're logged in: `firebase login`
- Check project configuration: `firebase use --add`
- Verify billing is enabled for your Firebase project

**Audio Recording Not Working**
- Check browser permissions for microphone access
- Use HTTPS or localhost (required for MediaRecorder API)
- Verify browser compatibility (modern browsers only)

### Debug Mode

Enable debug logging:
```bash
# Frontend
VITE_DEBUG=true npm run dev

# Backend
DEBUG=true npm run serve
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Add tests for new functionality
- Update documentation as needed
- Ensure all tests pass before submitting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Google Gemini AI** for powerful multi-modal processing
- **Firebase** for serverless infrastructure
- **React Team** for the excellent UI framework
- **TailwindCSS** for utility-first styling
- **add-to-calendar-button** for calendar integration

## 📞 Support

- **Documentation**: [Technical Design Document](TECHNICAL_DESIGN_DOCUMENT.md)
- **Issues**: Create an issue in this repository
- **Contact**: [Tharun Poduru](https://tharunpoduru.com)

---

**Built with ❤️ by Tharun Poduru**

*SynthiCal AI - Making event management intelligent and effortless.*
