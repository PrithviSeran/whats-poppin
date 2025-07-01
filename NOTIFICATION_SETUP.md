# Notification System Setup Guide

This guide will help you set up push notifications for your What's Poppin app using Expo's notification system and your Apple Developer account.

## 🚀 Quick Start

### 1. Install Dependencies
The required dependencies have already been added to your `package.json`:
- `expo-notifications`: Core notification functionality
- `expo-device`: Device detection for permissions

### 2. Database Setup
Run the SQL script to create the necessary database tables:

```sql
-- Execute the contents of scripts/create_notification_tables.sql in your Supabase SQL editor
```

This creates:
- `user_push_tokens` table for storing device tokens
- `notification_logs` table for debugging (optional)
- Proper indexes and security policies

### 3. App Configuration
Your `app.config.js` has been updated with:
- iOS notification permissions
- Android notification permissions
- Expo notifications plugin configuration

## 📱 iOS Setup (Apple Developer Account Required)

### 1. Create Push Notification Certificate
1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to Certificates, Identifiers & Profiles
3. Create a new APNs (Apple Push Notification service) certificate
4. Download and install the certificate

### 2. Configure Expo Project
1. Run `eas build:configure` to set up EAS Build
2. Add your Apple Developer Team ID to `eas.json`:
```json
{
  "build": {
    "production": {
      "ios": {
        "teamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

### 3. Build for iOS
```bash
eas build --platform ios
```

## 🤖 Android Setup

### 1. Firebase Configuration (Optional for Expo)
If you want to use Firebase for Android notifications:
1. Create a Firebase project
2. Download `google-services.json`
3. Add it to your project root

### 2. Build for Android
```bash
eas build --platform android
```

## 🔧 Implementation Details

### NotificationService
The `NotificationService` class provides:
- Permission management
- Token registration
- Local notification scheduling
- Settings management

### Key Features
- **Friend Request Notifications**: When someone sends a friend request
- **Event Reminders**: 1 hour before saved events
- **New Events**: When new events match user preferences
- **Marketing**: App updates and promotional content (optional)

### Usage Examples

#### Schedule Event Reminder
```typescript
const notificationService = NotificationService.getInstance();
await notificationService.scheduleEventReminder(
  eventId,
  eventName,
  eventTime
);
```

#### Send Friend Request Notification
```typescript
await notificationService.scheduleFriendRequestNotification(senderName);
```

#### Send New Events Notification
```typescript
await notificationService.scheduleNewEventsNotification(eventCount);
```

## 🎨 UI Integration

### Notification Settings
Users can access notification settings from the Profile screen:
- Toggle different notification types
- Test notifications
- Reset to defaults

### Badge Count Management
```typescript
// Set badge count
await notificationService.setBadgeCount(5);

// Clear badge count
await notificationService.clearBadgeCount();
```

## 🔔 Notification Types

### 1. Friend Requests
- **Trigger**: When someone sends a friend request
- **Action**: Navigate to Friends modal
- **Settings**: Can be disabled in notification settings

### 2. Event Reminders
- **Trigger**: 1 hour before saved events
- **Action**: Navigate to specific event
- **Settings**: Can be disabled in notification settings

### 3. New Events
- **Trigger**: When new events match user preferences
- **Action**: Navigate to events list
- **Settings**: Can be disabled in notification settings

### 4. Marketing
- **Trigger**: App updates and promotional content
- **Action**: Navigate to relevant screen
- **Settings**: Can be disabled in notification settings

## 🛠️ Testing

### Local Testing
1. Use the "Test Notification" button in notification settings
2. Check console logs for debugging information
3. Verify permissions are granted

### Device Testing
1. Build and install the app on a physical device
2. Grant notification permissions
3. Test different notification scenarios

## 🔍 Debugging

### Common Issues
1. **Permissions not granted**: Check device settings
2. **Tokens not saved**: Verify database connection
3. **Notifications not showing**: Check notification settings

### Debug Logs
The notification service logs all activities:
```typescript
console.log('🔔 Notification service logs');
console.log('📱 Push token:', token);
console.log('✅ Notification scheduled:', id);
```

## 📊 Analytics (Optional)

You can track notification engagement by:
1. Logging notification opens in `handleNotificationResponse`
2. Storing analytics in the `notification_logs` table
3. Creating dashboards in Supabase

## 🔐 Security

### Row Level Security
- Users can only access their own push tokens
- Notification logs are user-scoped
- Proper authentication required

### Token Management
- Old tokens are automatically deactivated
- Unique tokens per user per platform
- Secure token storage in database

## 🚀 Production Deployment

### 1. Environment Variables
Ensure these are set in your production environment:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### 2. EAS Build
```bash
# Production build
eas build --platform all --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

### 3. Monitoring
- Monitor notification delivery rates
- Track user engagement
- Handle failed notifications

## 📚 Additional Resources

- [Expo Notifications Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Apple Push Notification Service](https://developer.apple.com/documentation/usernotifications)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)

## 🆘 Support

If you encounter issues:
1. Check the console logs for error messages
2. Verify all dependencies are installed
3. Ensure database tables are created
4. Test on physical devices (not simulators)

---

**Note**: Push notifications require a physical device for testing. Simulators cannot receive push notifications. 