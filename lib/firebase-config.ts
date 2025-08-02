// Firebase Configuration for Whats Poppin App
// 
// STEP 1: Create Firebase Project
// 1. Go to https://console.firebase.google.com/
// 2. Click "Create a project"
// 3. Enter project name: "whats-poppin-app"
// 4. Enable Google Analytics (recommended)
// 5. Choose Analytics account or create new one
// 6. Click "Create project"
//
// STEP 2: Add Your App
// 1. In your Firebase project, click "Add app"
// 2. Select your platform (iOS/Android)
// 3. Use these details:
//    - iOS Bundle ID: com.prithviseran.whatspoppin
//    - Android Package: com.prithviseran.whatspoppin
// 4. Download the config files
// 5. Place them in the correct locations:
//    - iOS: ios/whatspoppin/GoogleService-Info.plist
//    - Android: android/app/google-services.json
//
// STEP 3: Update Configuration
// Replace the placeholder values below with your actual Firebase project details

export const firebaseConfig = {
  // Your Firebase project configuration
  // Get these values from your Firebase Console under Project Settings
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID", // Optional, for web
};

// Firebase project ID for Expo configuration
export const FIREBASE_PROJECT_ID = "YOUR_PROJECT_ID";

// Check if Firebase is properly configured
export const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey !== "YOUR_API_KEY" && 
         firebaseConfig.projectId !== "YOUR_PROJECT_ID";
};

// Analytics configuration
export const analyticsConfig = {
  // Enable analytics collection
  enabled: true,
  
  // Custom user properties to track
  userProperties: {
    // These will be automatically set when users interact with the app
    user_id: '',
    user_email: '',
    user_gender: '',
    user_birthday: '',
    user_location: '',
    preferred_event_types: '',
    travel_distance: '',
    friends_count: '',
    saved_events_count: '',
  },
  
  // Events to track automatically
  autoTrackEvents: {
    screenViews: true,
    userSignUp: true,
    userSignIn: true,
    userSignOut: true,
    eventInteractions: true,
    swipeActions: true,
    tabSwitches: true,
    searchActions: true,
    filterActions: true,
    errors: true,
    appLifecycle: true,
  },
};

// Instructions for getting Firebase config values:
// 1. Go to Firebase Console: https://console.firebase.google.com/
// 2. Select your project
// 3. Click the gear icon (Project Settings)
// 4. Scroll down to "Your apps" section
// 5. Click on your app
// 6. Copy the configuration values
//
// For iOS, you'll also need to:
// 1. Download GoogleService-Info.plist
// 2. Add it to your iOS project at ios/whatspoppin/GoogleService-Info.plist
// 3. Update app.config.js with the iOS bundle ID
//
// For Android, you'll also need to:
// 1. Download google-services.json
// 2. Add it to your Android project at android/app/google-services.json
// 3. Update app.config.js with the Android package name
//
// After setup, test analytics by:
// 1. Running the app: npx expo start
// 2. Interacting with events (swipe, save, view)
// 3. Checking Firebase Console for data (may take 24-48 hours to appear) 