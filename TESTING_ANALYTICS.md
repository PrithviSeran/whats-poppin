# Testing Firebase Analytics Guide

## 🧪 Current Setup: Test Mode

Your app is currently running in **TEST MODE** for analytics. This means:

- ✅ All analytics events are logged to the console
- ✅ No Firebase project setup required
- ✅ You can see real-time analytics data in the console
- ✅ All tracking functions work exactly like the real Firebase implementation

## 📊 How to Test Analytics

### Step 1: Start the App
```bash
npx expo start
```

### Step 2: Watch Console Logs
Open your terminal/console and look for analytics logs with these prefixes:

- `📊 [TEST] Screen tracked:` - Screen views
- `📊 [TEST] Event tracked:` - Custom events
- `📊 [TEST] Event interaction tracked:` - Event saves/views/rejects
- `📊 [TEST] Swipe action tracked:` - Swipe left/right
- `📊 [TEST] Tab switch tracked:` - Tab navigation
- `👤 [TEST] User property set:` - User properties
- `❌ [TEST] Error tracked:` - Error events

### Step 3: Test Different Actions

#### 🏠 Screen Navigation
1. Navigate between tabs (Home, Explore, Profile)
2. **Expected Logs:**
   ```
   📊 [TEST] Screen tracked: { screen_name: "Home", screen_class: "Home", timestamp: "..." }
   📊 [TEST] Tab switch tracked: { tab_name: "explore", timestamp: "..." }
   ```

#### 🎯 Event Interactions
1. **Tap on an event card** to view details
2. **Swipe right** to save an event
3. **Swipe left** to reject an event
4. **Expected Logs:**
   ```
   📊 [TEST] Event interaction tracked: { event_id: 123, event_title: "Concert", action: "view", timestamp: "..." }
   📊 [TEST] Swipe action tracked: { event_id: 123, event_title: "Concert", swipe_direction: "right", timestamp: "..." }
   📊 [TEST] Event interaction tracked: { event_id: 123, event_title: "Concert", action: "save", timestamp: "..." }
   ```

#### 👤 User Actions
1. **Sign in/out** (if you have auth)
2. **Update profile** information
3. **Expected Logs:**
   ```
   📊 [TEST] User sign in tracked: { method: "email", user_id: "user123", timestamp: "..." }
   👤 [TEST] User property set: { property: "user_email", value: "user@example.com" }
   ```

#### 🔍 Search & Filters
1. **Search for events** (if search is implemented)
2. **Apply filters** (if filters are implemented)
3. **Expected Logs:**
   ```
   📊 [TEST] Search tracked: { search_term: "concert", results_count: 5, timestamp: "..." }
   📊 [TEST] Filter tracked: { filter_type: "event_type", filter_value: "music", timestamp: "..." }
   ```

## 📋 Test Checklist

### ✅ Basic Functionality
- [ ] App starts without errors
- [ ] Analytics initialization message appears
- [ ] Screen tracking works when navigating
- [ ] Tab switching is tracked

### ✅ Event Interactions
- [ ] Event card taps are tracked
- [ ] Swipe right (save) is tracked
- [ ] Swipe left (reject) is tracked
- [ ] Event details view is tracked

### ✅ User Properties
- [ ] User ID is set when signed in
- [ ] User properties are tracked
- [ ] Profile updates are tracked

### ✅ Error Handling
- [ ] Errors are logged with context
- [ ] Analytics doesn't crash the app
- [ ] Failed operations are tracked

## 🔍 Debugging Tips

### Check Analytics Summary
Add this to any component to see current analytics state:
```typescript
import { useAnalyticsTest } from '@/hooks/useAnalyticsTest';

const { getAnalyticsSummary } = useAnalyticsTest();
console.log('Analytics Summary:', getAnalyticsSummary());
```

### Test Specific Events
You can manually trigger events for testing:
```typescript
const { trackCustomEvent, trackEventInteraction } = useAnalyticsTest();

// Test custom event
trackCustomEvent('test_event', { test_param: 'test_value' });

// Test event interaction
trackEventInteraction(123, 'Test Event', 'save');
```

## 🚀 Switching to Real Firebase

When you're ready to use real Firebase Analytics:

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create project: `whats-poppin-app`
3. Enable Google Analytics

### Step 2: Add Configuration Files
1. **iOS**: Download `GoogleService-Info.plist` → `ios/whatspoppin/GoogleService-Info.plist`
2. **Android**: Download `google-services.json` → `android/app/google-services.json`

### Step 3: Update Configuration
1. Run: `node scripts/create-firebase-project.js`
2. Enter your Firebase configuration values
3. The script will update all necessary files

### Step 4: Switch to Real Analytics
Replace test imports with real ones:
```typescript
// Change from:
import { useAnalyticsTest } from '@/hooks/useAnalyticsTest';
import { testFirebaseAnalytics } from '@/lib/firebase-analytics-test';

// To:
import { useAnalytics } from '@/hooks/useAnalytics';
import { firebaseAnalytics } from '@/lib/firebase-analytics';
```

## 📊 Expected Analytics Data

Once you switch to real Firebase, you'll see:

### Real-time Events
- Screen views with user journey
- Event interactions (save/reject/view)
- User demographics and behavior
- App performance metrics

### User Properties
- User ID and email
- Location preferences
- Event type preferences
- Travel distance settings
- Friends count and saved events

### Custom Events
- `event_save` - When users save events
- `event_reject` - When users reject events
- `event_view` - When users view event details
- `swipe_right` - Right swipe actions
- `swipe_left` - Left swipe actions
- `tab_switch` - Tab navigation
- `user_sign_in` - Authentication events

## 🎯 Success Metrics

Track these key metrics in Firebase Console:

1. **User Engagement**
   - Daily/Monthly active users
   - Session duration
   - Screen views per session

2. **Event Discovery**
   - Events viewed per session
   - Most popular event types
   - Save vs reject ratios

3. **User Behavior**
   - Swipe patterns (left vs right)
   - Navigation patterns
   - Search and filter usage

4. **Retention**
   - User return rates
   - Feature adoption
   - User journey analysis

## 🔧 Troubleshooting

### Common Issues

1. **No analytics logs appearing**
   - Check that `useAnalyticsTest` is imported correctly
   - Verify the component is mounting
   - Check console for any errors

2. **Events not tracking**
   - Ensure the analytics hook is called
   - Check that event parameters are correct
   - Verify the function is being triggered

3. **Performance issues**
   - Analytics calls are asynchronous
   - They shouldn't block the UI
   - Check for any infinite loops

### Debug Commands

```bash
# Check if analytics is working
console.log('Analytics Summary:', getAnalyticsSummary());

# Test specific event
trackCustomEvent('debug_test', { debug: true });

# Check user properties
console.log('User Properties:', userProperties);
```

## 📈 Next Steps

1. **Test thoroughly** with the test implementation
2. **Create Firebase project** when ready
3. **Switch to real analytics** using the setup script
4. **Monitor data** in Firebase Console
5. **Optimize** based on analytics insights

---

**Note**: The test implementation provides the same functionality as real Firebase Analytics but logs to console instead of sending to Firebase. This allows you to test all analytics features without setting up a Firebase project first. 