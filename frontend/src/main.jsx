import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initAnalytics } from './analytics.js'

// Optional: set VITE_GA_MEASUREMENT_ID in build env to enable GA4
if (import.meta.env.VITE_GA_MEASUREMENT_ID) {
  initAnalytics(import.meta.env.VITE_GA_MEASUREMENT_ID)
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
