const { createClient } = require('@supabase/supabase-js');

// Configuration - you'll need to fill these in
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iizdmrngykraambvsbwv.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpemRtcm5neWtyYWFtYnZzYnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2Mzc5NDEsImV4cCI6MjA2MjIxMzk0MX0.ZmcvSrYS4bObjFQB7Mmwux7rR1kwiaWBV5CrUrOTKLY';
const TARGET_EMAIL = 'prithviseran0@gmail.com';

async function sendTestNotification() {
  try {
    console.log('🚀 Starting test notification...');
    
    // Check if we have the required environment variables
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
      console.error('❌ Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables');
      console.log('💡 You can either:');
      console.log('   1. Set them in your shell: export SUPABASE_URL="your_url" && export SUPABASE_ANON_KEY="your_key"');
      console.log('   2. Or modify this script directly with your values');
      return;
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase client created');

    // Step 1: Get user's push token from user_push_tokens table
    console.log(`🔍 Looking for push token for user: ${TARGET_EMAIL}`);
    
    const { data: userToken, error: tokenError } = await supabase
      .from('user_push_tokens')
      .select('push_token, user_id, is_active')
      .eq('email', TARGET_EMAIL)
      .eq('is_active', true)
      .single();

    if (tokenError) {
      console.error('❌ Error fetching user token:', tokenError);
      if (tokenError.message.includes('No rows found')) {
        console.log('💡 No active push token found for this user. They may need to:');
        console.log('   - Open the app and grant notification permissions');
        console.log('   - Have notifications enabled in their settings');
        console.log('   - Be logged in to the app');
      }
      return;
    }

    if (!userToken?.push_token) {
      console.error('❌ No push token found for user');
      return;
    }

    console.log(`✅ Found push token for user ID: ${userToken.user_id}`);
    console.log(`📱 Push token: ${userToken.push_token.substring(0, 20)}...`);

    // Step 2: Send push notification via Expo
    console.log('📤 Sending push notification...');
    
    const message = {
      to: userToken.push_token,
      sound: 'default',
      title: 'Test Notification! 🧪',
      body: 'This is a test notification sent from the Node.js script!',
      data: {
        type: 'test_script',
        timestamp: new Date().toISOString(),
        source: 'node_script'
      },
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to send push notification:', errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ Push notification sent successfully!');
    console.log('📊 Response:', result);

    // Step 3: Log the notification in our database (optional)
    try {
      await supabase
        .from('notification_logs')
        .insert({
          user_id: userToken.user_id,
          notification_type: 'test_script',
          title: message.title,
          body: message.body,
          data: message.data,
          status: 'sent'
        });
      console.log('✅ Notification logged to database');
    } catch (logError) {
      console.warn('⚠️ Failed to log notification to database:', logError);
    }

    console.log('🎉 Test notification complete!');
    console.log('📱 Check your phone for the notification');

  } catch (error) {
    console.error('❌ Error in sendTestNotification:', error);
  }
}

// Run the function
sendTestNotification();
