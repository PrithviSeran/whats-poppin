#!/bin/bash

echo "🚀 Deploying weekend notifications Edge Function..."

# Deploy the Edge Function
supabase functions deploy send-weekend-notifications

if [ $? -eq 0 ]; then
    echo "✅ Weekend notifications function deployed successfully!"
    echo ""
    echo "📅 Scheduled notifications:"
    echo "  - Friday: 2:00 PM UTC (10:00 AM EST, 7:00 AM PST)"
    echo "  - Saturday: 12:00 PM UTC (8:00 AM EST, 5:00 AM PST)"
    echo "  - Tuesday: 5:40 PM UTC (1:40 PM EST, 10:40 AM PST)"
    echo ""
    echo "🔧 To test manually:"
    echo "  - Go to GitHub Actions > Weekend Notifications > Run workflow"
    echo "  - Or call: curl -X POST 'YOUR_SUPABASE_URL/functions/v1/send-weekend-notifications'"
    echo ""
    echo "📱 Users will receive notifications based on their timezone!"
else
    echo "❌ Failed to deploy weekend notifications function"
    exit 1
fi
