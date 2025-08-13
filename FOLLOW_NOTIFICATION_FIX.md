# Follow Notification Fix

## Problem Description

When a user follows another user, the notification system was incorrectly sending a local notification to the follower's device instead of sending a push notification to the followed user's device. This resulted in users seeing notifications like "You started following yourself" instead of the intended "User X started following you".

## Root Cause

The issue was in the `SocialDataManager.tsx` file in the `followUser` method. The code was calling:

```typescript
await notificationService.scheduleNewFollowerNotification(followerData.name);
```

This method creates a **local notification** on the current device (the follower's device), which is incorrect. The notification should be sent to the **followed user's device** as a **push notification**.

## Solution

### 1. Created New Supabase Edge Function

Created `supabase/functions/send-follow-notification/index.ts` that:
- Receives follower and followed user information
- Looks up the followed user's push token from the database
- Sends a push notification to the followed user's device using Expo's push service
- Logs the notification for debugging purposes

### 2. Updated SocialDataManager.tsx

Modified the `followUser` method to:
- Remove the local notification call
- Call the new Edge Function to send push notifications
- Pass the correct user information (follower ID, follower name, followed ID, followed email)

### 3. Key Changes Made

**Before (Incorrect):**
```typescript
// Send notification to the followed user
try {
  const notificationService = NotificationService.getInstance();
  const settings = await notificationService.getNotificationSettings();
  
  if (settings.enabled && settings.newFollowers) {
    // Get follower's name for the notification
    const { data: followerData } = await supabase
      .from('all_users')
      .select('name')
      .eq('id', followerId)
      .single();

    if (followerData?.name) {
      await notificationService.scheduleNewFollowerNotification(followerData.name);
      console.log('🔔 New follower notification sent');
    }
  }
} catch (notificationError) {
  console.warn('⚠️ Error sending new follower notification:', notificationError);
}
```

**After (Correct):**
```typescript
// Send notification to the followed user
try {
  // Get follower's name for the notification
  const { data: followerData } = await supabase
    .from('all_users')
    .select('name')
    .eq('id', followerId)
    .single();

  // Get followed user's email for the notification
  const { data: followedUserData } = await supabase
    .from('all_users')
    .select('email')
    .eq('id', followedId)
    .single();

  if (followerData?.name && followedUserData?.email) {
    // Call the Supabase Edge Function to send push notification
    const { error: notificationError } = await supabase.functions.invoke('send-follow-notification', {
      body: {
        followerId: followerId,
        followerName: followerData.name,
        followedId: followedId,
        followedEmail: followedUserData.email
      }
    });

    if (notificationError) {
      console.warn('⚠️ Error sending new follower notification:', notificationError);
    } else {
      console.log('🔔 New follower notification sent via push notification');
    }
  }
} catch (notificationError) {
  console.warn('⚠️ Error sending new follower notification:', notificationError);
}
```

## Deployment Steps

### 1. Deploy the Edge Function

```bash
# Make the deployment script executable
chmod +x deploy-follow-notifications.sh

# Deploy the function
./deploy-follow-notifications.sh
```

Or manually:
```bash
supabase functions deploy send-follow-notification
```

### 2. Verify Deployment

Check that the function is deployed successfully in your Supabase dashboard under Functions.

### 3. Test the Fix

1. Have two users in the app
2. User A follows User B
3. User B should receive a push notification saying "User A started following you"
4. User A should NOT receive any notification

## How It Works Now

1. **User A follows User B**
2. **SocialDataManager.followUser()** is called
3. **Edge Function is invoked** with user information
4. **Edge Function looks up** User B's push token
5. **Push notification is sent** to User B's device via Expo's push service
6. **User B receives notification** on their device

## Benefits of This Fix

- ✅ **Correct recipient**: Notifications go to the followed user, not the follower
- ✅ **Push notifications**: Uses proper push notification system instead of local notifications
- ✅ **Cross-device**: Works even when the followed user is not actively using the app
- ✅ **Scalable**: Uses Supabase Edge Functions for reliable delivery
- ✅ **Consistent**: Follows the same pattern as other notification types in the app

## Database Requirements

Ensure your database has the `user_push_tokens` table set up as described in `scripts/create_notification_tables.sql`. This table stores:
- User ID and email
- Push token for each device
- Platform information (iOS/Android)
- Active status

## Troubleshooting

### Common Issues

1. **Function not deployed**: Check Supabase dashboard for function status
2. **No push tokens**: Ensure users have granted notification permissions
3. **Database errors**: Check that `user_push_tokens` table exists and has data
4. **Permission errors**: Verify RLS policies are set correctly

### Debug Steps

1. Check Supabase function logs for errors
2. Verify push tokens are being saved to database
3. Test with Expo's push notification tool
4. Check device notification settings

## Related Files

- `lib/SocialDataManager.tsx` - Main logic for follow operations
- `supabase/functions/send-follow-notification/index.ts` - Push notification function
- `deploy-follow-notifications.sh` - Deployment script
- `scripts/create_notification_tables.sql` - Database setup
- `lib/NotificationService.ts` - Local notification service (no longer used for follows)
