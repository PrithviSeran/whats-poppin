# New iOS Notifications Setup

This document describes the new notification features that have been added to the What's Poppin app.

## 🆕 New Notification Types

### 1. New Follower Notifications
- **Trigger**: When someone follows you
- **Message**: "New Follower! 🎉 [Follower Name] started following you"
- **Action**: Navigate to Friends modal (followers tab)
- **Settings**: Can be enabled/disabled in notification settings

### 2. New Events from Following Notifications
- **Trigger**: When someone you follow creates an event
- **Message**: "New Event from Someone You Follow! 🎈 [Creator Name] created '[Event Name]'"
- **Action**: Navigate to events list
- **Settings**: Can be enabled/disabled in notification settings

## 🔧 Implementation Details

### Frontend Changes

#### NotificationService.ts
- Added `newFollowers` and `newEventsFromFollowing` to `NotificationSettings` interface
- Added `scheduleNewFollowerNotification()` method
- Added `scheduleNewEventFromFollowingNotification()` method
- Updated notification response handler to handle new notification types

#### NotificationSettings.tsx
- Added UI toggles for new notification types
- Updated default settings to enable new notifications by default

#### SocialDataManager.tsx
- Added notification trigger in `followUser()` method
- Sends notification to followed user when someone follows them

#### CreateEventScreen.tsx
- Added call to Supabase Edge Function after successful event creation
- Sends notifications to all followers of the event creator

### Backend Changes

#### Supabase Edge Function: `send-event-notifications`
- **Location**: `supabase/functions/send-event-notifications/index.ts`
- **Purpose**: Sends push notifications to followers when an event is created
- **Parameters**: `eventId`, `eventName`, `creatorId`, `creatorName`
- **Process**:
  1. Gets all followers of the event creator
  2. Retrieves their push tokens from `user_push_tokens` table
  3. Sends notifications via Expo's push service
  4. Returns success/failure statistics

## 🚀 Deployment Steps

### 1. Deploy the Supabase Edge Function
```bash
# Navigate to the function directory
cd supabase/functions/send-event-notifications

# Deploy the function
supabase functions deploy send-event-notifications
```

### 2. Update Database Schema
The existing `user_push_tokens` table should already be set up. If not, run:
```sql
-- Execute the contents of scripts/create_notification_tables.sql in your Supabase SQL editor
```

### 3. Test the Implementation
1. **Test New Follower Notifications**:
   - Have User A follow User B
   - User B should receive a notification

2. **Test New Event Notifications**:
   - Have User A follow User B
   - User B creates an event
   - User A should receive a notification

3. **Test Notification Settings**:
   - Go to Profile → Notification Settings
   - Toggle the new notification types on/off
   - Verify notifications respect the settings

## 🔍 Testing

### Manual Testing
1. **Follow Notification Test**:
   ```typescript
   // In UserProfileModal.tsx, after successful follow
   const notificationService = NotificationService.getInstance();
   await notificationService.scheduleNewFollowerNotification('Test User');
   ```

2. **Event Creation Test**:
   ```typescript
   // In CreateEventScreen.tsx, after event creation
   const { error } = await supabase.functions.invoke('send-event-notifications', {
     body: {
       eventId: 123,
       eventName: 'Test Event',
       creatorId: 456,
       creatorName: 'Test Creator'
     }
   });
   ```

### Automated Testing
Use the test method in NotificationService:
```typescript
const notificationService = NotificationService.getInstance();
await notificationService.testAllNotifications();
```

## 🛠️ Troubleshooting

### Common Issues

1. **Notifications not sending**:
   - Check if user has granted notification permissions
   - Verify push tokens are saved in database
   - Check Supabase function logs for errors

2. **Edge Function errors**:
   - Verify function is deployed correctly
   - Check function logs in Supabase dashboard
   - Ensure proper authentication headers

3. **Database issues**:
   - Verify `user_push_tokens` table exists
   - Check RLS policies are configured correctly
   - Ensure proper indexes are created

### Debug Logs
The implementation includes comprehensive logging:
- `🔔 New follower notification sent`
- `✅ Notifications sent to followers`
- `⚠️ Error sending notifications to followers`

## 📱 iOS Specific Notes

- Notifications require a physical device for testing
- Simulators cannot receive push notifications
- Ensure proper Apple Developer account setup
- Verify APNs certificate is configured correctly

## 🔐 Security Considerations

- All database operations use Row Level Security (RLS)
- Push tokens are stored securely in `user_push_tokens` table
- Notifications respect user privacy settings
- Edge function validates all input parameters

## 📊 Analytics (Optional)

You can track notification engagement by:
1. Logging notification opens in `handleNotificationResponse`
2. Storing analytics in the `notification_logs` table
3. Creating dashboards in Supabase

## 🚀 Future Enhancements

Potential improvements:
1. **Batch notifications**: Group multiple events from same creator
2. **Smart timing**: Avoid sending notifications during quiet hours
3. **Rich notifications**: Include event images in notifications
4. **Custom sounds**: Different sounds for different notification types
5. **Notification history**: View past notifications in app

---

**Note**: This implementation follows the existing notification architecture and maintains consistency with current patterns in the codebase. 