#!/bin/bash

echo "🚀 Deploying follow notification Edge Function..."

# Deploy the function
supabase functions deploy send-follow-notification

echo "✅ Follow notification function deployed successfully!"
echo ""
echo "📱 The function will now send push notifications to users when someone follows them"
echo "🔔 Users will receive notifications on their devices instead of local notifications"
echo ""
echo "To test:"
echo "1. Follow another user in the app"
echo "2. The followed user should receive a push notification"
echo "3. Check the Supabase logs for any errors"
