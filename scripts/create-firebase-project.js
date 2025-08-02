#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔥 Firebase Project Setup for Whats Poppin');
console.log('===========================================\n');

console.log('📋 This script will help you create and configure Firebase for your app.\n');

// Step 1: Create Firebase Project
console.log('STEP 1: Create Firebase Project');
console.log('1. Go to https://console.firebase.google.com/');
console.log('2. Click "Create a project"');
console.log('3. Enter project name: "whats-poppin-app"');
console.log('4. Enable Google Analytics (recommended)');
console.log('5. Choose Analytics account or create new one');
console.log('6. Click "Create project"\n');

// Step 2: Add Apps
console.log('STEP 2: Add Your Apps');
console.log('After creating the project, add both iOS and Android apps:\n');

console.log('📱 iOS App:');
console.log('1. Click "Add app" → iOS');
console.log('2. Bundle ID: com.prithviseran.whatspoppin');
console.log('3. App nickname: Whats Poppin iOS');
console.log('4. Download GoogleService-Info.plist');
console.log('5. Place it in: ios/whatspoppin/GoogleService-Info.plist\n');

console.log('🤖 Android App:');
console.log('1. Click "Add app" → Android');
console.log('2. Package name: com.prithviseran.whatspoppin');
console.log('3. App nickname: Whats Poppin Android');
console.log('4. Download google-services.json');
console.log('5. Place it in: android/app/google-services.json\n');

// Step 3: Get Configuration
console.log('STEP 3: Get Firebase Configuration');
console.log('1. In your Firebase project, click the gear icon (Project Settings)');
console.log('2. Scroll down to "Your apps" section');
console.log('3. Click on your app');
console.log('4. Copy the configuration values\n');

// Function to update configuration
async function updateConfiguration() {
  return new Promise((resolve) => {
    console.log('🔧 Configuration Setup');
    console.log('Enter your Firebase configuration values:\n');

    rl.question('Firebase API Key: ', (apiKey) => {
      rl.question('Firebase Project ID: ', (projectId) => {
        rl.question('Firebase Auth Domain: ', (authDomain) => {
          rl.question('Firebase Storage Bucket: ', (storageBucket) => {
            rl.question('Firebase Messaging Sender ID: ', (messagingSenderId) => {
              rl.question('Firebase App ID: ', (appId) => {
                rl.question('Firebase Measurement ID (optional): ', (measurementId) => {
                  
                  // Update firebase-config.ts
                  const configPath = path.join(__dirname, '../lib/firebase-config.ts');
                  let configContent = fs.readFileSync(configPath, 'utf8');
                  
                  configContent = configContent.replace(/apiKey: "YOUR_API_KEY"/, `apiKey: "${apiKey}"`);
                  configContent = configContent.replace(/authDomain: "YOUR_PROJECT_ID\.firebaseapp\.com"/, `authDomain: "${authDomain}"`);
                  configContent = configContent.replace(/projectId: "YOUR_PROJECT_ID"/, `projectId: "${projectId}"`);
                  configContent = configContent.replace(/storageBucket: "YOUR_PROJECT_ID\.appspot\.com"/, `storageBucket: "${storageBucket}"`);
                  configContent = configContent.replace(/messagingSenderId: "YOUR_MESSAGING_SENDER_ID"/, `messagingSenderId: "${messagingSenderId}"`);
                  configContent = configContent.replace(/appId: "YOUR_APP_ID"/, `appId: "${appId}"`);
                  
                  if (measurementId && measurementId.trim() !== '') {
                    configContent = configContent.replace(/measurementId: "YOUR_MEASUREMENT_ID"/, `measurementId: "${measurementId}"`);
                  }
                  
                  configContent = configContent.replace(/export const FIREBASE_PROJECT_ID = "YOUR_PROJECT_ID";/, `export const FIREBASE_PROJECT_ID = "${projectId}";`);
                  
                  fs.writeFileSync(configPath, configContent);
                  console.log('✅ Updated lib/firebase-config.ts\n');
                  
                  // Update app.config.js
                  const appConfigPath = path.join(__dirname, '../app.config.js');
                  let appConfigContent = fs.readFileSync(appConfigPath, 'utf8');
                  
                  // Add Firebase project ID to expo-firebase-core plugin
                  const firebasePluginConfig = `[
        "expo-firebase-core",
        {
          "projectId": "${projectId}"
        }
      ]`;
                  
                  appConfigContent = appConfigContent.replace(
                    /\[
        "expo-firebase-core",
        \{
          \/\/ Firebase configuration will be added here
          \/\/ You'll need to add your Firebase project configuration
        \}
      \]/,
                    firebasePluginConfig
                  );
                  
                  fs.writeFileSync(appConfigPath, appConfigContent);
                  console.log('✅ Updated app.config.js\n');
                  
                  resolve();
                });
              });
            });
          });
        });
      });
    });
  });
}

// Function to check if Firebase files exist
function checkFirebaseFiles() {
  console.log('📂 Checking Firebase Configuration Files:\n');
  
  const iosConfigPath = path.join(__dirname, '../ios/whatspoppin/GoogleService-Info.plist');
  const androidConfigPath = path.join(__dirname, '../android/app/google-services.json');
  
  let allFilesExist = true;
  
  if (fs.existsSync(iosConfigPath)) {
    console.log('✅ iOS config found: ios/whatspoppin/GoogleService-Info.plist');
  } else {
    console.log('❌ iOS config missing: ios/whatspoppin/GoogleService-Info.plist');
    allFilesExist = false;
  }
  
  if (fs.existsSync(androidConfigPath)) {
    console.log('✅ Android config found: android/app/google-services.json');
  } else {
    console.log('❌ Android config missing: android/app/google-services.json');
    allFilesExist = false;
  }
  
  return allFilesExist;
}

// Main execution
async function main() {
  console.log('🚀 Starting Firebase setup...\n');
  
  // Check if Firebase files exist
  const filesExist = checkFirebaseFiles();
  
  if (!filesExist) {
    console.log('\n⚠️  Please add the Firebase configuration files first.');
    console.log('Then run this script again to update the configuration.\n');
    rl.close();
    return;
  }
  
  console.log('✅ All Firebase files found!\n');
  
  // Ask if user wants to update configuration
  rl.question('Do you want to update the Firebase configuration now? (y/n): ', async (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      await updateConfiguration();
      
      console.log('🎉 Firebase setup complete!');
      console.log('\n📊 Analytics Events That Will Be Tracked:');
      console.log('- Screen views (automatic)');
      console.log('- User sign up/in/out');
      console.log('- Event interactions (save, unsave, reject, view, share)');
      console.log('- Swipe actions (left/right)');
      console.log('- Tab switches');
      console.log('- Search and filters');
      console.log('- Errors with context');
      console.log('- App lifecycle events\n');
      
      console.log('🚀 Next Steps:');
      console.log('1. Run: npx expo start');
      console.log('2. Test analytics in your app');
      console.log('3. Check Firebase Console for data (may take 24-48 hours)\n');
      
      console.log('🔗 Useful Links:');
      console.log('- Firebase Console: https://console.firebase.google.com/');
      console.log('- Analytics Dashboard: https://console.firebase.google.com/project/_/analytics');
      console.log('- Expo Firebase Docs: https://docs.expo.dev/guides/using-firebase/\n');
      
    } else {
      console.log('\n📝 Configuration not updated. You can run this script again later.');
    }
    
    rl.close();
  });
}

main().catch(console.error); 