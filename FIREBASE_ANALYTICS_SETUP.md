# Firebase Analytics Setup Guide for Whats Poppin

This guide will help you set up Firebase Analytics for comprehensive in-app tracking in your Whats Poppin app.

## 🚀 Quick Setup

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `whats-poppin-app`
4. Enable Google Analytics (recommended)
5. Choose Analytics account or create new one
6. Click "Create project"

### Step 2: Add Your App to Firebase

#### For iOS:
1. Click "Add app" → iOS
2. Bundle ID: `com.prithviseran.whatspoppin`
3. App nickname: "Whats Poppin iOS"
4. Download `GoogleService-Info.plist`
5. Add it to your iOS project at `ios/whatspoppin/GoogleService-Info.plist`

#### For Android:
1. Click "Add app" → Android
2. Package name: `com.prithviseran.whatspoppin`
3. App nickname: "Whats Poppin Android"
4. Download `google-services.json`
5. Add it to your Android project at `android/app/google-services.json`

### Step 3: Configure Firebase

1. Copy your Firebase config from the Firebase Console
2. Run the setup script: `node scripts/create-firebase-project.js`
3. Follow the prompts to enter your Firebase configuration values

## 📊 Analytics Events Being Tracked

### Automatic Events
- **Screen Views**: Every screen visit is automatically tracked
- **App Lifecycle**: App open/close events
- **User Properties**: User demographics, preferences, and behavior

### User Actions
- **Sign Up/Sign In/Sign Out**: Authentication events with method tracking
- **Profile Updates**: When users update their profile information
- **Image Updates**: When users change profile/banner images

### Event Interactions
- **Event Views**: When users tap on event cards
- **Event Saves**: When users swipe right or save events
- **Event Unsaves**: When users remove saved events
- **Event Rejects**: When users swipe left or reject events
- **Event Shares**: When users share events

### Swipe Actions
- **Swipe Right**: Event saved with event details
- **Swipe Left**: Event rejected with event details

### Navigation
- **Tab Switches**: When users switch between tabs
- **Deep Links**: When users open the app via deep links

### Search & Filters
- **Search Performed**: Search queries and result counts
- **Filter Applied**: Filter types and values

### Error Tracking
- **Error Occurred**: Errors with context, screen name, and error codes

## 🔧 Configuration Files

### 1. Firebase Configuration (`lib/firebase-config.ts`)
```typescript
export const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id",
  measurementId: "your-measurement-id"
};
```

### 2. App Configuration (`app.config.js`)
```javascript
plugins: [
  // ... other plugins
  [
    "expo-firebase-core",
    {
      "projectId": "your-project-id"
    }
  ],
  "expo-firebase-analytics"
]
```

## 📱 Integration Examples

### Using Analytics in Components
```typescript
import { useAnalytics } from '@/hooks/useAnalytics';

export default function MyComponent() {
  const { trackEventInteraction, trackSwipeAction } = useAnalytics();
  
  const handleEventSave = (event) => {
    trackEventInteraction(event.id, event.name, 'save');
    trackSwipeAction('right', event.id, event.name);
  };
  
  const handleEventReject = (event) => {
    trackEventInteraction(event.id, event.name, 'reject');
    trackSwipeAction('left', event.id, event.name);
  };
}
```

### Automatic Screen Tracking
```typescript
import { useScreenTracking } from '@/hooks/useAnalytics';
import { ScreenName } from '@/lib/firebase-analytics';

export default function MyScreen() {
  useScreenTracking(ScreenName.HOME);
  // Screen view is automatically tracked
}
```

### Higher-Order Component
```typescript
import { withAnalytics } from '@/components/withAnalytics';

const MyComponentWithAnalytics = withAnalytics(MyComponent, ScreenName.HOME);
```

## 🎯 User Properties Tracked

- **User ID**: Unique user identifier
- **User Email**: User's email address
- **User Gender**: User's gender preference
- **User Birthday**: User's birth date
- **User Location**: User's location preference
- **Preferred Event Types**: User's event type preferences
- **Travel Distance**: User's travel distance preference
- **Friends Count**: Number of friends
- **Saved Events Count**: Number of saved events

## 📈 Firebase Console Dashboard

After setup, you can view analytics data in:

1. **Firebase Console**: https://console.firebase.google.com/
2. **Analytics Dashboard**: https://console.firebase.google.com/project/_/analytics
3. **Events**: View all tracked events and their parameters
4. **User Properties**: View user demographics and behavior
5. **Audiences**: Create user segments based on behavior

## 🚀 Testing Analytics

### 1. Start the App
```bash
npx expo start
```

### 2. Test Events
- Navigate between screens (screen views)
- Swipe events left/right (swipe actions)
- Save/unsave events (event interactions)
- Switch tabs (tab switches)
- Search for events (search actions)

### 3. Check Data
- Data may take 24-48 hours to appear in Firebase Console
- Real-time events appear in DebugView (if enabled)
- Check Events section for custom events

## 🔍 Debugging

### Enable Debug Mode
```typescript
// In your app initialization
import { setAnalyticsCollectionEnabled } from 'expo-firebase-analytics';

// Enable debug mode
await setAnalyticsCollectionEnabled(true);
```

### Check Console Logs
All analytics events are logged to the console with the format:
```
📊 Event tracked: event_name {parameters}
📊 Screen tracked: ScreenName
👤 User property set: property_name = value
```

## 📋 Troubleshooting

### Common Issues

1. **Events not appearing**: Check Firebase configuration and network connectivity
2. **Screen tracking not working**: Ensure `useScreenTracking` is called in components
3. **User properties not set**: Verify user is signed in before setting properties
4. **Configuration errors**: Run setup script again to verify configuration

### Verification Steps

1. Check Firebase files exist:
   - `ios/whatspoppin/GoogleService-Info.plist`
   - `android/app/google-services.json`

2. Verify configuration:
   - Run `node scripts/create-firebase-project.js`
   - Check `lib/firebase-config.ts` has real values

3. Test analytics:
   - Use debug mode to see real-time events
   - Check console logs for analytics messages

## 🔗 Useful Links

- [Firebase Console](https://console.firebase.google.com/)
- [Firebase Analytics Documentation](https://firebase.google.com/docs/analytics)
- [Expo Firebase Documentation](https://docs.expo.dev/guides/using-firebase/)
- [Analytics Events Reference](https://firebase.google.com/docs/analytics/events)

## 📊 Analytics Dashboard Features

Once set up, you'll have access to:

- **Real-time Analytics**: Live user activity
- **User Demographics**: Age, gender, location
- **User Behavior**: Session duration, screen views
- **Event Analysis**: Most popular events, user engagement
- **Conversion Tracking**: User journey analysis
- **Custom Reports**: Create custom analytics reports

## 🎉 Success Metrics

Track these key metrics for your app:

- **User Engagement**: Daily/Monthly active users
- **Event Discovery**: Events viewed per session
- **User Retention**: User return rates
- **Event Preferences**: Most popular event types
- **Geographic Data**: User location patterns
- **User Journey**: Path from signup to event save

---

**Note**: Analytics data may take 24-48 hours to appear in the Firebase Console. Real-time events can be viewed in DebugView during development. 