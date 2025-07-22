import { initializeApp } from 'firebase/app';
import { getAnalytics, logEvent } from 'firebase/analytics';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "synthicalai.firebaseapp.com",
  projectId: "synthicalai",
  storageBucket: "synthicalai.appspot.com",
  messagingSenderId: "589697045748", 
  appId: "1:589697045748:web:1b8948a07273103bb337e0",
  measurementId: "G-E5X5YQBYR4"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Analytics directly (simplify from previous approach)
let analytics = null;
try {
  analytics = getAnalytics(app);
  // Send initial app_loaded event to register the app
  logEvent(analytics, 'app_loaded', {
    timestamp: new Date().toISOString(),
    app_version: '1.0.0'
  });
  console.log('Firebase Analytics initialized successfully');
} catch (error) {
  console.error('Firebase Analytics initialization error:', error);
}

// Track specific actions
const trackEvent = (eventName, eventParams = {}) => {
  try {
    if (analytics) {
      logEvent(analytics, eventName, {
        ...eventParams,
        timestamp: new Date().toISOString()
      });
      console.log(`Tracked event: ${eventName}`);
      return true;
    }
  } catch (error) {
    console.error(`Error tracking ${eventName}:`, error);
  }
  return false;
};

export { app, analytics, trackEvent };
