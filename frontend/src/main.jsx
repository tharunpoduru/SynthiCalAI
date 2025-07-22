import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/App.css'
import { app, analytics, trackEvent } from './firebase.js' // Import Firebase app and trackEvent

// Initialize Firebase app (side effect)
console.log('Firebase initialized with app name:', app.name);

// Log page view event
if (analytics) {
  console.log('Analytics is available - logging pageview');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
