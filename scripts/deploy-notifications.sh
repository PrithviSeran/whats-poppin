#!/bin/bash

# Deploy New Notifications Setup Script
# This script helps deploy the new notification features

echo "🚀 Deploying New Notification Features..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "supabase/functions/send-event-notifications/index.ts" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

echo "📦 Deploying Supabase Edge Function..."

# Deploy the send-event-notifications function
cd supabase/functions/send-event-notifications
supabase functions deploy send-event-notifications --project-ref $(grep -o 'project_id = "[^"]*"' ../../config.toml | cut -d'"' -f2)

if [ $? -eq 0 ]; then
    echo "✅ Edge function deployed successfully!"
else
    echo "❌ Failed to deploy edge function"
    exit 1
fi

cd ../../..

echo "🔧 Setting up database schema..."

# Check if notification tables exist
echo "📋 Checking notification tables..."
# You can add SQL commands here to verify/update the database schema

echo "🧪 Testing notification setup..."

# Create a simple test script
cat > test-notifications.js << 'EOF'
const { createClient } = require('@supabase/supabase-js');

// Test the notification function
async function testNotifications() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  try {
    const { data, error } = await supabase.functions.invoke('send-event-notifications', {
      body: {
        eventId: 999,
        eventName: 'Test Event',
        creatorId: 1,
        creatorName: 'Test Creator'
      }
    });

    if (error) {
      console.error('❌ Test failed:', error);
    } else {
      console.log('✅ Test successful:', data);
    }
  } catch (err) {
    console.error('❌ Test error:', err);
  }
}

testNotifications();
EOF

echo "📝 Test script created: test-notifications.js"
echo "   Run it with: node test-notifications.js"

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Test the notifications on a physical device"
echo "2. Verify notification settings work correctly"
echo "3. Check that followers receive notifications when events are created"
echo ""
echo "📚 For more information, see: NEW_NOTIFICATIONS_SETUP.md" 