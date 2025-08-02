#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔥 Firebase Setup for Whats Poppin');
console.log('=====================================\n');

console.log('📋 Manual Setup Steps:');
console.log('1. Go to https://console.firebase.google.com/');
console.log('2. Click "Create a project"');
console.log('3. Enter project name: "whats-poppin-app"');
console.log('4. Enable Google Analytics (recommended)');
console.log('5. Choose Analytics account or create new one');
console.log('6. Click "Create project"\n');

console.log('📱 Adding Your App:');
console.log('1. In your Firebase project, click "Add app"');
console.log('2. Select your platform (iOS/Android)');
console.log('3. Use these details:');
console.log('   - iOS Bundle ID: com.prithviseran.whatspoppin');
console.log('   - Android Package: com.prithviseran.whatspoppin');
console.log('4. Download the config files');
console.log('5. Place them in the correct locations\n');

console.log('📁 File Locations:');
console.log('- iOS: ios/whatspoppin/GoogleService-Info.plist');
console.log('- Android: android/app/google-services.json\n');

console.log('⚙️ Configuration:');
console.log('1. Copy your Firebase config from the Firebase Console');
console.log('2. Update lib/firebase-config.ts with your project details');
console.log('3. Update app.config.js with your Firebase project ID\n');

console.log('🚀 After Setup:');
console.log('1. Run: npx expo start');
console.log('2. Test analytics in your app');
console.log('3. Check Firebase Console for data\n');

console.log('📊 Analytics Events to Track:');
console.log('- Screen views (automatic)');
console.log('- User sign up/in/out');
console.log('- Event interactions (save, unsave, reject, view, share)');
console.log('- Swipe actions (left/right)');
console.log('- Tab switches');
console.log('- Search and filters');
console.log('- Errors with context');
console.log('- App lifecycle events\n');

console.log('🔗 Useful Links:');
console.log('- Firebase Console: https://console.firebase.google.com/');
console.log('- Expo Firebase Docs: https://docs.expo.dev/guides/using-firebase/');
console.log('- Analytics Events: https://firebase.google.com/docs/analytics/events\n');

// Check if Firebase files exist
const iosConfigPath = path.join(__dirname, '../ios/whatspoppin/GoogleService-Info.plist');
const androidConfigPath = path.join(__dirname, '../android/app/google-services.json');

console.log('📂 Checking Firebase files:');
if (fs.existsSync(iosConfigPath)) {
  console.log('✅ iOS config found');
} else {
  console.log('❌ iOS config missing - add GoogleService-Info.plist');
}

if (fs.existsSync(androidConfigPath)) {
  console.log('✅ Android config found');
} else {
  console.log('❌ Android config missing - add google-services.json');
}

console.log('\n🎯 Next Steps:');
console.log('1. Create Firebase project manually');
console.log('2. Add config files');
console.log('3. Update configuration');
console.log('4. Test analytics tracking');
console.log('5. View data in Firebase Console\n'); 